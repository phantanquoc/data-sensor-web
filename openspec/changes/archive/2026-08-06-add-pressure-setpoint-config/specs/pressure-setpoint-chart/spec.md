## ADDED Requirements

### Requirement: Pressure setpoint series builder
The system SHALL provide a pure module under `frontend/src/hooks/` that derives a target-pressure `ChartPoint[]` from the stored per-stage configuration and an array of measured pressure `ChartPoint`s. The module SHALL be importable and testable without React, Socket.IO, or DOM — matching the `setpointBuilder.ts` pattern.

#### Scenario: Target point emitted per measured point
- **WHEN** the builder receives measured pressure points at minutes 0, 5, and 10, all in stage 1, and the configuration sets stage 1 to `700`
- **THEN** it returns three target points at minutes 0, 5, and 10, each with value `700` and stage `1`

#### Scenario: Stage lookup spans all four stages
- **WHEN** measured points span stages 1, 2, 3, and 4 and the configuration sets distinct values for all four stages
- **THEN** each returned target point carries the configured value for that point's own stage

#### Scenario: Unconfigured stage produces no target points
- **WHEN** a measured point belongs to a stage whose configured value is `null`
- **THEN** no target point is emitted for that measured point
- **AND** target points for other stages that ARE configured are still emitted

#### Scenario: Zero and non-finite configuration treated as unconfigured
- **WHEN** a stage's configured value is `0`, `NaN`, `Infinity`, or `undefined`
- **THEN** no target point is emitted for measured points in that stage (a zero-valued line would drag the Y axis down and misrepresent a target that was never set)

#### Scenario: Empty measured input returns empty output
- **WHEN** the builder receives an empty array of measured points
- **THEN** it returns an empty array

#### Scenario: Negative minutes are never emitted
- **WHEN** a measured point carries a negative `phut` value
- **THEN** no target point is emitted for it (the X axis starts at batch start)

### Requirement: Pressure setpoint series in fleet history
The `useFleetHistory` hook SHALL return a pressure setpoint series for BOTH the `latest` and `previous` batch generations, alongside the existing temperature `setpointSeries`.

#### Scenario: Series returned for both generations
- **WHEN** `useFleetHistory` has loaded measured pressure data for both the latest and previous batch generations and a configuration is present
- **THEN** both `latest` and `previous` include a pressure setpoint series derived from the same configuration

#### Scenario: Configuration loaded on mount
- **WHEN** the hook mounts
- **THEN** it fetches the stored pressure setpoint configuration

#### Scenario: Saved configuration updates charts without page reload
- **WHEN** the user saves a new pressure setpoint configuration through the settings modal
- **THEN** the pressure setpoint line on the currently displayed charts reflects the new values without requiring a browser refresh

#### Scenario: Missing configuration yields no target line
- **WHEN** no configuration has been saved (all four stages `null`)
- **THEN** the pressure setpoint series is empty and the pressure chart renders exactly as it does today, with only measured lines

### Requirement: Single target line on the pressure chart
Because the configuration is fleet-wide, the vacuum pressure chart SHALL render exactly ONE dashed target line regardless of how many machines are plotted — not one target line per machine.

#### Scenario: Overview page with multiple machines running
- **WHEN** the Overview page plots measured pressure for several machines and a configuration is present
- **THEN** the chart renders exactly one dashed pressure target line

#### Scenario: Detail page for a single machine
- **WHEN** the per-machine detail page plots one machine's measured pressure and a configuration is present
- **THEN** the chart renders exactly one dashed pressure target line

### Requirement: Pressure target line rendered on both pages
The vacuum pressure chart SHALL display the target line on the Overview page and on the per-machine detail page, reusing the existing setpoint rendering path in `FleetLineChart` and `buildMerged` rather than introducing a parallel mechanism.

#### Scenario: Overview pressure chart receives the series
- **WHEN** the Overview page renders its "Áp chân không" chart
- **THEN** the pressure setpoint series is passed to the chart's setpoint props for both the latest and previous views

#### Scenario: Detail page pressure chart receives the series
- **WHEN** the per-machine detail page renders its "Áp chân không" chart
- **THEN** the pressure setpoint series is passed to the chart's setpoint props for both the latest and previous views

#### Scenario: Y axis accommodates the target line
- **WHEN** the configured target lies outside the measured value range
- **THEN** the Y axis domain expands to include the target line, via the existing `buildMerged` vMin/vMax handling
