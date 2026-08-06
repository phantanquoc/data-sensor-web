## 1. Backend: schema with a machine dimension

- [x] 1.1 Change `backend/model/cai_dat_he_thong_schema.js` so `ap_suat_cai_dat` holds four stage values for each machine 1 through 8, keeping every value `Number` with `default: null` — `null` means "not configured", and defaulting to `0` would draw a target line at zero that drags the Y axis down
- [x] 1.2 Rewrite the schema's header comment: it currently states "Lý do phẳng, không có chiều máy" (the reason it is flat with no machine dimension), which becomes false with this change — a comment contradicting the code is worse than none ← (verify: 1-based machine keys 1..8 per design.md D1, all values nullable Numbers, single singleton document retained, no comment left asserting the flat rationale)

## 2. Backend: legacy expansion (highest-consequence step)

- [x] 2.1 Add a pure function that takes a stored configuration document and returns the per-machine shape: a legacy flat document's four values apply to all 8 machines, an already-per-machine document passes through unchanged, and a missing or empty document yields 8 machines of all-`null`
- [x] 2.2 Keep the function free of Mongoose and database access so it is unit-testable in isolation — this is the single point where a defect silently destroys the operator's live configuration ← (verify: flat 700/680/660/640 expands to all 8 machines; legacy `null` expands as `null` not `0`; per-machine input is returned untouched; pure function, no DB dependency, per design.md D2)

## 3. Backend: read and write endpoints

- [x] 3.1 Update the read handler so `GET /cai_dat_he_thong` routes the stored document through the expansion from task 2 and returns all 8 machines, still responding HTTP 200 with all-`null` values when no document exists (never 404)
- [x] 3.2 Extend validation to all 32 values plus machine-number range: accept `null` and finite numbers `>= 0`, reject negatives, `NaN`, `Infinity`, non-numeric strings, booleans, arrays, objects, and machine numbers outside 1..8
- [x] 3.3 Keep validation fully ahead of any write so one invalid value blocks the entire save, and return HTTP 400 with a Vietnamese `{ error }` naming the offending machine and stage, matching the error shape of the other handlers in `backend/controller/home.js`
- [x] 3.4 Update the write handler to persist all 8 machines with `upsert: true`, and confirm the routes in `backend/router/home.js` still sit behind the existing `app.use(auth.requireAuth, home)` mount with no per-route middleware added ← (verify: unauthenticated request returns 401; invalid value for machine 8 leaves machines 1-7 unwritten; decimal 680.5 round-trips unrounded; first save after a legacy read persists the per-machine shape)

## 4. Frontend: types and API client

- [x] 4.1 Update the configuration type in `frontend/src/types/index.ts` to carry the machine dimension
- [x] 4.2 Update the read and write functions in `frontend/src/api/index.ts` for the new body shape, keeping both on the shared `readJson` helper so the 401-redirect behavior survives ← (verify: both functions still go through `readJson`, not a bare `fetch().json()`)

## 5. Frontend: per-machine series builder

- [x] 5.1 Change `frontend/src/hooks/pressureSetpointBuilder.ts` to resolve the configuration for a specific machine, keeping the module free of React and Socket.IO imports
- [x] 5.2 Preserve every existing rule: `0`, `null`, `undefined`, `NaN`, and `Infinity` mean "not configured" and emit nothing; negative `phut` is skipped; empty input returns empty; all four stages are covered. Add: a machine number outside 1..8 returns empty ← (verify: builder called for machine 5 returns machine 5's values, never machine 3's; an unconfigured machine returns empty while configured machines still produce points)

## 6. Frontend: fleet history wiring

- [x] 6.1 Change `buildApSetpointSeries` in `frontend/src/hooks/useFleetHistory.ts` to emit one series per machine, each carrying its own machine number — remove the `AP_SETPOINT_SERIES_N = 0` sentinel
- [x] 6.2 Derive each machine's target series from that machine's own measured points rather than the union of all machines' minute marks; the per-machine measured arrays are already capped at `MAX_POINTS`, so the union's `capPoints` compensation is no longer needed (design.md D5)
- [x] 6.3 Keep the derivation inside `pushState` working from the already-routed measured arrays, so batch rotation (`genRef`/`fleetGenRef`), REST refetch, and live socket ticks are inherited rather than hand-mirrored ← (verify: a machine rotating to a new generation carries its target series with it, staying aligned with its own measured series; no code path can desync target from measured)

## 7. Frontend: remove the sentinel mechanism

