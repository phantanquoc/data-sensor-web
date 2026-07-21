## Context

The frontend is a single `views/view_home.ejs` (2375 lines): static HTML, inline CSS, and three vanilla-JS `<script>` blocks. It uses the vendored `pubic/js/socket.io.js` and has no external UI library (the progress donut is hand-drawn SVG). EJS renders no dynamic data. The backend (Express 5 + Socket.IO 4.8 + Mongoose 9 + modbus-serial) polls 8 HMIs and is live against real machines; the socket/REST contract is a hard invariant enumerated in the `realtime-socket-delivery` and `plc-data-pipeline` specs. This design replaces only the presentation layer with React + TypeScript + Vite while preserving that contract exactly.

Current data flow the React app must reproduce:
- On connect and on tab switch, the client emits `join_noi` with the fryer number `n`.
- The server emits `noi_chien_N_data` = an array of 4 stage objects (order gd1→gd4). Each stage: `{ data, giai_doan: "Giai đoạn: N", active: boolean, tong_thoi_gian_chay, set_giai_doan }`. gd1-3 `set_giai_doan` = `{ thoi_gian_chay, so_lan_nhung, thoi_gian_nhung, thoi_gian_lap_lai, nhiet_do_cai_dat, vi_tri_muc_dau }`; gd4 `set_giai_doan` = `{ thoi_gian_treo_long }` only.
- `noi_chien_N_stop` fires when a batch ends.
- REST: `GET /get_noi_chien?so_noiChien=N`, `GET /get_noi_chien_detail?id=&so_noiChien=N`, `DELETE /xoa_noi_chien_detail?id=&so_noiChien=N`.

## Goals / Non-Goals

**Goals:**
- Reproduce the existing dashboard 1:1 (visual + behavioral parity) in React + TypeScript + Vite.
- Consume the identical REST + socket contract; never alter any value the user sees vs. the EJS version.
- Port the two stateful subsystems exactly: donut stage timer (seed-from-DB → LIVE) and `auto_load_noi_chien`.
- One server, one port, one Docker image: Express serves the built SPA at `/`.
- Type-safe payloads so field-name mismatches fail at compile time.

**Non-Goals:**
- No backend logic change: Modbus block reads, float assembly, Mongo schema, socket payload shape, 3 REST endpoints, register map — all untouched.
- No new UI framework beyond React (no Tailwind, no component library, no Chart.js — the donut stays hand-drawn SVG).
- No change to `docker-compose.yml` service names or host port mappings (Mongo 27018, gateway 3001).
- No deletion of `views/view_home.ejs` or `pubic/` until verification passes.

## Decisions

**Decision: Vite React-TS SPA in `client/`, built to static assets served by Express.**
Create `client/` as a standalone Vite project. `vite build` outputs to `client/dist`. Express serves it via `express.static(client/dist)` and `GET /` returns `client/dist/index.html`. Alternative (separate container + CORS, per explore option B) rejected: the current single-server/single-port/single-Docker topology is simpler to operate and deploy, and CORS is unnecessary when same-origin. Next.js rejected: no SSR need for a pure client dashboard.

**Decision: Same-origin socket + relative REST URLs.**
`socket.io-client` connects with `io()` (no URL) so it uses the page origin, matching the existing relative-URL behavior from commit `a82a4a7`. REST calls use relative paths (`/get_noi_chien`, etc.). This means no environment-specific base URL and no CORS.

**Decision: Vite dev server proxies to Express during development.**
`vite.config.ts` proxies `/get_noi_chien`, `/get_noi_chien_detail`, `/xoa_noi_chien_detail`, and `/socket.io` to `http://localhost:<PORT_SERVER>` so `npm run dev` works with the live backend. Production uses the built static assets — no proxy.

**Decision: Component tree mirrors the EJS DOM regions.**
`App` (owns `soNoiChien` active tab, socket, toast) → `TabBar` (8 buttons) → `RealtimeView` (title + `tong_thoi_gian_chay` + 4 × `StageColumn`, each with a `DonutTimer`, + `SensorGrid`) → `BatchList` (button + table, view/delete) → `BatchDetail` (`#app` equivalent: averages table + per-stage dump). A `Toast` component replaces `alert()`. This 1:1 mapping keeps visual diffing straightforward during verification.

**Decision: Donut timer as a `DonutTimer` component driven by a `useRef` timer state + 1s interval.**
Replicate `stageTimer { stage, startMs, targetMin }` in a ref, and the 1s `setInterval` in a `useEffect`. `renderDonut` becomes JSX/SVG: radius=27, circumference=169.646, stroke `#00aaff` normally / `#fd7e14` when `elapsedMin > targetMin`, center text `"<elapsed.toFixed(1)> / <round(target)>"` over `"phút"`. `seedStartMsFromDoc(gNum)` anchors startMs directly to `bien_du_lieu[1]`'s timestamp (skip [0] init record, parsed via `parseTs("HH:MM:SS DD/MM/YYYY")`), so elapsed = now − stage-start. Because tsFirst is constant, re-seeding on tab switch is idempotent — the timer never resets. Returns null when the doc can't provide an anchor (insufficient entries or unparseable timestamp); the caller then falls back to `Date.now()` for a stage that only just went active live. A future anchor (clock skew) is clamped to `Date.now()`. This is a deliberate fix of the original EJS frozen/resetting-donut bug (the old `elapsedAtSeed = tsLast - tsFirst` math froze at the last 15s push and reset toward 0 on every tab switch). After first seed, switch to LIVE by clearing `currentRunningDoc`. gd1-3 `targetMin` from `set_giai_doan.thoi_gian_chay`, gd4 from `thoi_gian_treo_long`. Only the currently active stage shows a donut; stage transitions clear the previous donut. Alternative (CSS-only animation) rejected: cannot reproduce the exact seeded-elapsed math.

