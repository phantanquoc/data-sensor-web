## Why

The vacuum pressure chart ("Áp chân không") plots measured values read from the PLC (float LE from D4+D5, field `ap_suat_chan_khong`) but has no target line to compare against, so an operator looking at the curve cannot tell whether the machine is running correctly. The temperature chart already solves this — it draws a dashed setpoint line from `nhiet_do_cai_dat` (D500/D502/D504) — but the PLC exposes no equivalent setpoint register for pressure, so the target values must be entered by hand.

## What Changes

- **New "Cài đặt hệ thống" menu entry** at the bottom of the machine-picker dropdown on the Overview page, separated from the 8 machine entries by a divider. Opens a settings modal.
- **New settings modal** with four numeric inputs (one per fryer stage GĐ1–GĐ4) for the target vacuum pressure, plus Save/Cancel. Full state coverage: loading, load error, saving (buttons disabled to block double-submit), save error (modal stays open, retry allowed), save success (modal closes, toast shown).
- **New server-side config store**: a singleton MongoDB document holding the four pressure setpoints, exposed through a read endpoint and a write endpoint. Values are shared by all 8 machines and by every browser/device.
- **Pressure setpoint line on the vacuum pressure chart** on BOTH the Overview page and the per-machine detail page — a single dashed step line (not one per machine), rendered through the existing setpoint infrastructure in `FleetLineChart` / `fleetChartData`.
- **Two `FleetLineChart` generalizations required to avoid visible defects**: the setpoint line name is currently hard-coded to `"Nhiệt độ cài đặt"`, and the tooltip deviation warning is hard-wired to the temperature constant `TEMPERATURE_WARNING_DELTA`. Both become props with the current values as defaults, so the temperature chart is unchanged while the pressure chart gets a correct label and an appropriate (or absent) warning threshold.
- **Empty input means "not configured"**, not zero — a stage left blank draws no target segment for that stage.

Not breaking: all existing endpoints, socket payloads, and the temperature setpoint line keep their current behavior.

## Capabilities

### New Capabilities
- `system-config`: Server-persisted operating configuration shared across all machines and clients — the per-stage vacuum pressure setpoints, their REST read/write endpoints, validation rules, and authentication requirement.
- `pressure-setpoint-chart`: Deriving a target-pressure series from the stored configuration and the measured pressure points, and rendering it as a dashed reference line on the vacuum pressure chart on both pages.

### Modified Capabilities
- `frontend-react-dashboard`: The machine-picker dropdown gains a "Cài đặt hệ thống" entry and an associated modal dialog; `useFleetHistory` additionally returns a pressure setpoint series for both the latest and previous batch generations; `FleetLineChart` accepts a configurable setpoint label and deviation-warning threshold instead of temperature-specific hard-coded values.

## Impact

- **Backend files**: `backend/model/` (new config model), `backend/controller/home.js` (read + write handlers), `backend/router/home.js` (route registration). Routes are mounted behind `app.use(auth.requireAuth, home)` in `backend/app.js`, so they inherit authentication with no new middleware.
- **Frontend files**: `frontend/src/pages/Overview.tsx` (menu entry, modal mount, chart wiring), `frontend/src/pages/FryerDetail.tsx` (chart wiring), `frontend/src/components/FleetLineChart.tsx` (label + threshold props), `frontend/src/api/index.ts` (two API functions), `frontend/src/hooks/useFleetHistory.ts` (pressure setpoint series for latest + previous), `frontend/src/types/index.ts` (config type).
- **New frontend files**: settings modal component under `frontend/src/components/`, pressure-setpoint series builder under `frontend/src/hooks/` (pure module, testable without React, following the `setpointBuilder.ts` pattern).
- **APIs**: two new authenticated routes for reading and writing the configuration. No change to existing route shapes.
- **Database**: one new small collection holding a single document; created on first save via upsert, so no migration or seeding step.
- **Tests**: new test file for the series builder following `test/setpoint_builder.test.js` (node:test plus the `.ts` resolve hook). Existing suites that touch the same code path — `setpoint_builder.test.js`, `fleet_chart_data.test.js`, `per_machine_chart.test.js`, `generational_chart.test.js` — must stay green.
- **Dependencies**: none added or removed.

## Out of Scope

- Changing the `"bar"` unit label on the pressure chart. The measured magnitudes (e.g. 680, 720 in existing tests) suggest mmHg rather than bar, but correcting the unit is a separate concern the user explicitly did not request here.
- Writing configured values back to the PLC or HMI. These numbers exist purely to draw a reference line.
- Altering the existing temperature setpoint behavior or `setpointBuilder.ts`.
- Adding the settings entry to the `TabBar.tsx` sidebar on the detail page.
- Touching Modbus address offsets — the `+1` offsets are intentional and user-confirmed.
- Per-machine pressure setpoint overrides. The stored configuration is fleet-wide by decision; per-machine overrides can be layered on later if operations ever needs them.