- [x] 7.1 Delete `frontend/src/components/sharedSetpointKey.ts` and `test/shared_setpoint_key.test.js`
- [x] 7.2 Remove the import and call from `frontend/src/components/FleetLineChart.tsx` so the tooltip pairs `m${n}` with `s${n}` by machine number — the behavior the temperature chart had before the sentinel existed
- [x] 7.3 Keep both existing props at their current defaults (`setpointLabel` defaulting to `"Nhiệt độ cài đặt"`, `deviationWarningThreshold` defaulting to `TEMPERATURE_WARNING_DELTA`) so the temperature charts are unchanged ← (verify: no orphaned import or reference to the deleted module anywhere; temperature charts on both pages render identically to before; machine 3's setpoint is never used as machine 5's reference)

## 8. Frontend: settings modal with machine selector

- [x] 8.1 Add a machine selector for fryers 1 through 8 to `frontend/src/components/CaiDatHeThongModal.tsx`, with the four stage inputs showing the active machine's values, Vietnamese labels throughout
- [x] 8.2 Hold pending edits for all 8 machines in modal state so switching machines never discards unsaved work, and submit every machine in a single save request
- [x] 8.3 Add an "apply to all machines" action that copies the active machine's four entered values to all 8 machines without persisting anything until save
- [x] 8.4 Run validation across all 8 machines' pending values, not only the visible one, and when a hidden machine holds the invalid value make that machine reachable so the user can see the cause (design.md D6)
- [x] 8.5 Preserve every existing behavior: the five states (loading, load error, saving with actions disabled against double-submit, save error keeping the modal open with values retained and retry allowed, success closing with a toast); empty input submitting as `null` not `0`; decimals accepted; negatives and non-numeric input blocked inline with no network call
- [x] 8.6 Preserve and extend accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape and outside-click to close, focus trap covering the new selector, focus returned to the opener on every close path, and the active machine indicated programmatically rather than by styling alone ← (verify: edit machine 3, switch to 5, switch back — machine 3's edits intact; every close path restores focus to the opener; Tab and Shift+Tab stay inside the modal including the selector)

## 9. Frontend: page wiring

- [x] 9.1 Remove the setpoint props from the "Áp chân không" chart in `frontend/src/pages/Overview.tsx` (`latestSetpointSeries`, `previousSetpointSeries`, `setpointLabel`, `deviationWarningThreshold`) so it matches the Overview temperature chart beside it, which passes no setpoint series; keep the "Cài đặt hệ thống" dropdown entry
- [x] 9.2 Pass the target series for the machine being viewed (`soNoiChien`) into the "Áp chân không" chart in `frontend/src/pages/FryerDetail.tsx`
- [x] 9.3 Keep the saved-configuration propagation in `frontend/src/hooks/apSuatCaiDatStore.ts` so charts update after a save without a page reload ← (verify: Overview draws no dashed pressure line; detail page for machine N draws machine N's target and no other machine's; saving in the modal updates the visible chart without a refresh)

## 10. Tests and checks

- [x] 10.1 Update `test/pressure_setpoint_builder.test.js` for the new signature, covering per-machine resolution, one machine configured while another is not, `0`/`null`/`NaN`/`Infinity`/`undefined` producing no points, negative `phut` skipped, empty input returning empty, and machine numbers outside 1..8
- [x] 10.2 Add a test file for the legacy expansion function following the existing `node:test` conventions in `test/`: flat document with values expands to all 8 machines, legacy `null` stays `null`, per-machine input passes through unchanged, missing or empty document yields 8 machines of all-`null`
- [x] 10.3 Run `npm test` from the workspace root and confirm zero failures — the count changes because tests are updated and `shared_setpoint_key.test.js` is deleted, but no suite may fail, especially `generational_chart.test.js`, `per_machine_chart.test.js`, `refetch_on_rotation.test.js`, `fleet_history_guard.test.js`, `fleet_chart_data.test.js`, and `setpoint_builder.test.js`
- [x] 10.4 Run `npm run build:client` and confirm the TypeScript build succeeds
- [x] 10.5 Rebuild the running stack with `docker compose -f docker-compose.local.yml up -d --build` from the workspace root
- [x] 10.6 Verify the migration against the REAL running database: log in using `AUTH_USER`/`AUTH_PASS` from `.env`, call `GET /cai_dat_he_thong` through `http://localhost:8090`, and confirm all 8 machines report the operator's existing flat configuration ← (verify: this is evidence from live data, not reasoning — report the actual response; report test and build output truthfully, and never suppress, skip, or work around a failing suite)

  Evidence: the stored document was still in the legacy flat shape
  (`ap_suat_cai_dat: { giai_doan_1: 800, giai_doan_2: 650, giai_doan_3: 700, giai_doan_4: 750 }`,
  `updatedAt` 2026-08-06T07:57:30.718Z). `GET /cai_dat_he_thong` through Caddy on
  :8090 returned all 8 machines carrying exactly 800/650/700/750. Note: the
  operator's live values are 800/650/700/750, NOT the 700/680/660/640 assumed
  when this task was written — the expansion reproduces whatever is stored.
