## 1. Backend: configuration model

- [x] 1.1 Create a Mongoose model for the system configuration under `backend/model/` — a singleton document holding four vacuum pressure setpoints (`giai_doan_1` through `giai_doan_4`), each `Number` with `default: null` so an unsaved stage reads back as `null` rather than `0`
- [x] 1.2 Export the model following the existing `module.exports` convention in `backend/model/plc_schema.js` ← (verify: schema matches design.md D1/D6 — nullable Numbers, no per-machine dimension, no required fields that would block a partial save)

## 2. Backend: read and write endpoints

- [x] 2.1 Add a validation helper in `backend/controller/home.js` accepting `null` or a finite number `>= 0` and rejecting negatives, `NaN`, `Infinity`, and non-numeric strings — accepting `0` as valid per design.md D5
- [x] 2.2 Implement the `GET /cai_dat_he_thong` handler returning the four setpoints, responding HTTP 200 with all four values `null` when no document exists (never 404)
- [x] 2.3 Implement the `PUT /cai_dat_he_thong` handler writing all four values with `upsert: true`, returning HTTP 400 and a Vietnamese `{ error: ... }` matching the existing error shape in this file when validation fails, and returning the saved values on success
- [x] 2.4 Register both routes in `backend/router/home.js` so they sit behind the existing `app.use(auth.requireAuth, home)` mount in `backend/app.js` — do NOT attach per-route auth middleware ← (verify: unauthenticated request returns 401; first-ever PUT creates the document without seeding; decimal such as 680.5 round-trips unrounded; negative value rejected with no write)

## 3. Frontend: API client and types

- [x] 3.1 Add the configuration type to `frontend/src/types/index.ts` (four stage values, each `number | null`)
- [x] 3.2 Add read and write functions to `frontend/src/api/index.ts` using the shared `readJson` helper so the existing 401-redirect behavior is preserved ← (verify: both functions go through `readJson`, not a bare `fetch().json()`, otherwise session expiry silently fails)

## 4. Frontend: pressure setpoint series builder

- [x] 4.1 Create a pure builder module under `frontend/src/hooks/` following the `setpointBuilder.ts` pattern — no React, no socket imports — that maps measured pressure `ChartPoint[]` to target `ChartPoint[]` by looking up each point's own stage in the configuration
- [x] 4.2 Treat `0`, `null`, `undefined`, `NaN`, and `Infinity` as "not configured" and emit no point for those stages; skip points with negative `phut`; return an empty array for empty input ← (verify: matches design.md D4/D5 — derived from measured points so X range aligns exactly with the measured line; a zero-valued config must NOT produce a line, per the Y-axis squashing reason documented in `test/setpoint_builder.test.js`)

## 5. Frontend: chart component generalization

- [x] 5.1 Add a setpoint legend label prop to `FleetLineChart.tsx`, defaulting to `"Nhiệt độ cài đặt"`, replacing the hard-coded `name` on the setpoint `Line` (~line 329)
- [x] 5.2 Add a deviation warning threshold prop, defaulting to `TEMPERATURE_WARNING_DELTA`, replacing the hard-wired constant in the tooltip deviation check (~line 92); allow the pressure chart to show the deviation number with no warning highlight, per design.md D8 — do NOT invent a pressure threshold ← (verify: temperature charts on both pages render identically to before — same legend text, same warning behavior — since both props default to today's values)

## 6. Frontend: settings modal

- [x] 6.1 Create the settings modal component under `frontend/src/components/` with four numeric inputs (GĐ1–GĐ4) plus save and cancel actions, Vietnamese labels and copy
- [x] 6.2 Implement all five states: loading while fetching, load error, saving with both actions disabled to block double-submit, save error keeping the modal open with entered values retained and retry allowed, and save success closing the modal
- [x] 6.3 Prefill inputs from stored values, rendering `null` as an empty input; submit an empty input as `null`, never `0`
- [x] 6.4 Validate client-side before requesting: accept decimals, reject negatives and non-numeric input with an inline message next to the offending input and no network call
- [x] 6.5 Implement accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the visible title, Escape and outside-click to close (following the `mousedown` + `keydown` effect pattern at `Overview.tsx:46-63`), focus trap while open, and focus returned to the opening control on close by any path ← (verify: every close path — save, cancel, Escape, outside click — restores focus to the opener; Tab and Shift+Tab stay inside the modal)

## 7. Frontend: menu entry and chart wiring

- [x] 7.1 Add the "Cài đặt hệ thống" entry to the machine-picker dropdown in `Overview.tsx`, positioned after the eight machine entries, separated by a divider, with a lucide icon and `role="menuitem"`; activating it closes the dropdown and opens the modal
- [x] 7.2 Extend `useFleetHistory.ts` to fetch the configuration on mount and derive a pressure target series for BOTH the `latest` and `previous` generations, mirroring how the existing temperature `spPts` / `latestSpPtsRef` / `prevSpPtsRef` values are routed through batch rotation and REST refetch
- [x] 7.3 Propagate a saved configuration to the charts so the target line updates without a page reload (design.md D9)
- [x] 7.4 Pass the pressure target series into the "Áp chân không" chart on BOTH `Overview.tsx` (~lines 219-224) and `FryerDetail.tsx` (~lines 229-234), with a pressure-appropriate legend label ← (verify: exactly ONE dashed target line renders even with 8 machines plotted — the fleet-wide config must not be fanned out per machine; Y axis expands to include a target lying outside the measured range)

## 8. Tests and checks

- [x] 8.1 Add a test file for the builder following `test/setpoint_builder.test.js` exactly (node:test, `node:assert/strict`, the `register` resolve hook for extensionless `.ts` imports): per-stage mapping across all four stages, `0`/`null`/`NaN`/`Infinity`/`undefined` producing no points, negative `phut` skipped, empty input returning empty
- [x] 8.2 Run `npm test` from the workspace root and confirm every existing suite still passes — especially `setpoint_builder.test.js`, `fleet_chart_data.test.js`, `per_machine_chart.test.js`, `generational_chart.test.js`, `refetch_on_rotation.test.js`, and `fleet_history_guard.test.js`, which cover the code paths this change touches
- [x] 8.3 Run `npm run build:client` and confirm the TypeScript build succeeds ← (verify: report actual test and build output truthfully — a failing suite must be reported as failing, never suppressed, skipped, or worked around)
