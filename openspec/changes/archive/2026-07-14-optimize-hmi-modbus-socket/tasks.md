## 1. Block reads + fallback (app.js)

- [x] 1.1 Add a block-definition table in `app.js`: holding blocks `[2,4],[60,1],[81,7],[134,2],[202,13],[256,13],[316,1],[501,10],[572,6]` and coil blocks `[15070,86],[16000,1]`, each block listing the covered register names with their Modbus addresses.
- [x] 1.2 In `readAllRegisters(cfg)`, read each block with a single `readHoldingRegisters(start,count)` / `readCoils(start,count)` and split `response.data[addr-start]` into `cfg.values[name]` by Modbus address (so the intentional +1 offsets and coil +15000/+16000 offsets are honored by construction).
- [x] 1.3 Wrap each block read in try/catch; on failure, fall back to reading each register in that block individually (`readHoldingRegisters(addr,1)`/`readCoils(addr,1)`), setting value 0 and marking the fryer disconnected on an individual failure. Fallback is scoped to the failing block only; other blocks still read. ← (verify: every register D2..D577, M70..M155, X0 populated identically to per-register reads; +1 offsets land on intended addresses; fallback does not abort other blocks)

## 2. Sequential-within-fryer reads (app.js)

- [x] 2.1 Replace the `Promise.all` over per-register tasks with an ordered `for … of blocks { await read }` so at most one Modbus request is in flight per fryer connection.
- [x] 2.2 Confirm cross-fryer parallelism is retained (each fryer keeps its own `ModbusRTU` instance; fryer loops run independently). ← (verify: no concurrent requests on one connection; 8 fryers still poll independently)

## 3. Re-entrancy guard + self-scheduling loop (app.js)

- [x] 3.1 Add per-fryer `isReading[n]` flag; set at cycle start, clear in `finally`.
- [x] 3.2 Replace the shared non-awaited `setInterval` with a per-fryer self-scheduling loop: run a cycle, then `setTimeout(next, interval)` in `finally`; skip a tick if `isReading[n]` is still true.
- [x] 3.3 Preserve existing gating (`isConnected[n]`, `dbConnected`, `isServer`) and reconnect behavior at the top of each cycle; a disconnected fryer still re-schedules and retries connect. ← (verify: slow cycle never overlaps; ticks skipped not queued; ~3s cadence preserved when fast; batch lifecycle and orphan cleanup unchanged)

## 4. Socket consolidation + rooms (controller/post_data_plc.js, app.js, views/view_home.ejs)

- [x] 4.1 In `post_data_plc.js`, build the 4 stage objects as today, collect into one array, and emit once: `io_.to("noi_"+n).emit("noi_chien_"+n+"_data", stagesArray)`. Keep each stage object's fields (`data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, `set_giai_doan`) unchanged.
- [x] 4.2 Room-scope the stop emit: `io_.to("noi_"+n).emit("noi_chien_"+n+"_stop", …)`.
- [x] 4.3 In `app.js` socket connection handler, add `join_noi` handling: on receive, leave any previous `noi_*` room and join `noi_<n>`.
- [x] 4.4 In `view_home.ejs`, emit `join_noi` on initial load (default tab) and on every tab switch (leaving the previous fryer's room).
- [x] 4.5 In `view_home.ejs`, replace the per-fryer 4-separate-event handling with a single `noi_chien_N_data` handler that iterates the 4-element array and renders each stage via the existing render path; keep `noi_chien_N_stop` handling (now room-scoped). ← (verify: 8 data emits/cycle not 32; only active-tab client receives events; all 4 stages render identically; stop still resets view)

## 5. Verification

- [x] 5.1 Manual/code verification: confirm 11 requests/fryer on the happy path, per-block fallback on induced block failure, no concurrent requests per connection, no overlapping cycles, and that DB-written values and the dashboard render are unchanged. ← (verify: all metrics met — 43→11 req/fryer, 344→88 fleet, 32→8 emits; zero invariant regressions)
