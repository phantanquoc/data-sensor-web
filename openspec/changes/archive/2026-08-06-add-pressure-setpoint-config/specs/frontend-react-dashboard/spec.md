## ADDED Requirements

### Requirement: System settings entry in the machine picker
The machine-picker dropdown on the Overview page SHALL include a "Cài đặt hệ thống" entry positioned after the eight machine entries and visually separated from them by a divider.

#### Scenario: Entry rendered at the bottom of the dropdown
- **WHEN** the user opens the machine-picker dropdown
- **THEN** the eight machine entries are listed first, followed by a divider, followed by a "Cài đặt hệ thống" entry carrying a lucide icon and `role="menuitem"`

#### Scenario: Entry opens the settings modal
- **WHEN** the user activates the "Cài đặt hệ thống" entry
- **THEN** the dropdown closes and the settings modal opens

#### Scenario: Machine navigation unaffected
- **WHEN** the user activates any of the eight machine entries
- **THEN** navigation to `/may/<n>` behaves exactly as before the settings entry was added

### Requirement: Pressure setpoint settings modal
The settings modal SHALL present four numeric inputs — one per fryer stage (GĐ1 through GĐ4) — for the target vacuum pressure, together with a save action and a cancel action.

#### Scenario: Existing values prefilled
- **WHEN** the modal opens and a configuration has been saved previously
- **THEN** each input is prefilled with its stored value, and stages stored as `null` render as empty inputs

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
- **THEN** the modal stays open, displays an error message, retains the user's entered values, and allows retrying

#### Scenario: Successful save closes the modal
- **WHEN** the save request succeeds
- **THEN** the modal closes and a toast confirms the save

#### Scenario: Cancel discards edits
- **WHEN** the user activates cancel after editing inputs
- **THEN** the modal closes and no request is sent, leaving the stored configuration unchanged

### Requirement: Settings modal input validation
The modal SHALL validate input client-side before issuing a request, treating an empty input as "not configured" rather than zero.

#### Scenario: Empty input saved as null
- **WHEN** the user leaves a stage input empty and saves
- **THEN** that stage is submitted as `null`, not as `0`

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

### Requirement: Settings modal accessibility
The settings modal SHALL be operable by keyboard and correctly announced by assistive technology.

#### Scenario: Dialog semantics
- **WHEN** the modal is open
- **THEN** its container carries `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` reference to its visible title

#### Scenario: Escape key closes the modal
- **WHEN** the modal is open and the user presses Escape
- **THEN** the modal closes without saving

#### Scenario: Outside click closes the modal
- **WHEN** the modal is open and the user clicks outside its bounds
- **THEN** the modal closes without saving

#### Scenario: Focus is trapped while open
- **WHEN** the modal is open and the user cycles focus with Tab and Shift+Tab
- **THEN** focus remains within the modal's focusable elements

#### Scenario: Focus returns to the opener on close
- **WHEN** the modal closes by any means (save, cancel, Escape, or outside click)
- **THEN** keyboard focus returns to the control that opened it

### Requirement: Configurable setpoint line label
`FleetLineChart` SHALL accept the setpoint line's legend label as a prop, defaulting to `"Nhiệt độ cài đặt"` so the temperature chart is unchanged.

#### Scenario: Pressure chart shows a pressure label
- **WHEN** the vacuum pressure chart renders its setpoint line
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
