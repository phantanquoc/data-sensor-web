## Why

The vacuum pressure setpoint feature shipped today stores ONE set of four values shared by all 8 fryers. That was a deliberate decision (`add-pressure-setpoint-config` design D2: target pressure is a property of the frying recipe, not of an individual vessel), and the same design explicitly anticipated this reversal: its Non-Goals section records that "per-machine pressure targets… can be layered on later if operations ever needs them," and D2 notes that "storing flat now and layering per-machine overrides later is a strictly easier migration than collapsing per-machine values into a shared one."

Operations now needs exactly that. The assumption that all 8 machines run the same recipe does not hold in practice, so the shared value cannot serve as a meaningful reference line for any machine that deviates from it.

## What Changes

- **Storage gains a machine dimension**: 8 machines × 4 stages = 32 values, replacing the flat 4-value shape. Each value remains a non-negative number or `null` ("not configured").
- **Automatic migration of existing configuration**: the running production database holds a flat document (values 700/680/660/640 in the live stack). On read, a flat document is interpreted as those four values applying to all 8 machines, so the operator loses nothing and performs no manual step.
- **Settings modal gains a machine selector**: a 1–8 selector plus the four stage inputs for the currently selected machine, and an "apply to all machines" action so a fleet running one recipe is still a single entry rather than 32 keystrokes. Switching machines preserves in-progress edits for the other machines.
- **Overview page stops drawing the pressure target line**; the per-machine detail page draws the target line for that machine only. With per-machine values, an 8-machine Overview chart would carry 8 measured plus 8 dashed lines. This mirrors what the temperature chart already does — Overview passes no setpoint props, only the detail page does — so both charts behave consistently.
- **BREAKING (internal)**: the fleet-wide sentinel series number and the shared-setpoint tooltip pairing it required are removed. Tooltip pairing returns to matching by machine number, identical to the temperature chart. The dedicated `sharedSetpointKey` module and its test exist solely to serve the sentinel and must not be left behind as dead code.

## Capabilities

### New Capabilities
<!-- None — this change modifies the behavior of three existing capabilities. -->

### Modified Capabilities
- `system-config`: storage shape gains a per-machine dimension; read and write endpoints carry 8 machines × 4 stages; validation extends to 32 values and to machine-number range; reads must additionally understand the legacy flat document and expand it across all machines.
- `pressure-setpoint-chart`: the builder resolves the configuration for a specific machine; the fleet history hook produces one target series per machine carrying that machine's own number; the "exactly one dashed line" requirement is replaced by per-machine lines; the Overview page no longer renders the target line.
- `frontend-react-dashboard`: the settings modal gains a machine selector and an apply-to-all action while retaining every existing state, validation, and accessibility behavior.

## Impact

- **Backend files**: `backend/model/cai_dat_he_thong_schema.js` (shape plus the comment that currently states the opposite design rationale), `backend/controller/home.js` (read handler including legacy expansion, write handler including 32-value validation), `backend/router/home.js` (route registration unchanged in path and auth posture).
- **Frontend files**: `frontend/src/types/index.ts`, `frontend/src/api/index.ts`, `frontend/src/hooks/pressureSetpointBuilder.ts`, `frontend/src/hooks/useFleetHistory.ts`, `frontend/src/hooks/apSuatCaiDatStore.ts`, `frontend/src/components/CaiDatHeThongModal.tsx`, `frontend/src/components/FleetLineChart.tsx`, `frontend/src/pages/Overview.tsx`, `frontend/src/pages/FryerDetail.tsx`.
- **Frontend files removed**: `frontend/src/components/sharedSetpointKey.ts` and its import in `FleetLineChart.tsx`.
- **APIs**: `GET` and `PUT /cai_dat_he_thong` keep their paths and authentication but change request and response body shape. No other endpoint is affected.
- **Database**: same collection and same singleton key. No migration script runs — legacy documents are expanded on read, and the first write after this change persists the new shape.
- **Tests**: `test/pressure_setpoint_builder.test.js` updated for the new signature; `test/shared_setpoint_key.test.js` removed with the module it covers; new coverage for the legacy-to-per-machine expansion, which is the one place where a defect silently destroys a live operator's configuration.
- **Dependencies**: none added or removed.

## Out of Scope

- Changing the `"bar"` unit label on the pressure chart. The measured magnitudes still suggest mmHg; correcting the unit remains its own concern.
- Writing configured values back to the PLC or HMI.
- Any change to the temperature setpoint path (`setpointBuilder.ts`) or to the temperature charts' rendered output.
- Introducing a pressure deviation warning threshold. The tooltip continues to show the deviation number without a warning highlight.
- Adding the settings entry to the `TabBar.tsx` sidebar on the detail page.
- Modbus address offsets — the `+1` rule is intentional and user-confirmed.
- The reverse-proxy route configuration (`frontend/Caddyfile`, `frontend/Caddyfile.local`, `frontend/vite.config.ts`). These already forward `/cai_dat_he_thong*` correctly and the endpoint paths do not change.
