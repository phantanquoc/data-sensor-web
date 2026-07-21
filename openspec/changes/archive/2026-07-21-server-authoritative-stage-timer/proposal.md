## Why

The donut stage timer is computed on the client: `DonutTimer` renders `elapsed = Date.now() - startMs`, where `startMs` is reconstructed once from the batch document (`seedStartMsFromDoc` + `currentRunningDoc` + rising-edge detection in `useFryerData`). This client-side reconstruction is fragile — it already produced a shipped bug (donut showed 429.9 min instead of 9.9) — and has two structural flaws that survive the current fix: (1) **drift on stalled batches** — when an HMI disconnects or a batch is left running, the server stops emitting but the client keeps free-running off the browser clock, so elapsed climbs without bound; (2) **browser-clock dependence** — client/server clock skew corrupts elapsed, and a backgrounded tab throttles the 1s `setInterval` so the count is wrong when unattended. The single source of truth for "how long has this stage been running" is the server, which reads the machines every second and owns the stage-start instant.

## What Changes

- The server (`controller/post_data_plc.js`) SHALL own each fryer's active-stage elapsed time. It keeps an in-memory `stageStartMs[n][stage]` (matching the existing `id_document` / `pushCount` / `latestStages` RAM-state pattern), set on the rising edge when a stage becomes active.
- On server restart / reconnect with a batch still running, the server SHALL re-seed `stageStartMs` from the running document's `bien_du_lieu[1].thoi_gian` (parsed `"HH:MM:SS DD/MM/YYYY"`) so elapsed does not jump back to zero. No new Modbus registers are read — this uses data the server already generated.
- **BREAKING (socket payload, additive)**: each `noi_chien_N_data` emit SHALL carry a new `stage_elapsed_ms` field = the active stage's elapsed milliseconds computed on the server (`Date.now() - stageStartMs[activeStage]`), or `null` when no stage is active. No existing payload field changes.
- The React client SHALL stop reconstructing time: remove `seedStartMsFromDoc`, `currentRunningDoc`, and the rising-edge seeding logic from `useFryerData`. `DonutTimer` SHALL display the server-provided elapsed, interpolating smoothly between socket ticks (~1s emit cadence) but **capping** at the last server value plus the local time since it was received — so when the server stops emitting (stalled batch), the donut freezes at the last known value instead of climbing.
- **Backward compatibility**: when a payload lacks `stage_elapsed_ms` (older server), the client SHALL fall back to the current document-seed behavior, so a version mismatch never breaks the donut.

## Capabilities

### New Capabilities
<!-- None. This changes an existing behavior contract, not a new capability. -->

### Modified Capabilities
- `realtime-socket-delivery`: the `noi_chien_N_data` payload contract gains a server-computed `stage_elapsed_ms` field, and the client's consumption of it changes from client-side time reconstruction to display-only of the server value (with interpolation + cap). The existing stage fields (`data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, `set_giai_doan`), room-scoping, and join/leave behavior are unchanged.

## Impact

- **Modified code**:
  - `controller/post_data_plc.js` — add `stageStartMs[n][stage]` RAM-state, set on stage rising edge, re-seed from `bien_du_lieu[1].thoi_gian` on restart, add `stage_elapsed_ms` to the emitted payload.
  - `client/src/hooks/useFryerData.ts` — remove `seedStartMsFromDoc` / `currentRunningDoc` / rising-edge donut seeding; consume `stage_elapsed_ms`.
  - `client/src/components/DonutTimer.tsx` — display server elapsed, interpolate between ticks, cap to freeze on stall.
  - `client/src/types/index.ts` — add `stage_elapsed_ms` to the stage payload type.
- **Possibly touched**: `app.js` only if the restart re-seed needs a hook where the running document is loaded on startup (confirm during implementation; no behavior change beyond seeding `stageStartMs`).
- **Preserved (out of scope)**: no new Modbus register reads; Modbus block reads, float assembly, and the config-driven pipeline unchanged; the 3 REST endpoints unchanged; Mongo schema (`model/plc_schema.js`) unchanged; all pre-existing payload fields unchanged; `views/view_home.ejs` and `pubic/` kept as rollback.
- **Existing spec honored**: `realtime-socket-delivery` (consolidated array payload, room-scoping) — this change extends its payload contract, does not contradict it.
