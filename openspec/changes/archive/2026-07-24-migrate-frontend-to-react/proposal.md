## Why

The entire frontend is a single 2375-line `views/view_home.ejs` file mixing static HTML, inline CSS, and three vanilla-JS `<script>` blocks that manipulate the DOM with `document.querySelector` and template strings. EJS renders no dynamic server data (`probs: "PLCDatas"` is passed but unused), so the server-side templating buys nothing. The file is hard to maintain, has no type safety over deeply nested socket/REST payloads (field-name typos fail silently), and mixes concerns (donut timer state, socket handling, REST calls, and DOM rendering all interleaved). This change replaces the frontend with a React + TypeScript + Vite application while keeping the backend and every API/socket contract byte-for-byte identical, so live PLC data is never at risk.

## What Changes

- Introduce a `client/` React + TypeScript + Vite application that reproduces the existing dashboard UI 1:1 (visual parity): the 8-tab "Hệ Chiên" bar, the realtime 4-stage view with hand-drawn SVG donut timers, the 10-card sensor grid, the batch list table (view/delete), and the batch detail view (per-stage averages + duration + field dump).
- Consume the **unchanged** data contract: 3 REST endpoints (`GET /get_noi_chien`, `GET /get_noi_chien_detail`, `DELETE /xoa_noi_chien_detail`), the `join_noi` emit, and the consolidated `noi_chien_N_data` (4-stage array) / `noi_chien_N_stop` socket events.
- Port the stateful logic exactly: the donut stage timer (seed-from-DB then LIVE) and `auto_load_noi_chien` (pick latest running batch, rebuild 4 stage payloads from the document).
- Use `socket.io-client` from npm instead of the vendored `pubic/js/socket.io.js`.
- Extract inline styles into CSS Modules with identical visual output.
- Replace the two user-facing `alert()` calls (batch complete, delete confirmation) with a lightweight toast; drop the debug `alert()`s.
- **BREAKING (serving only, not data)**: `GET /` will serve the React build's `index.html` instead of rendering the EJS view; `express.static` will point at the build directory. `Dockerfile` becomes multi-stage (build client → copy build output into the `node app.js` runtime). No API/socket/data behavior changes.

## Capabilities

### New Capabilities
- `frontend-react-dashboard`: The React + TypeScript dashboard's observable contract — how it consumes the 3 REST endpoints and the `noi_chien_N_data`/`noi_chien_N_stop` socket events, renders the 8-tab realtime view with SVG donut timers, the sensor grid, the batch list, and the batch detail averages, and reproduces the `auto_load` and donut seed-then-LIVE behavior. Also covers how the Express server serves the built SPA.

### Modified Capabilities
<!-- None. The realtime-socket-delivery spec already defines the client array-payload contract; the React client must conform to it, but its requirements do not change. -->

## Impact

- **New code**: `client/` (Vite React-TS project: `components/`, `hooks/`, `types/`, `api/`, `*.module.css`, `vite.config.ts`, `tsconfig.json`, `package.json`).
- **Modified code**: `app.js` (`GET /` serves React `index.html`; `express.static` → build dir; all REST/socket/Modbus/Mongo untouched), `Dockerfile` (multi-stage build), `.dockerignore`/`.gitignore` (ignore `client/node_modules`, handle build output).
- **Preserved (out of scope)**: backend Modbus block reads, float assembly (`post_data_plc.js`), Mongo schema (`model/plc_schema.js`), socket payload shape, the 3 REST endpoints, register map, port mappings, and `docker-compose.yml` services. `views/view_home.ejs` and `pubic/` are kept on disk until verification passes (rollback path).
- **Dependencies**: `client/` adds `react`, `react-dom`, `socket.io-client`, `vite`, `typescript`, `@vitejs/plugin-react` (pinned versions). Root `package.json` gains a build hook if needed for Docker.
- **Existing spec to honor**: `realtime-socket-delivery` (client consumes the 4-stage array payload, joins/leaves rooms on tab switch).
