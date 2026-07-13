## 1. Remove Atlas from source control

- [x] 1.1 In `.gitignore`, uncomment the `.env` line (currently `# .env` on line 5) so `.env` is ignored going forward
- [x] 1.2 Run `git rm --cached .env` to untrack it, keeping the file on disk unchanged ← (verify: `git ls-files .env` returns nothing AND `.env` still exists on disk with its current contents)
- [x] 1.3 Grep the tracked source for `atlas`, `atlat`, `mongodb+srv` and confirm zero matches in application code ← (verify: no Atlas references remain in code)

## 2. Consolidate Mongoose models

- [x] 2.1 Create one shared schema module defining the `plcSchema` byte-identical to the current `model/noi_chien_1_data.js` (keep existing `require:` keys, do NOT change to `required:`)
- [x] 2.2 Register and export the 8 models as `mongoose.model("noi_chien_" + n, plcSchema)` for n = 1..8, exposed as an index-addressable structure (array or map)
- [x] 2.3 Update all importers (`controller/home.js`, `controller/post_data_to_db_*`, `app.js`) to use the shared models; delete the 8 old per-fryer model files ← (verify: model names registered are exactly noi_chien_1..8; collection naming unchanged)

## 3. Consolidate DB-write controller

- [x] 3.1 Create one parameterized function `postDataPlc(model, n, values, io_, Start, giai_doan_1, giai_doan_2, giai_doan_3, giai_doan_4)` replacing the 8 `post_data_to_db_*` files, preserving the float assembly, value transforms (D84..D87 / 10, vi_tri_muc_dau mapping), $set/$push per-stage Mongo updates, and emit payload shapes
- [x] 3.2 Hold `id_document` as a module-scope map keyed by fryer index n (in-memory, same restart-loss behavior)
- [x] 3.3 Emit `noi_chien_${n}_data` and `noi_chien_${n}_stop` and normalize all console logs to the correct fryer number n (fixing the copy-paste bugs) ← (verify: events named noi_chien_N_data/stop for N=1..8; payload shape and start/stop logic identical to originals)

## 4. Consolidate PLC connection layer

- [x] 4.1 Refactor `connectPLC.js` to hold an array of 8 `ModbusRTU` connections plus index-keyed status, with a connect(index), getStatus(), and updateStatus(index, value) API equivalent to the old exports
- [x] 4.2 Preserve connectTCP to `IP_PLC{n}` on `PORT_PLC`, `setID(1)`, and the connected/failed status transitions ← (verify: connection + status behavior matches originals for all 8)

## 5. Refactor app.js to config-driven loop

- [x] 5.1 Define a single `PLC_CONFIGS` array (index, IP env `IP_PLC{n}`, shared model, event names) for n = 1..8
- [x] 5.2 Replace the 8 `registerList_PLCn` with one shared register-list template cloned per fryer so each fryer owns its `reg.val` state (no cross-fryer mutation)
- [x] 5.3 Replace the 8 `values_PLCn`, `Start_PLCn`, `isStart_PLCn`, and else-branch reconnect timers with index-keyed structures
- [x] 5.4 Define `readAllRegisters` ONCE (outside `setInterval`), parameterized by fryer config; keep single-register reads (reg via readHoldingRegisters, coil via readCoils)
- [x] 5.5 Replace the 8 `if (isConnectPLC_N)` blocks and 8 `plcLoop_N` with one loop over `PLC_CONFIGS` inside the single 3000ms interval; keep 1000ms/5000ms reconnect timings and process exception handlers ← (verify: single 3000ms interval; register map, float assembly, start/stop, reconnect timing all preserved; readAllRegisters defined once)

## 6. Consolidate home.js routes

- [x] 6.1 Replace the three 8-way `if (so_noiChien == N)` chains with model lookup by index, preserving `GET /get_noi_chien`, `GET /get_noi_chien_detail`, `DELETE /xoa_noi_chien_detail` response behavior (`res.send(PLCDatas)` / `res.send({ success: true })`) ← (verify: routes resolve correct noi_chien_N model and return identical responses)

## 7. package.json cleanup

- [x] 7.1 Remove `crypto` and `buffer` from dependencies (Node built-ins); leave all other deps untouched

## 8. Verify behavior end-to-end (Docker)

- [x] 8.1 `docker compose up -d --build` builds and starts both containers
- [x] 8.2 Logs contain "MongoDB Connected" and "Server running on port 3000"; no UNCAUGHT EXCEPTION / UNHANDLED REJECTION
- [x] 8.3 `curl` `GET http://localhost:3000/` returns HTTP 200
- [x] 8.4 `docker exec iot_mongo mongosh mydb --quiet --eval 'db.getCollectionNames().forEach(c => print(c, db.getCollection(c).countDocuments()))'` shows all 8 `noi_chien_1..8` receiving documents ← (verify: all 8 collections still written after refactor — the core behavior-preservation check)
