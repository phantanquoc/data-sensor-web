## 1. Schema & Index Fixes (model/plc_schema.js)

- [x] 1.1 Replace all `require: true` with `required: true` throughout plc_schema.js
- [x] 1.2 Add index `plcSchema.index({ thoi_gian_start_at: -1 })` after existing index line ← (verify: both indexes defined, `required` keyword correct in all occurrences)

## 2. Backend Data Safety (controller/post_data_plc.js)

- [x] 2.1 Add `if (!id_document[n]) return;` guard before the `Start === 0` stop block (before L767 updateOne)
- [x] 2.2 Guard setTimeout cross-batch: capture `id_document[n]` before setTimeout, compare inside callback — skip write if different
- [x] 2.3 Export new `setBatchStartMs(n, ms)` function that sets `batchStartMs[n] = ms`
- [x] 2.4 Fix dataFormat key: change `thoi_gian_treo_long_gd_4` to `thoi_gian_treo_long` in giai_doan_4 initial shape
- [x] 2.5 Fix typo: "đã hoang thành xong mẽ chiên" → "đã hoàn thành xong mẻ chiên" ← (verify: stop guard works, setTimeout guard works, setBatchStartMs exported, dataFormat key matches schema, typo corrected)

## 3. Resume Fix (app.js)

- [x] 3.1 Import `setBatchStartMs` from `./controller/post_data_plc`
- [x] 3.2 In `resumeOpenBatches`, after `setBatchDocId(n, doc._id)`, call `setBatchStartMs(n, startMs)` using `doc.thoi_gian_start_at.getTime()` or parsed legacy string ← (verify: batchStartMs[n] is set on resume so giay_tu_start is non-null for subsequent snapshots)

## 4. Modbus Fallback Removal (app.js)

- [x] 4.1 In `readHoldingBlocks`: replace per-register fallback catch block with `console.warn` + continue (keep reg.val unchanged, no updateStatus call)
- [x] 4.2 In `readCoilBlocks`: same change — log warning, keep reg.val, continue ← (verify: no updateStatus(n, false) called on individual block failures, fallback loop removed)

## 5. API Query Optimization (controller/home.js)

- [x] 5.1 Refactor `noi_chien` endpoint: build Mongo query `{ $or: [{ thoi_gian_start_at: {$gte, $lte} }, { thoi_gian_stop: "" }] }` with `.sort({ thoi_gian_start_at: -1, _id: -1 })` at DB level
- [x] 5.2 Refactor `thong_ke` endpoint: same Mongo query approach — running batches always counted
- [x] 5.3 Add new `get_noi_chien_chart` endpoint with `.select()` projection for chart data only ← (verify: API returns same shape as before for existing endpoints, new chart endpoint returns projected fields only, running batches always included)

## 6. Route Registration (router/home.js)

- [x] 6.1 Add route `router.get("/get_noi_chien_chart", homeController.get_noi_chien_chart)` ← (verify: route registered and accessible)

## 7. Port Parsing (connectPLC.js)

- [x] 7.1 Change `port: process.env.PORT_PLC` to `port: parseInt(process.env.PORT_PLC, 10) || 502`

## 8. Shared Socket Manager (client/src/hooks/sharedSockets.ts)

- [x] 8.1 Create `sharedSockets.ts` with singleton manager: opens 8 Socket.IO connections, joins rooms, provides subscribe/unsubscribe API with 2s teardown debounce ← (verify: module exports subscribe/unsubscribe, connections are shared not duplicated)

## 9. Frontend Hook Refactors

- [x] 9.1 Refactor `useAllFryers.ts` to use shared socket manager instead of `io({ forceNew: true })` x 8
- [x] 9.2 Refactor `useFleetHistory.ts` to use shared socket manager instead of opening its own 8 sockets; use new `/get_noi_chien_chart` endpoint for initial REST load
- [x] 9.3 Refactor `useSocket.ts`: register listeners only for `noi_chien_${soNoiChien}_data` and `_stop` (not all 8 fryers) ← (verify: TypeScript compiles, useSocket only has 2 listeners per mount, useAllFryers/useFleetHistory use shared manager)

## 10. Client API Addition (client/src/api/index.ts)

- [x] 10.1 Add `getNoiChienChart(id, n)` function calling `GET /get_noi_chien_chart`

## 11. Environment Documentation

- [x] 11.1 Create `.env.example` at repo root with all required env vars: PORT_SERVER, MONGO_URI, IP_PLC1-8, PORT_PLC, DEBUG

## 12. Verification

- [x] 12.1 Run `node --test` — all tests pass
- [x] 12.2 Run `npm --prefix client run build` — TypeScript + Vite build passes ← (verify: no test failures, no build errors, no type errors)
