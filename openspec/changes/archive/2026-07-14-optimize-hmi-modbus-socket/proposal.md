## Why

Each of the 8 machines exposes its PLC data through an HMI screen acting as a Modbus TCP gateway (the PLCs have no Ethernet). These HMIs are low-powered devices, so request volume per second is the critical constraint. The gateway currently reads ~43 individual registers per fryer using `Promise.all` — firing all requests concurrently over a single TCP connection — which produces ~344 concurrent Modbus requests every 3 seconds across the fleet. `modbus-serial` processes one transaction per TCP client at a time, so this concurrency causes timeouts, crossed responses, and HMI congestion/lag. The `setInterval` driver never awaits the read, so slow HMIs cause overlapping read cycles that cascade the congestion. On top of that, the socket layer emits 4 events per fryer broadcast to every client, wasting bandwidth.

## What Changes

- **Block reads**: Replace the 43 single-register reads per fryer with 9 grouped holding-register block reads + 2 coil block reads = 11 requests/fryer (−74%; fleet 344 → 88 requests per 3s cycle). Each block is split back into individual register values by offset after the read.
- **Per-block fallback**: If a block read fails (an HMI may not map gaps like D83 contiguously), fall back to reading each register in that block individually so no field is lost.
- **Sequential reads within a fryer**: Remove `Promise.all`; read the blocks sequentially over the fryer's single TCP connection (matches `modbus-serial`'s one-transaction model). Keep parallelism *across* the 8 fryers (distinct HMIs/IPs — no contention).
- **Re-entrancy guard + self-scheduling loop**: Add an `isReading[n]` flag and replace the shared non-awaited `setInterval` with a per-fryer self-scheduling loop (read → wait interval → read again). If the previous cycle has not finished, skip the tick rather than queueing.
- **Socket consolidation + rooms**: Merge the 4 per-stage `noi_chien_N_data` emits into a single event carrying a 4-stage array. Use Socket.IO rooms so the server emits only to clients viewing that fryer (`io_.to("noi_N")`) instead of broadcasting to all. The client joins/leaves rooms on tab switch and handles the array payload. The `noi_chien_N_stop` event keeps its name but is also room-scoped.

Invariants preserved (no behavior change): register→field mapping, float LE assembly (`writeUInt16LE`/`readFloatLE`), D84–87 divide-by-10, `tong_thoi_gian_chay` from address 60, the intentional +1 address offsets (D575→576, D576→577, D571→572, D572→573, D500→501, D507→508, D502→503, D508→509, D504→505, D509→510), coil offsets (+15000 for M, +16000 for X0), batch lifecycle (M120 Start counter create/update/stop), orphan-batch cleanup. No PLC write path, no DB schema change, no change to time reading.

## Capabilities

### New Capabilities
- `hmi-modbus-read`: How the gateway polls each HMI — block grouping, per-block fallback, sequential-within-fryer / parallel-across-fryers reads, re-entrancy guard, and self-scheduling loop, while preserving the exact register→field mapping and offsets.
- `realtime-socket-delivery`: How live fryer data reaches browser clients — consolidated single event per fryer with a 4-stage array payload, delivered via per-fryer Socket.IO rooms, with room join/leave on tab switch.

### Modified Capabilities
<!-- None — no existing OpenSpec specs in this repo; behavior contracts are new. -->

## Impact

- **`app.js`**: `REGISTER_LIST_TEMPLATE` / read structure → block definitions; `readAllRegisters` → sequential block reads with fallback + `isReading` guard; `setInterval` driver → per-fryer self-scheduling loop.
- **`controller/post_data_plc.js`**: emit 1 consolidated `noi_chien_N_data` (4-stage array) via room; `noi_chien_N_stop` room-scoped. Float assembly and DB lifecycle unchanged.
- **`app.js` socket connection handler**: add room `join`/`leave` handling.
- **`views/view_home.ejs`**: join/leave room on tab switch; consume array payload instead of 4 separate events.
- **`connectPLC.js`**: unchanged (8 `ModbusRTU` instances reused).
- **`model/plc_schema.js`**: unchanged.
- **Dependencies**: none added.
