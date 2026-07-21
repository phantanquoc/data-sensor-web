## MODIFIED Requirements

### Requirement: Consolidated per-fryer data event

For each read cycle of a fryer, the server SHALL emit a single `noi_chien_N_data` event whose payload is an array of the 4 stage objects, instead of 4 separate emits. Each stage object SHALL preserve today's fields exactly: `data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, and `set_giai_doan`. The event payload SHALL additionally carry a server-computed `stage_elapsed_ms` field representing the currently active stage's elapsed run time in milliseconds, or `null` when no stage is active. Adding `stage_elapsed_ms` SHALL NOT alter any existing field.

#### Scenario: One event per fryer per cycle
- **WHEN** a fryer completes a read cycle and emits its data
- **THEN** the server emits exactly one `noi_chien_N_data` event carrying an array of 4 stage objects
- **AND** each stage object contains the same `data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, and `set_giai_doan` content that the 4 separate events carried before

#### Scenario: Fleet emit count reduced
- **WHEN** all 8 fryers complete a cycle
- **THEN** the server emits 8 data events total (one per fryer) rather than 32

#### Scenario: Payload carries server elapsed for the active stage
- **WHEN** a fryer has an active stage and emits `noi_chien_N_data`
- **THEN** the payload includes `stage_elapsed_ms` equal to the server-computed elapsed time of that active stage
- **AND** all previously defined stage fields are unchanged

#### Scenario: Payload elapsed is null when nothing is active
- **WHEN** a fryer has no active stage (idle, or between stages) and emits `noi_chien_N_data`
- **THEN** `stage_elapsed_ms` is `null`

## ADDED Requirements

### Requirement: Server owns active-stage elapsed time

The server SHALL compute each fryer's active-stage elapsed time from an in-memory stage-start timestamp, using the server clock, and SHALL NOT rely on the client to reconstruct elapsed time. For each fryer `n`, the server SHALL maintain `stageStartMs[n][stage]` in memory. When a stage transitions from inactive to active (rising edge), the server SHALL record that stage's start instant. The active stage's `stage_elapsed_ms` SHALL be `Date.now() - stageStartMs[n][activeStage]`, clamped to be at least 0. No new Modbus register SHALL be read to obtain this value.

#### Scenario: Elapsed set on stage rising edge
- **WHEN** a stage for fryer `n` becomes active after being inactive
- **THEN** the server records that stage's start instant in `stageStartMs[n][stage]`
- **AND** subsequent `stage_elapsed_ms` values for that fryer reflect `now - stageStartMs` of the active stage

#### Scenario: Elapsed advances with the server clock
- **WHEN** a stage remains active across multiple read cycles
- **THEN** `stage_elapsed_ms` increases monotonically according to the server clock, independent of any client clock

#### Scenario: Stage transition re-anchors elapsed
- **WHEN** the active stage changes from one stage to another (e.g. giai đoạn 1 → 2)
- **THEN** the newly active stage's start instant is recorded on its rising edge
- **AND** `stage_elapsed_ms` reflects the new stage's elapsed time, not the previous stage's

### Requirement: Elapsed re-seed on server restart

When the server restarts or reconnects while a batch is still running, it SHALL re-seed `stageStartMs` for the active stage from the running document's recorded data rather than resetting elapsed to zero. The seed source SHALL be `bien_du_lieu[1].thoi_gian` (the first real record, skipping the `[0]` init row) of the active stage, parsed as `"HH:MM:SS DD/MM/YYYY"`. If that timestamp is unavailable or unparseable, the server MAY fall back to the current time for that stage.

#### Scenario: Restart mid-batch preserves elapsed
- **WHEN** the server restarts while fryer `n` has a running batch with an active stage that has at least two `bien_du_lieu` entries
- **THEN** `stageStartMs[n][activeStage]` is seeded from `bien_du_lieu[1].thoi_gian`
- **AND** the first `stage_elapsed_ms` emitted after restart reflects the real elapsed time, not zero

#### Scenario: Missing seed timestamp falls back safely
- **WHEN** the active stage's `bien_du_lieu[1].thoi_gian` is missing or unparseable at restart
- **THEN** the server seeds that stage's start to the current time and continues without error

### Requirement: Client displays server elapsed with freeze-on-stall

The browser client SHALL display the donut stage timer from the server-provided `stage_elapsed_ms` rather than reconstructing elapsed time from the batch document. Between socket ticks the client MAY interpolate elapsed time locally for smooth 1-second updates, but it SHALL cap the displayed value at the last received `stage_elapsed_ms` plus the local time elapsed since that value was received. When the server stops emitting (e.g. a stalled batch or disconnected HMI), the displayed elapsed SHALL freeze at the last known value and SHALL NOT climb unbounded. When `stage_elapsed_ms` is `null` (no active stage), the client SHALL show no running donut.

#### Scenario: Donut reflects server elapsed
- **WHEN** the client receives `noi_chien_N_data` with a numeric `stage_elapsed_ms` for the active fryer
- **THEN** the donut displays that elapsed time (converted to minutes) over the stage target
- **AND** it updates smoothly each second by interpolating from the last received value

#### Scenario: Freeze when the server stops emitting
- **WHEN** the client has received a `stage_elapsed_ms` and then no further `noi_chien_N_data` events arrive (stalled batch)
- **THEN** the donut freezes at approximately the last server value and does not climb without bound

#### Scenario: No active stage hides the donut
- **WHEN** the received `stage_elapsed_ms` is `null`
- **THEN** the client shows no running donut for that fryer

### Requirement: Backward-compatible payload handling

The client SHALL remain functional when a `noi_chien_N_data` payload does not include `stage_elapsed_ms` (older server version). In that case the client SHALL fall back to deriving the donut elapsed from the running batch document as it did before this change, so a client/server version mismatch never breaks the donut.

#### Scenario: Missing field falls back to document-derived elapsed
- **WHEN** the client receives a `noi_chien_N_data` payload with no `stage_elapsed_ms` field
- **THEN** the client derives the donut elapsed from the batch document (prior behavior)
- **AND** no error occurs and the donut still renders
