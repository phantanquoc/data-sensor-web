## 1. Server: stage-start RAM state

- [x] 1.1 Add `const stageStartMs = {}` in `controller/post_data_plc.js` alongside existing RAM maps; initialize per fryer `n` as `{1:null,2:null,3:null,4:null}` where `pushCount`/`id_document` are initialized
- [x] 1.2 Add a local `parseTs("HH:MM:SS DD/MM/YYYY")` helper in the server module (do not import client code) for restart re-seeding

## 2. Server: rising-edge tracking + elapsed computation

- [x] 2.1 Before building `stagesArray` in `postDataPlc`, compute the four active booleans (reuse the exact `giai_doan_k && typeof giai_doan_k === "boolean"` test already used at the emit site)
- [x] 2.2 Transition logic per stage k: inactive→active sets `stageStartMs[n][k] = Date.now()`; active→inactive sets it to null; active→active leaves it unchanged
- [x] 2.3 Restart re-seed: if a stage is active but `stageStartMs[n][k]` is null AND the running doc's `giai_doan_k.bien_du_lieu[1].thoi_gian` exists, seed `stageStartMs[n][k]` from that parsed timestamp; fall back to `Date.now()` if missing/unparseable
- [x] 2.4 Compute `stage_elapsed_ms` = `Date.now() - stageStartMs[n][activeK]` clamped ≥ 0 for the active stage, or `null` when no stage is active ← (verify: transition table correct; restart seeds from bien_du_lieu[1] not zero; null when idle)

## 3. Server: emit + snapshot

- [x] 3.1 Attach `stage_elapsed_ms` to the emitted `noi_chien_N_data` payload (top-level, alongside the 4-stage array) without changing any existing field
- [x] 3.2 Include `stage_elapsed_ms` in the cached `latestStages[n]` so the join-snapshot (`getLatestStages`) carries it ← (verify: payload additive only; existing fields byte-identical; snapshot includes the field)

## 4. Client: types

- [x] 4.1 Add `stage_elapsed_ms?: number | null` to the data-event payload type in `client/src/types/index.ts` (event-level, matching where the 4-stage array is typed)

## 5. Client: consume server elapsed

- [x] 5.1 In `client/src/hooks/useFryerData.ts`, change donut state to hold `{ stage, elapsedMs, receivedAt, targetMin }` (server value + receipt time) instead of `startMs`
- [x] 5.2 On a data event with numeric `stage_elapsed_ms`: set donut for the active stage from the server value; on `null`: clear the donut
- [x] 5.3 Remove `currentRunningDoc` donut-seeding role and the rising-edge `startMs` seeding; keep the auto-load rebuild of static stage fields intact ← (verify: auto-load still shows last-value snapshot; donut no longer reconstructed from doc on the primary path)
- [x] 5.4 Backward-compat: when `stage_elapsed_ms` is `undefined` in the payload, retain a minimal document-seed fallback so the donut still renders against an old server ← (verify: both branches present; missing field does not throw)

## 6. Client: DonutTimer display

- [x] 6.1 Change `DonutTimer` props to accept `elapsedMs` + `receivedAt` (+ existing `targetMin`) instead of `startMs`
- [x] 6.2 Display `displayedMs = serverElapsedMs + min(Date.now() - receivedAt, MAX_INTERP)` so it interpolates smoothly each second but caps to freeze when no new value arrives; `MAX_INTERP` ≈ 2× the emit gap
- [x] 6.3 Keep all existing visual output identical (radius 27, circumference 169.646, color `#00aaff`/`#fd7e14` overtime, center text "elapsed / target" + "phút", 1s tick) ← (verify: freeze-on-stall works; overtime color still triggers; visual parity with current donut)

## 7. Verify + build

- [x] 7.1 `npm --prefix client run build` passes clean (tsc + vite)
- [x] 7.2 `openspec validate server-authoritative-stage-timer --strict` passes
- [ ] 7.3 Manual/logical check against the running backend (port 3001): active stage shows server elapsed matching EJS; stalled batch freezes; restart mid-batch does not reset to 0 ← (verify: end-to-end elapsed matches server clock; no drift; no browser-clock dependence)