**Decision: `useFryerData` hook owns per-fryer realtime state; `auto_load` ported into it.**
On tab change: reset the realtime view, `socket.emit("join_noi", n)`, then run the `auto_load_noi_chien` sequence — `GET /get_noi_chien` → pick the latest running batch (reverse scan for empty `thoi_gian_stop`, fallback to newest) → `GET /get_noi_chien_detail` → rebuild 4 stage payloads (`active:false`, `data` = last element of each `bien_du_lieu`) and feed them through the same render path as socket ticks. Store `currentRunningDoc` so the donut seeds on the first live tick. This preserves the exact "instant snapshot without waiting for socket" behavior.

**Decision: Batch detail averages ported exactly.**
`BatchDetail` computes each sensor average as `sum / (bien_du_lieu.length - 1)` with `.toFixed(2)`, per-stage run duration from `bien_du_lieu[1].thoi_gian` to the last element's `thoi_gian` using the same `parseDate`/`getDuration` math, and then dumps each `giai_doan_*` object's scalar fields + `bien_du_lieu` table, matching the current `render(data)` output.

**Decision: Toast replaces `alert()` for the two user-facing prompts.**
Batch-complete (`"Đã hoàn thành mẻ hệ chiên N"`) and post-delete feedback become non-blocking toasts. The debug `alert("Xem document")` / `alert("Xóa document")` are dropped (they were developer noise, not UX). This is the only intentional behavioral deviation and is within the user-approved scope.

**Decision: TypeScript types mirror the payload contract.**
Define `StagePayload`, `SetGiaiDoan` (a union: stages 1-3 vs stage 4), `SensorData`, `BatchListItem`, `BatchDocument` in `client/src/types/`. These encode the exact field names so a typo is a compile error — directly serving the "không sai data" priority.

**Decision: Dockerfile multi-stage.**
Stage 1 (`node:22-alpine`): copy `client/`, `npm ci`, `vite build` → `client/dist`. Stage 2 (`node:22-alpine`): copy backend source + `client/dist`, `npm install --omit=dev`, `CMD ["node","app.js"]`. `.dockerignore` excludes `client/node_modules` and `client/dist` from the backend copy context (dist comes from stage 1). Host port mappings and compose services unchanged.

## Risks / Trade-offs

- **[Field-name drift silently zeroes a value]** → TypeScript types over every payload field; verification cross-checks each displayed field against the EJS selectors (`.value_*`, `.thoi_gian_chay_hien_tai_N`, etc.).
- **[Donut math diverges from the original]** → `seedStartMsFromDoc` anchors to `bien_du_lieu[1]`'s timestamp (deliberate fix of the original frozen/resetting-donut bug); verify against a running batch and a reloaded page that re-seeding is idempotent and the timer never resets.
- **[`auto_load` picks the wrong batch]** → Preserve the exact reverse-scan-for-running + newest-fallback logic and the `active:false` snapshot rebuild.
- **[Serving change breaks `/` in Docker]** → Keep EJS view + `pubic/` on disk for rollback; verify `node app.js` serves the built SPA locally before archiving. `express.static` for the SPA must not shadow the REST routes (mount order: REST routers first, static + SPA fallback after).
- **[SPA fallback intercepts API 404s]** → The catch-all that returns `index.html` must exclude the known REST paths (register REST routes before the fallback, and scope the fallback to non-API GETs).
- **[Docker build context bloat / stale dist]** → `.dockerignore` excludes `client/node_modules`; dist is produced fresh in stage 1, never copied from host.
- **[gd4 set_giai_doan shape differs]** → Union type + explicit stage-4 branch in `StageColumn` so stage 4 renders only `thoi_gian_treo_long`.

## Migration Plan

1. Scaffold `client/` (Vite React-TS), pin deps, add `vite.config.ts` proxy + build output config.
2. Define TypeScript payload types from the contract.
3. Build `api/` (3 REST calls) and `useSocket` (io(), join_noi, per-fryer data/stop handlers).
4. Build presentational components (TabBar, StageColumn, DonutTimer, SensorGrid, BatchList, BatchDetail, Toast) with CSS Modules cloned from inline styles.
5. Wire `useFryerData` (realtime state + auto_load + donut seed) and assemble `App`.
6. `vite build`; wire Express to serve `client/dist` at `/` and REST-safe SPA fallback.
7. Multi-stage Dockerfile + `.dockerignore`/`.gitignore` updates.
8. Verify: `npm run build` clean, TS typecheck clean, `node app.js` serves the SPA, every displayed field matches the EJS version, donut + auto_load behave identically.

Rollback: revert the change branch; `views/view_home.ejs` and `pubic/` remain intact, and restoring the old `GET /` render + `express.static("pubic")` fully reinstates the previous frontend.

## Open Questions

None — all decisions locked with the user (Vite static + Express serve, TypeScript, CSS Modules, toast-over-alert, clone 1:1, backend untouched).
