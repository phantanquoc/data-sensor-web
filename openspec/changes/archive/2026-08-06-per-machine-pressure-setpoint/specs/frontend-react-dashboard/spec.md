## MODIFIED Requirements

### Requirement: Pressure setpoint settings modal
The settings modal SHALL present a machine selector for fryers 1 through 8 together with four numeric inputs — one per fryer stage (GĐ1 through GĐ4) — showing the target vacuum pressure for the currently selected machine, plus a save action, a cancel action, and an action that applies the currently entered four values to all 8 machines.

#### Scenario: Machine selector present
- **WHEN** the modal is open
- **THEN** it presents a selector covering machines 1 through 8, with one machine active at a time
- **AND** the four stage inputs show the values belonging to the active machine

#### Scenario: Existing values prefilled
- **WHEN** the modal opens and a configuration has been saved previously
- **THEN** each input is prefilled with the stored value for the active machine, and stages stored as `null` render as empty inputs

#### Scenario: Switching machines preserves unsaved edits
- **WHEN** the user edits machine 3's inputs, switches to machine 5, and switches back to machine 3
- **THEN** machine 3's edited values are still present and unsaved
- **AND** machine 5's values were shown independently while it was selected

#### Scenario: Apply to all machines copies the current values
- **WHEN** the user has entered four stage values for the active machine and activates the apply-to-all action
- **THEN** all 8 machines take those four values as their pending values
- **AND** nothing is persisted until the user saves

#### Scenario: Save persists every machine
- **WHEN** the user activates save after editing more than one machine
- **THEN** a single request submits the values for all 8 machines
- **AND** every edited machine's values are persisted

#### Scenario: Loading state while fetching
- **WHEN** the modal is open and the configuration request has not yet resolved
- **THEN** the modal shows a loading indication and the save action is not available

#### Scenario: Load failure is surfaced
- **WHEN** the configuration request fails
- **THEN** the modal displays an error message and does not present stale or fabricated values

#### Scenario: Saving state blocks double submission
- **WHEN** the user activates save and the request is in flight
- **THEN** the save and cancel actions are disabled so a second request cannot be issued

#### Scenario: Save failure keeps the modal open
- **WHEN** the save request fails
- **THEN** the modal stays open, displays an error message, retains the user's entered values for every machine, and allows retrying

#### Scenario: Successful save closes the modal
- **WHEN** the save request succeeds
- **THEN** the modal closes and a toast confirms the save

#### Scenario: Cancel discards edits
- **WHEN** the user activates cancel after editing inputs for one or more machines
- **THEN** the modal closes and no request is sent, leaving the stored configuration unchanged

### Requirement: Settings modal input validation
The modal SHALL validate input client-side before issuing a request, treating an empty input as "not configured" rather than zero. Validation SHALL cover every machine's values, not only the machine currently selected.

#### Scenario: Empty input saved as null
- **WHEN** the user leaves a stage input empty and saves
- **THEN** that stage is submitted as `null` for that machine, not as `0`

#### Scenario: Decimal input accepted
- **WHEN** the user enters a decimal value such as `680.5`
- **THEN** the value is accepted and submitted unrounded

#### Scenario: Negative input blocked before request
- **WHEN** the user enters a negative value and activates save
- **THEN** an inline error message appears next to that input
- **AND** no request is sent to the server

#### Scenario: Non-numeric input blocked before request
- **WHEN** the user enters text that is not a valid number and activates save
- **THEN** an inline error message appears next to that input
- **AND** no request is sent to the server

#### Scenario: Invalid value on a non-selected machine blocks save
- **WHEN** the user enters an invalid value for machine 3, switches to machine 5, and activates save
- **THEN** no request is sent
- **AND** the modal makes clear which machine holds the invalid value so the user can reach it

### Requirement: Settings modal accessibility
The settings modal SHALL be operable by keyboard and correctly announced by assistive technology, including its machine selector.

#### Scenario: Dialog semantics
- **WHEN** the modal is open
- **THEN** its container carries `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` reference to its visible title

#### Scenario: Machine selector is keyboard operable and announces selection
- **WHEN** the user reaches the machine selector by keyboard
- **THEN** each machine control is focusable and activatable by keyboard
- **AND** the active machine is programmatically indicated, not conveyed by styling alone

#### Scenario: Escape key closes the modal
- **WHEN** the modal is open and the user presses Escape
- **THEN** the modal closes without saving

#### Scenario: Outside click closes the modal
- **WHEN** the modal is open and the user clicks outside its bounds
- **THEN** the modal closes without saving

#### Scenario: Focus is trapped while open
- **WHEN** the modal is open and the user cycles focus with Tab and Shift+Tab
- **THEN** focus remains within the modal's focusable elements, including the machine selector

#### Scenario: Focus returns to the opener on close
- **WHEN** the modal closes by any means (save, cancel, Escape, or outside click)
- **THEN** keyboard focus returns to the control that opened it

### Requirement: Configurable setpoint line label
`FleetLineChart` SHALL accept the setpoint line's legend label as a prop, defaulting to `"Nhiệt độ cài đặt"` so the temperature chart is unchanged.

#### Scenario: Pressure chart shows a pressure label
- **WHEN** the detail page's vacuum pressure chart renders its setpoint line
- **THEN** the legend shows a pressure-appropriate label, not `"Nhiệt độ cài đặt"`

#### Scenario: Temperature chart label unchanged
- **WHEN** the temperature chart renders its setpoint line without specifying a label
- **THEN** the legend shows `"Nhiệt độ cài đặt"` exactly as before this change

### Requirement: Configurable deviation warning threshold
`FleetLineChart` SHALL accept the tooltip's deviation-warning threshold as a prop, defaulting to `TEMPERATURE_WARNING_DELTA` so the temperature chart is unchanged. The pressure chart SHALL NOT apply the temperature threshold, because a 3-unit deviation is not meaningful for pressure.

#### Scenario: Temperature deviation warning unchanged
- **WHEN** a measured temperature deviates from its setpoint by at least `TEMPERATURE_WARNING_DELTA`
- **THEN** the tooltip highlights the deviation exactly as before this change

#### Scenario: Pressure deviation shown without a fabricated warning
- **WHEN** the pressure chart tooltip displays a deviation between measured and target pressure
- **THEN** the numeric deviation is shown
- **AND** no warning highlight is applied unless a pressure threshold with a documented justification has been established — an arbitrary threshold MUST NOT be invented to drive the highlight

## ADDED Requirements

### Requirement: Tooltip pairs setpoints by machine number
The chart tooltip SHALL pair each measured line with the setpoint line carrying the same machine number, for both the temperature and pressure charts. No sentinel machine number or shared-setpoint fallback SHALL remain in the pairing logic.

#### Scenario: Deviation computed against the same machine's setpoint
- **WHEN** the tooltip shows machine 3's measured pressure and machine 3 has a setpoint line
- **THEN** the deviation is computed against machine 3's setpoint value

#### Scenario: No cross-machine pairing
- **WHEN** machine 3 has a setpoint line and machine 5 does not
- **THEN** machine 5 shows no deviation
- **AND** machine 3's setpoint value is never used as machine 5's reference

#### Scenario: Sentinel pairing helper fully removed
- **WHEN** the codebase is inspected after this change
- **THEN** `frontend/src/components/sharedSetpointKey.ts` and `test/shared_setpoint_key.test.js` no longer exist
- **AND** no import of the removed module remains in `FleetLineChart.tsx`
