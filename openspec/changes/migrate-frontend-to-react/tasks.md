## 1. Scaffold client project

- [x] 1.1 Create `client/` Vite React-TS project structure (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`)
- [x] 1.2 Pin dependencies: `react`, `react-dom`, `socket.io-client`, `vite`, `typescript`, `@vitejs/plugin-react` at exact versions
- [x] 1.3 Configure `vite.config.ts`: build output to `client/dist`, dev-server proxy for `/get_noi_chien`, `/get_noi_chien_detail`, `/xoa_noi_chien_detail`, and `/socket.io` to the Express port ← (verify: build outDir is client/dist; proxy covers all 3 REST paths + socket.io)

## 2. Types and API layer

- [x] 2.1 Define TypeScript types in `src/types/`: `SensorData` (10 sensor fields), `SetGiaiDoanStages123`, `SetGiaiDoanStage4`, `StagePayload` (`data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, `set_giai_doan`), `BatchListItem`, `BatchDocument`
- [x] 2.2 Implement `src/api/` REST calls with relative URLs: `getNoiChien(n)`, `getNoiChienDetail(id, n)`, `xoaNoiChienDetail(id, n)` ← (verify: URLs and query params exactly match /get_noi_chien?so_noiChien=, /get_noi_chien_detail?id=&so_noiChien=, DELETE /xoa_noi_chien_detail?id=&so_noiChien=)

## 3. Socket layer

- [x] 3.1 Implement `useSocket` hook: `io()` same-origin connection, emit `join_noi` on connect and on demand, subscribe to `noi_chien_N_data` / `noi_chien_N_stop` for the active fryer
- [x] 3.2 Ensure data events for non-active fryers are ignored and `join_noi` is re-emitted on tab switch ← (verify: only active-fryer events update state; join_noi emitted on connect and every tab switch)

## 4. Presentational components (CSS Modules cloned from inline styles)

- [x] 4.1 `TabBar` — 8 "Hệ Chiên N" buttons, active highlight, default fryer 1
- [x] 4.2 `SensorGrid` — 10 sensor cards bound to `SensorData` fields
- [x] 4.3 `StageColumn` — stages 1-3 render full `set_giai_doan` (thoi_gian_chay/so_lan_nhung/thoi_gian_nhung/thoi_gian_lap_lai/nhiet_do_cai_dat/vi_tri_muc_dau with units); stage 4 renders only `thoi_gian_treo_long`
- [x] 4.4 `DonutTimer` — SVG radius 27, circumference 169.646, color `#00aaff`/`#fd7e14` overtime, center text "elapsed / target" + "phút", 1s tick via `useEffect`
- [x] 4.5 `Toast` — non-blocking notification replacing `alert()`
- [x] 4.6 CSS Modules reproducing the header, tabs, stage cards, sensor grid, and tables 1:1 ← (verify: visual parity with view_home.ejs — colors, layout, units, labels match)

## 5. Stateful logic (highest risk — port verbatim)

- [x] 5.1 Port `parseTs("HH:MM:SS DD/MM/YYYY")` and `parseDate`/`getDuration` helpers
- [x] 5.2 Port donut timer state (`stageTimer {stage,startMs,targetMin}` via ref) + `seedStartMsFromDoc` (anchors startMs directly to `bien_du_lieu[1]`'s timestamp — the stage's real start, skipping the [0] init row — so elapsed = now − stageStart; re-anchoring on tab switch is idempotent since tsFirst is constant; returns null when doc can't provide an anchor, caller falls back to Date.now(); clamps future anchor to Date.now() to guard clock skew). This is a deliberate fix of an original EJS bug where the donut froze at the last 15s push and reset toward 0 on every tab switch. Seed-then-LIVE transition, stage-transition clearing, gd1-3 target from `thoi_gian_chay` / gd4 from `thoi_gian_treo_long` ← (verify: startMs anchored to bien_du_lieu[1].thoi_gian; re-seed is idempotent; null fallback works; future-anchor clamped; only active stage shows donut)
- [x] 5.3 Implement `useFryerData`: realtime state, render path shared by socket ticks and auto_load
- [x] 5.4 Port `auto_load_noi_chien`: fetch list → pick newest running (reverse scan empty `thoi_gian_stop`) else newest → fetch detail → rebuild 4 stage payloads (`active:false`, `data` = last `bien_du_lieu` element) → retain `currentRunningDoc` for donut seeding ← (verify: batch selection and last-value snapshot match original; running doc retained only when a batch is running)

## 6. Batch list and detail

- [x] 6.1 `BatchList` — "Hiển thị danh sách" button + table (start/stop/ID/actions), Xem loads detail, Xóa deletes + refreshes + toast, auto-loaded on tab open
- [x] 6.2 `BatchDetail` — summary panel (start/stop/tong_thoi_gian_chay + per-stage durations from `bien_du_lieu[1]`→last), 4-column averages table (`sum/(length-1)` `.toFixed(2)` for 10 sensors), per-`giai_doan_*` field dump + bien_du_lieu table ← (verify: averages divisor is length-1, durations and dump match render(data) output)

## 7. Assemble app

- [x] 7.1 Wire `App`: owns active `soNoiChien` (default "1"), socket, toast; tab switch resets realtime view, emits `join_noi`, triggers auto_load
- [x] 7.2 On stop event for active fryer: reset realtime view + toast "Đã hoàn thành mẻ hệ chiên N" ← (verify: reset + toast only for active fryer)

## 8. Express serving + build integration

- [x] 8.1 Modify `app.js`: `express.static(client/dist)`; register REST routers first; `GET /` and non-API GET fallback return `client/dist/index.html`; leave all REST/socket/Modbus/Mongo code untouched ← (verify: REST routes not shadowed; / serves SPA; socket still works)
- [x] 8.2 Verify local run: `npm --prefix client run build` then `node app.js` serves the SPA and connects sockets
- [x] 8.3 Root `package.json`: add a client build hook/script if needed for Docker

## 9. Docker + ignore files

- [x] 9.1 Convert `Dockerfile` to multi-stage: stage 1 builds `client/` → `client/dist`; stage 2 copies backend + `client/dist`, `npm install --omit=dev`, `CMD ["node","app.js"]`
- [x] 9.2 Update `.dockerignore` (exclude `client/node_modules`, `client/dist` from backend copy context) and `.gitignore` (ignore `client/node_modules`, `client/dist`) ← (verify: docker build produces an image that serves the SPA; host ports/compose services unchanged)

## 10. Final verification

- [x] 10.1 `npm --prefix client run build` clean (TS typecheck passes, bundle produced)
- [x] 10.2 Cross-check every displayed field against `view_home.ejs` selectors (realtime stage fields, sensor grid, donut, batch list, detail averages/durations) — no value differs ← (verify: full data parity; keep view_home.ejs and pubic/ intact for rollback)
