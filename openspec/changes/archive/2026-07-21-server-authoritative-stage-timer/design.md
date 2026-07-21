## Context

The donut stage timer currently computes elapsed time on the client. `DonutTimer.tsx` renders `elapsed = (Date.now() - startMs) / 60000`; `startMs` is reconstructed once in `useFryerData.ts` via `seedStartMsFromDoc` (now `startMs = Date.now() - (tsLast - tsFirst)`, seeded on the donut rising edge from `currentRunningDoc`). This reconstruction is the source of a shipped bug (429.9 vs 9.9 min) and has two flaws the current fix does not remove:

1. **Drift on stalled batches** — the server stops emitting when an HMI disconnects or a batch is idle, but the client keeps free-running off the browser clock, so elapsed climbs unbounded.
2. **Browser-clock dependence** — client/server clock skew corrupts elapsed; a backgrounded tab throttles the 1s interval.

The server (`controller/post_data_plc.js`) already owns the authoritative timeline: it reads each fryer roughly every second (self-scheduling `plcLoop`), writes `bien_du_lieu` points every `PUSH_EVERY_N_CYCLES` (~5 cycles), and holds per-fryer RAM state (`id_document`, `pushCount`, `latestStages`). The emit site is the consolidated `stagesArray` at the end of `postDataPlc`, each stage carrying an `active` boolean. This is the natural place to compute and attach server-authoritative elapsed.

## Goals / Non-Goals

**Goals:**
- Make the server the single source of truth for active-stage elapsed time.
- Eliminate client-side time reconstruction (`seedStartMsFromDoc`, `currentRunningDoc`, rising-edge seeding).
- Freeze the donut when the server stops emitting (no drift on stalled batches).
- Remove browser-clock dependence for the value; the client only displays and smooths.
- Survive server restart mid-batch without resetting elapsed to zero.
- Keep the change backward-compatible so a version mismatch never breaks the donut.

**Non-Goals:**
- No new Modbus register reads — elapsed is derived from data the server already has.
- No change to the 3 REST endpoints, Mongo schema, float assembly, or block-read pipeline.
- No change to any existing socket payload field; `stage_elapsed_ms` is purely additive.
- No removal of `views/view_home.ejs` or `pubic/` (rollback path).

## Decisions

**Decision: Compute elapsed at the emit site from RAM-held stage-start instants.**
Add `const stageStartMs = {}` keyed by fryer `n`, each `{1,2,3,4}` → start-ms or null, initialized alongside the existing `pushCount`/`isStart` maps. In `postDataPlc`, before building `stagesArray`, evaluate the four `giai_doan_k` active booleans: on a rising edge (was null/inactive, now active) set `stageStartMs[n][k] = Date.now()`; when a stage goes inactive, clear it to null. The active stage's elapsed is `Date.now() - stageStartMs[n][activeK]` clamped ≥ 0; if no stage active, `null`. Attach as top-level `stage_elapsed_ms` on the emitted object (alongside the 4-stage array) and cache it in `latestStages[n]` so the join-snapshot carries it too.
*Alternative rejected:* per-stage `elapsed_ms` inside each stage object — more data, but the client only ever shows the active stage's donut, so a single top-level field is simpler and matches the UI.

**Decision: Re-seed `stageStartMs` from `bien_du_lieu[1].thoi_gian` on restart.**
Server RAM is lost on restart. When `postDataPlc` runs for a fryer whose active stage has no `stageStartMs` yet but the running document already has `bien_du_lieu` history, seed the start instant from `bien_du_lieu[1].thoi_gian` (skip `[0]` init row) parsed as `"HH:MM:SS DD/MM/YYYY"` — the same anchor the EJS/React seed used. Reuse a `parseTs` equivalent on the server (add a small local parser; do not import client code). If unparseable, fall back to `Date.now()`. This means the first post-restart cycle re-anchors correctly instead of showing 0.
*Alternative rejected:* persist `stageStartMs` to Mongo — unnecessary write load; the document already contains the anchor.

**Decision: Client displays with interpolation + cap (freeze-on-stall).**
`DonutTimer` takes `elapsedMs` (server value) and the local receipt time. It shows `min(serverElapsedMs + (Date.now() - receivedAt), serverElapsedMs + MAX_INTERP)` — i.e. it interpolates smoothly each second from the last server value, but the cap means when no new value arrives (server stopped emitting) it stops climbing shortly after the last tick. Since the server emits ~1s, `MAX_INTERP` set to a small multiple of the emit interval (e.g. 2× expected emit gap) keeps motion smooth without runaway. `useFryerData` stores `stageElapsedMs` + `receivedAt` in donut state instead of `startMs`; on `null` it clears the donut.
*Alternative rejected:* display raw server value only (no interpolation) — donut would visibly step/stutter at the emit cadence.

**Decision: Backward-compatible fallback.**
If `stage_elapsed_ms` is `undefined` in the payload (older server), `useFryerData` keeps the existing document-seed path (retain a minimal `seedStartMsFromDoc` fallback) so the donut still works against an un-upgraded server. When the field is present (number or null), the new display-only path is used.
*Alternative rejected:* hard cut-over — would break the donut during any partial deploy or cached client.

## Risks / Trade-offs

- **[Rising-edge detection wrong → elapsed resets or never starts]** → Mirror the existing `active` computation already used to build `stagesArray` (same `giai_doan_k && typeof === "boolean"` test); unit-reason the transition table (null→active seeds, active→active keeps, active→inactive clears) against the four stages.
- **[Restart seed picks wrong stage or stale timestamp]** → Only seed the stage that is currently active this cycle, from that stage's own `bien_du_lieu[1]`; clamp negative to 0; fall back to now on parse failure.
- **[Interpolation cap too tight → donut stutters; too loose → drift returns]** → Tie `MAX_INTERP` to the actual emit cadence (~1s); the cap only bounds the gap beyond a normal tick, so a healthy stream looks continuous while a dead stream freezes within ~1 tick.
- **[Backward-compat path rots]** → Keep the fallback minimal and clearly marked; the primary path is server-driven. Verifier confirms both branches.
- **[Removing `currentRunningDoc` breaks auto-load snapshot]** → auto-load still rebuilds the 4 stage payloads for the static (non-donut) fields; only the donut-seeding role of `currentRunningDoc` is removed. Confirm the last-value snapshot rendering is untouched.

## Migration Plan

1. Server first: add `stageStartMs` + `stage_elapsed_ms` (additive payload). Deployed server is compatible with the current client (client ignores unknown field).
2. Client second: consume `stage_elapsed_ms` with the backward-compat fallback. A new client against an old server still works via fallback; a new client against the new server uses the server value.
3. Rollback: revert the client and/or server commit independently; the additive field and fallback make each side independently revertible. `view_home.ejs` remains as a full rollback.

## Open Questions

- None blocking. `MAX_INTERP` exact value is an implementation tuning constant (bounded by emit cadence); pick ~2× the observed emit gap during implementation.
