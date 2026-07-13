## Why

The backend is a single system copy-pasted 8 times, one block per fryer ("nồi chiên"). `app.js` is 2603 lines, the 8 controllers are ~510 lines each and differ only by number (with copy-paste bugs, e.g. `post_data_to_db_3.js` logs "nồi chiên 4"), and the 8 models are identical except for one line. Any fix must be applied in 8 places. In parallel, the project no longer uses MongoDB Atlas but its credentials still sit in a git-tracked `.env`. This change collapses the duplication into one config-driven code path over an array of 8 PLCs and removes the Atlas footprint from source control — without changing any externally observable behavior.

## What Changes

- Consolidate the 8 identical Mongoose models (`model/noi_chien_1..8_data.js`) into one shared schema module that still registers 8 models under the exact names `noi_chien_1`..`noi_chien_8`.
- Consolidate the 8 near-identical DB controllers (`controller/post_data_to_db_1..8.js`) into one parameterized function (model + fryer index + `io_` + `Start` + 4 `giai_doan` + `values`). Keep `id_document` as a module-scope map keyed by fryer index (same in-memory behavior, still lost on restart). Normalize logs to the correct fryer number.
- Consolidate `connectPLC.js` (8 connect functions + 8 status flags + 8 update functions) into an array-indexed structure exposing an equivalent API.
- Refactor `app.js` to drive all 8 PLCs from a single config array (index, IP env `IP_PLC1..8`, model, event names) instead of 8 copied register lists, value objects, `if (isConnectPLC_N)` blocks, and `plcLoop_N` functions. Define `readAllRegisters` **once** instead of redefining it every 3 seconds inside `setInterval`.
- Consolidate `controller/home.js` (3 functions, each an 8-way `if (so_noiChien == N)` chain) into model lookup by index. Same route behavior.
- Remove Atlas from source control: uncomment `.env` in `.gitignore` and `git rm --cached .env` (file stays on disk untouched).
- Remove `crypto` and `buffer` from `package.json` dependencies (both are Node built-ins; `require("crypto")`/`require("buffer")` keep working).

## Capabilities

### New Capabilities
- `plc-data-pipeline`: The externally observable contract of the PLC-to-DB-to-dashboard pipeline that the refactor must preserve exactly — the 8 MongoDB collections, the 16 Socket.IO events, the Modbus register map and 16-bit little-endian float assembly, the per-fryer start/stop batch logic, the polling/reconnect timings, the value transforms, and the HTTP routes. This spec captures the behavior contract so the verifier can confirm the refactor is behavior-preserving.

### Modified Capabilities
<!-- None. No existing OpenSpec specs; this is the first change in the repo. No spec-level behavior changes — the refactor is behavior-preserving by design. -->

## Impact

- **Code**: `app.js`, `connectPLC.js`, `controller/post_data_to_db_1..8.js` (→ 1 shared), `model/noi_chien_1..8_data.js` (→ 1 shared), `controller/home.js`, `package.json`, `.gitignore`, git index for `.env`.
- **Behavior**: None externally. Same 8 collections (`noi_chien_1..8`), same 16 events (`noi_chien_N_data`/`noi_chien_N_stop`), same routes (`GET /`, `GET /get_noi_chien`, `GET /get_noi_chien_detail`, `DELETE /xoa_noi_chien_detail`, `POST /enable_machine`), same register map, float assembly, start/stop logic, 3000ms poll, 1000ms/5000ms reconnect, `d84..d87 / 10`, `vi_tri_muc_dau` mapping.
- **Runtime**: Docker (`mongo:7` local + `iot-gateway`, `MONGO_URI` override to `mongodb://mongo:27017/mydb`). Node 22, Express 5, Mongoose 9, modbus-serial, socket.io 4.8.3. Live PLCs at 192.168.1.51-58 — behavior must be preserved exactly.
- **Out of scope**: `id_document` restart-loss bug, batched Modbus reads, API/socket auth, `innerHTML` XSS, frontend (`view_home.ejs`, `socket.io.js`), `pubic`→`public` rename, git history rewrite of the leaked Atlas password.
