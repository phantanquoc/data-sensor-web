## Context

The gateway polls 8 machines. Each machine's PLC has no Ethernet, so an HMI screen acts as a Modbus TCP gateway exposing the PLC's D/M/X memory (see the HMI-as-gateway architecture). `IP_PLC1..8` are therefore 8 distinct HMIs on distinct IPs. HMIs are low-powered, so requests-per-second is the binding constraint.

Current read path (`app.js`):
- `REGISTER_LIST_TEMPLATE` lists ~43 registers per fryer. `readAllRegisters(cfg)` maps over them and issues one `readHoldingRegisters(addr,1)` / `readCoils(addr,1)` per register inside a `Promise.all` — all concurrent on one TCP connection.
- A single `setInterval(3000)` iterates the 8 fryers and calls `readAllRegisters` **without awaiting**.

Current emit path (`controller/post_data_plc.js`): after DB writes it calls `io_.emit("noi_chien_N_data", …)` four times (one per stage) — a broadcast to every client; the browser filters by `so_noiChien`.

Constraints (hard invariants): register→field mapping, float LE assembly, D84–87/10, address-60 time, the intentional +1 offsets, coil offsets (+15000 / +16000), batch lifecycle, orphan cleanup. No PLC writes, no schema change.

## Goals / Non-Goals

**Goals:**
- Cut Modbus requests per fryer from ~43 to 11 (fleet 344 → 88 per 3s).
- Never issue concurrent requests on a single HMI connection.
- Eliminate overlapping read cycles.
- Cut socket emits from 32 to 8 per cycle and stop broadcasting to uninterested clients.
- Preserve every data value and lifecycle behavior bit-for-bit.

**Non-Goals:**
- No PLC write path. No DB schema change. No change to how time is read. No change to the float assembly, offsets, or lifecycle logic. No change to `connectPLC.js` connection setup.

## Decisions

### D1: Block map derived from the existing register list
Group the existing addresses into contiguous ranges. Holding blocks `[start,count]`: `[2,4]`, `[60,1]`, `[81,7]`, `[134,2]`, `[202,13]`, `[256,13]`, `[316,1]`, `[501,10]`, `[572,6]`. Coil blocks: `[15070,86]` (M70=15070 … M155=15155), `[16000,1]` (X0). A block read returns `response.data` as an array indexed by offset; the value for a register at address `A` in block `[start,count]` is `response.data[A - start]`. This inherently preserves the +1 offsets because we key by the **Modbus address** (e.g. D507 lives at address 508 → `data[508-501]`), never by the register name.

*Alternative rejected:* per-register reads (current) — 43 requests, the problem itself. *Alternative rejected:* one giant block spanning 2..577 — 576 registers exceeds the 125-register Modbus limit and reads huge unused ranges.

### D2: Represent blocks as data, keep the register list as the value store
Add a block definition table. Keep populating `cfg.values[name]` exactly as today so `postDataPlc` is untouched by the read change. After each block read, write each covered register's value into `cfg.values` by address. This keeps the split logic in one place and the downstream contract identical.

### D3: Per-block try/catch fallback
Wrap each block read in try/catch. On success, split into values. On failure, loop the block's registers and read each with `readHoldingRegisters(addr,1)`/`readCoils(addr,1)`; on an individual failure set that value to 0 and mark the fryer disconnected (current behavior). Fallback is scoped to the one block; other blocks proceed. This guards against an HMI that does not map an unused interior address (e.g. D83) contiguously.

*Alternative rejected:* no fallback — a single unmapped interior address would fail the whole block and drop several fields.

### D4: Sequential-within-fryer, parallel-across-fryers
Replace `Promise.all` with an ordered `for … of blocks { await read }`. Because each fryer owns a distinct `ModbusRTU` instance to a distinct IP, the 8 fryers can still run their loops concurrently. This matches `modbus-serial`'s one-transaction-per-client model and removes crossed-response risk.

### D5: Self-scheduling loop + re-entrancy guard
Replace the shared `setInterval` with a per-fryer scheduler: `scheduleRead(n)` runs a cycle, and on completion (`finally`) schedules the next via `setTimeout(interval)`. An `isReading[n]` flag is set at cycle start and cleared in `finally`; if a scheduled tick fires while `isReading[n]` is true (should not happen with self-scheduling, but guards manual/again paths), it skips. Connection gating (`isConnected`, `dbConnected`, `isServer`) is checked at the top of each cycle exactly as today; when a fryer is disconnected the loop still re-schedules and retries connect, preserving the existing reconnect behavior.

*Alternative rejected:* keep `setInterval` but await inside — awaiting inside a non-async interval callback does not prevent overlap; the interval keeps firing.

### D6: Consolidated event + rooms
`postDataPlc` builds the 4 stage objects as today, pushes them into one array, and emits once: `io_.to("noi_" + n).emit("noi_chien_" + n + "_data", stagesArray)`. Stop emits `io_.to("noi_" + n).emit("noi_chien_" + n + "_stop", …)`. The connection handler in `app.js` gains `socket.on("join_noi", n => { socket.rooms → leave others; socket.join("noi_"+n) })` (or explicit leave+join). The client emits `join_noi` on load and on tab switch, leaving the previous room, and its `noi_chien_N_data` handler iterates the 4-element array calling the existing render per stage.

*Alternative rejected:* keep 4 broadcasts — 32 emits/cycle to all clients, the current waste. *Alternative rejected:* one global event with fryer id — still broadcasts to all clients; rooms are the idiomatic Socket.IO scoping.

## Risks / Trade-offs

- **HMI does not map an interior gap address contiguously (e.g. D83 inside [81,7])** → per-block fallback (D3) reads each register individually, so the field is still fetched; only that block pays the old cost.
- **Block boundaries or offsets computed wrong → silent wrong values written to DB** → verification must confirm each address maps to `data[addr-start]` and the +1 offsets land on the intended addresses; keep `cfg.values` keys and the float-assembly untouched so a diff is auditable.
- **Client still on old 4-event contract after server switches to array** → server and client change together; the array handler replaces the 4 `.on(...data)` handlers for each fryer. Stop event name is unchanged.
- **Room not joined → client sees nothing** → client joins default room on load and on every tab switch; a missed join shows as "no updates", caught in manual verification by watching the active tab update.
- **Self-scheduling loop drift** → next cycle is scheduled `interval` ms after the previous completes, so cadence is ≥3s (slightly longer under load) rather than exactly 3s; acceptable for this dashboard and safer for the HMI.

## Migration Plan

1. Implement block reads + fallback + sequential loop + guard + scheduler in `app.js` (parts 1–3).
2. Implement consolidated emit + rooms in `controller/post_data_plc.js` and the `app.js` connection handler (part 4 server side).
3. Update `views/view_home.ejs` to join/leave rooms and consume the array payload (part 4 client side).
4. Manual verification: run the gateway, confirm each fryer issues 11 requests/cycle (or falls back per block), confirm values match, confirm only the active tab receives events and renders all 4 stages.

Rollback: the 4 parts are independent commits; revert any part without touching the others.

## Open Questions

- None. Block map, offsets, fallback behavior, scheduling, and socket contract are all specified. HMI contiguity uncertainty is handled by the fallback rather than left open.
