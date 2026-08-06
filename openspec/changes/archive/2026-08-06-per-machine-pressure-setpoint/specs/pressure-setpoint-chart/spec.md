## MODIFIED Requirements

### Requirement: Pressure setpoint series builder
The system SHALL provide a pure module under `frontend/src/hooks/` that derives a target-pressure `ChartPoint[]` for a SPECIFIC machine, from the stored per-machine configuration and an array of that machine's measured pressure `ChartPoint`s. The module SHALL be importable and testable without React, Socket.IO, or DOM — matching the `setpointBuilder.ts` pattern.

#### Scenario: Target point emitted per measured point
- **WHEN** the builder receives machine 3's measured pressure points at minutes 0, 5, and 10, all in stage 1, and machine 3's configuration sets stage 1 to `700`
- **THEN** it returns three target points at minutes 0, 5, and 10, each with value `700` and stage `1`

#### Scenario: Configuration resolved for the requested machine only
- **WHEN** machine 3 has stage 1 configured to `700` and machine 5 has stage 1 configured to `640`, and the builder is called for machine 5
- **THEN** the returned target points carry value `640`, not `700`

#### Scenario: Stage lookup spans all four stages
- **WHEN** a machine's measured points span stages 1, 2, 3, and 4 and that machine's configuration sets distinct values for all four stages
- **THEN** each returned target point carries the configured value for that point's own stage

#### Scenario: Unconfigured stage produces no target points
- **WHEN** a measured point belongs to a stage whose configured value for that machine is `null`
- **THEN** no target point is emitted for that measured point
- **AND** target points for other stages that ARE configured are still emitted

#### Scenario: Unconfigured machine produces no target points
- **WHEN** the builder is called for a machine whose configuration has no configured stage
- **THEN** it returns an empty array
- **AND** other machines that ARE configured still produce their own target points

#### Scenario: Zero and non-finite configuration treated as unconfigured
- **WHEN** a stage's configured value is `0`, `NaN`, `Infinity`, or `undefined`
- **THEN** no target point is emitted for measured points in that stage (a zero-valued line would drag the Y axis down and misrepresent a target that was never set)

#### Scenario: Machine number outside 1..8 produces no target points
- **WHEN** the builder is called with a machine number outside the range 1 through 8
- **THEN** it returns an empty array

#### Scenario: Empty measured input returns empty output
- **WHEN** the builder receives an empty array of measured points
- **THEN** it returns an empty array

#### Scenario: Negative minutes are never emitted
- **WHEN** a measured point carries a negative `phut` value
- **THEN** no target point is emitted for it (the X axis starts at batch start)

### Requirement: Pressure setpoint series in fleet history
The `useFleetHistory` hook SHALL return per-machine pressure setpoint series for BOTH the `latest` and `previous` batch generations, alongside the existing temperature `setpointSeries`. Each series SHALL carry its own machine's number, so it routes through batch rotation, REST refetch, and live socket ticks exactly as that machine's measured pressure series does.

#### Scenario: Series returned for both generations
- **WHEN** `useFleetHistory` has loaded measured pressure data for both the latest and previous batch generations and a configuration is present
- **THEN** both `latest` and `previous` include pressure setpoint series derived from the configuration

#### Scenario: Each series carries its own machine number
- **WHEN** machines 3 and 5 both have measured pressure data and configured setpoints
- **THEN** the returned series carry machine numbers 3 and 5 respectively — no sentinel or placeholder machine number is used

#### Scenario: Series follows its machine through batch rotation
- **WHEN** a machine rotates to a new batch generation and its measured pressure series moves from `latest` to `previous`
- **THEN** that machine's pressure setpoint series moves with it, staying aligned with the same generation as its measured series

#### Scenario: Configuration loaded on mount
- **WHEN** the hook mounts
- **THEN** it fetches the stored pressure setpoint configuration

#### Scenario: Saved configuration updates charts without page reload
- **WHEN** the user saves a new pressure setpoint configuration through the settings modal
- **THEN** the pressure setpoint line on the currently displayed charts reflects the new values without requiring a browser refresh

#### Scenario: Missing configuration yields no target line
- **WHEN** no configuration has been saved (every machine's stages all `null`)
- **THEN** the pressure setpoint series are empty and the pressure chart renders with only measured lines

### Requirement: Pressure target line rendered on the detail page
The vacuum pressure chart SHALL display the target line on the per-machine detail page for the machine being viewed, reusing the existing setpoint rendering path in `FleetLineChart` and `buildMerged` rather than introducing a parallel mechanism. The Overview page SHALL NOT render pressure target lines, matching how the temperature chart already omits setpoint lines there: with per-machine values, plotting 8 measured plus 8 dashed lines would obscure the measured data the chart exists to show.

#### Scenario: Detail page pressure chart receives its machine's series
- **WHEN** the per-machine detail page for machine N renders its "Áp chân không" chart
- **THEN** the pressure setpoint series for machine N is passed to the chart's setpoint props for both the latest and previous views
- **AND** no other machine's setpoint series is passed

#### Scenario: Overview pressure chart omits the target line
- **WHEN** the Overview page renders its "Áp chân không" chart
- **THEN** no pressure setpoint series is passed and no dashed target line is drawn
- **AND** this matches the Overview temperature chart, which likewise passes no setpoint series

#### Scenario: Y axis accommodates the target line
- **WHEN** the configured target lies outside the measured value range on the detail page
- **THEN** the Y axis domain expands to include the target line, via the existing `buildMerged` vMin/vMax handling

## REMOVED Requirements

### Requirement: Single target line on the pressure chart
**Reason**: This requirement existed because the configuration was fleet-wide — one shared value could only ever justify one dashed line, implemented via a sentinel series number outside the 1–8 machine range. With per-machine setpoints the premise no longer holds: each machine has its own target, so the chart must be able to render a target line per machine. Its replacement is the "Pressure target line rendered on the detail page" requirement above, which scopes the target line to the machine being viewed and removes it from the Overview page entirely.

**Migration**: The sentinel series number and the shared-setpoint tooltip pairing helper it required (`frontend/src/components/sharedSetpointKey.ts` and `test/shared_setpoint_key.test.js`) are removed along with this requirement, and `FleetLineChart` returns to pairing measured lines with setpoint lines by machine number — identical to how the temperature chart has always worked. No stored data or API contract depends on the sentinel, so nothing needs converting; the removal must be complete, leaving no unused module or import behind.
