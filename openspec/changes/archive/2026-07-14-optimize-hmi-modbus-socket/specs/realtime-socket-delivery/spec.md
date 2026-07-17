## ADDED Requirements

### Requirement: Consolidated per-fryer data event

For each read cycle of a fryer, the server SHALL emit a single `noi_chien_N_data` event whose payload is an array of the 4 stage objects, instead of 4 separate emits. Each stage object SHALL preserve today's fields exactly: `data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, and `set_giai_doan`.

#### Scenario: One event per fryer per cycle
- **WHEN** a fryer completes a read cycle and emits its data
- **THEN** the server emits exactly one `noi_chien_N_data` event carrying an array of 4 stage objects
- **AND** each stage object contains the same `data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, and `set_giai_doan` content that the 4 separate events carried before

#### Scenario: Fleet emit count reduced
- **WHEN** all 8 fryers complete a cycle
- **THEN** the server emits 8 data events total (one per fryer) rather than 32

### Requirement: Room-scoped delivery

The server SHALL deliver `noi_chien_N_data` and `noi_chien_N_stop` only to clients in the room for fryer N (`noi_N`), using `io_.to("noi_N").emit(...)`, rather than broadcasting to all connected clients.

#### Scenario: Only viewers of a fryer receive its events
- **WHEN** the server emits data or stop for fryer N
- **THEN** only clients currently joined to room `noi_N` receive the event
- **AND** clients viewing a different fryer do not receive fryer N's events

### Requirement: Client room join/leave on tab switch

The browser client SHALL join the room for the fryer it is currently viewing and leave the previous fryer's room when the user switches tabs, so it receives events only for the active fryer. On initial load the client SHALL join the room for the default fryer tab.

#### Scenario: Switching tabs moves the client between rooms
- **WHEN** the user switches from fryer A's tab to fryer B's tab
- **THEN** the client leaves room `noi_A` and joins room `noi_B`
- **AND** subsequently receives only fryer B's events

#### Scenario: Initial load joins default room
- **WHEN** the dashboard first loads with the default fryer tab active
- **THEN** the client joins that fryer's room and receives its events

### Requirement: Client consumes array payload

The browser client SHALL handle the consolidated array payload of `noi_chien_N_data` by rendering all 4 stages from the single event, producing the same on-screen result as the previous 4 separate events. The `noi_chien_N_stop` handling SHALL be unchanged apart from being room-scoped.

#### Scenario: Array payload renders all stages
- **WHEN** the client receives a `noi_chien_N_data` event with a 4-stage array
- **THEN** it renders all 4 stages exactly as it did when receiving 4 separate events

#### Scenario: Stop event still resets the view
- **WHEN** the client receives `noi_chien_N_stop` for the fryer it is viewing
- **THEN** it resets the real-time view as before
