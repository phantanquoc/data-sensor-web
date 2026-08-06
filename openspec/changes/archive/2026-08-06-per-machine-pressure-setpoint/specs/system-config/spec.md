## MODIFIED Requirements

### Requirement: Pressure setpoint configuration storage
The system SHALL persist a per-machine set of vacuum pressure setpoints — one value per fryer stage (1 through 4) for each of the 8 fryers — in a MongoDB singleton document. Each value SHALL be either a non-negative finite number or `null`, where `null` means "not configured".

#### Scenario: Values are independent per machine
- **WHEN** machine 3 has stage 1 configured to `700` and machine 5 has stage 1 configured to `640`
- **THEN** reading the configuration returns `700` for machine 3 stage 1 and `640` for machine 5 stage 1
- **AND** changing one machine's value does not alter any other machine's value

#### Scenario: Unconfigured stage stored as null
- **WHEN** a stage's setpoint is saved with an empty value
- **THEN** the stored value for that stage is `null`, not `0`

#### Scenario: All 8 machines are represented
- **WHEN** the configuration is read
- **THEN** the response contains an entry for every machine 1 through 8, each carrying all four stage values

### Requirement: Read pressure setpoint configuration
The system SHALL expose an authenticated `GET /cai_dat_he_thong` endpoint returning the four stage setpoints for each of the 8 machines.

#### Scenario: Configuration has been saved before
- **WHEN** an authenticated client sends `GET /cai_dat_he_thong` and a per-machine configuration document exists
- **THEN** the server responds HTTP 200 with the stored setpoints keyed by machine number 1 through 8, each machine carrying `giai_doan_1` through `giai_doan_4` as `<number|null>`

#### Scenario: Configuration never saved
- **WHEN** an authenticated client sends `GET /cai_dat_he_thong` and no configuration document exists yet
- **THEN** the server responds HTTP 200 with all 8 machines present and every stage value set to `null`
- **AND** the server does NOT respond 404

#### Scenario: Unauthenticated read is rejected
- **WHEN** a client without a valid `iot_token` cookie sends `GET /cai_dat_he_thong`
- **THEN** the server responds HTTP 401 and no configuration data is returned

### Requirement: Write pressure setpoint configuration
The system SHALL expose an authenticated `PUT /cai_dat_he_thong` endpoint that stores the four stage setpoints for each of the 8 machines, creating the document on first write via upsert.

#### Scenario: First save creates the document
- **WHEN** an authenticated client sends `PUT /cai_dat_he_thong` with a valid body and no configuration document exists yet
- **THEN** the server creates the document via upsert, responds HTTP 200, and returns the saved values
- **AND** no manual seeding or migration step is required beforehand

#### Scenario: Save overwrites values for every machine
- **WHEN** an authenticated client sends a body assigning distinct stage values to several machines, including at least one `null`
- **THEN** the stored document holds exactly those values per machine, preserving each `null`
- **AND** a subsequent `GET /cai_dat_he_thong` returns the same values for the same machines

#### Scenario: Decimal values are preserved
- **WHEN** an authenticated client saves a stage setpoint of `680.5` for a machine
- **THEN** the stored and subsequently returned value for that machine and stage is `680.5` (not rounded or truncated)

#### Scenario: Unauthenticated write is rejected
- **WHEN** a client without a valid `iot_token` cookie sends `PUT /cai_dat_he_thong`
- **THEN** the server responds HTTP 401 and no data is written

### Requirement: Pressure setpoint input validation
The server SHALL validate each submitted stage setpoint as either `null` or a finite number greater than or equal to zero, and SHALL reject invalid input with HTTP 400 and a Vietnamese error message identifying the offending machine and stage, matching the existing `{ "error": "<message>" }` shape used by other handlers in `backend/controller/home.js`. Validation SHALL complete across all submitted values before any write occurs, so a single invalid value prevents the entire save.

#### Scenario: Negative value rejected
- **WHEN** an authenticated client sends a stage setpoint of `-5` for some machine
- **THEN** the server responds HTTP 400 with a Vietnamese `{ "error": ... }` message naming that machine and stage
- **AND** no value is written to the database

#### Scenario: Non-numeric value rejected
- **WHEN** an authenticated client sends a stage setpoint that is a non-numeric string, `NaN`, `Infinity`, a boolean, an array, or an object
- **THEN** the server responds HTTP 400 with a Vietnamese `{ "error": ... }` message
- **AND** no value is written to the database

#### Scenario: One invalid value blocks the whole save
- **WHEN** an authenticated client submits valid values for machines 1 through 7 and an invalid value for machine 8
- **THEN** the server responds HTTP 400
- **AND** none of the values for machines 1 through 7 are written, leaving the stored configuration exactly as it was

#### Scenario: Machine number outside 1..8 rejected
- **WHEN** an authenticated client submits a configuration entry for a machine number outside the range 1 through 8
- **THEN** the server responds HTTP 400 with a Vietnamese `{ "error": ... }` message
- **AND** no value is written to the database

#### Scenario: Zero is accepted as a valid stored value
- **WHEN** an authenticated client sends a stage setpoint of `0`
- **THEN** the server accepts it and responds HTTP 200 (validation permits zero; the chart layer separately treats zero as "no line")

#### Scenario: Null is accepted
- **WHEN** an authenticated client sends a stage setpoint of `null`
- **THEN** the server accepts it, stores `null`, and responds HTTP 200

### Requirement: Configuration routes inherit authentication
The configuration routes SHALL be registered in `backend/router/home.js` so they are mounted behind the existing `app.use(auth.requireAuth, home)` call in `backend/app.js`, requiring no additional per-route authentication middleware.

#### Scenario: Routes registered on the protected router
- **WHEN** the configuration read and write routes are registered
- **THEN** they are added to the router exported by `backend/router/home.js` (the router already mounted behind `auth.requireAuth`)
- **AND** no separate `auth.requireAuth` call is attached to these individual routes

## ADDED Requirements

### Requirement: Legacy fleet-wide configuration expansion
The system SHALL read configuration documents stored in the previous fleet-wide flat shape and expand them so the four stored values apply to all 8 machines. This expansion SHALL happen automatically on read, with no manual migration step, script, or operator action. A live deployment already holds a flat document, and losing it would force an operator to re-enter 32 values by hand.

#### Scenario: Flat document expands across all machines
- **WHEN** the stored document holds the legacy flat shape with stage values `700`, `680`, `660`, `640` and an authenticated client sends `GET /cai_dat_he_thong`
- **THEN** the server responds HTTP 200 with all 8 machines present
- **AND** every machine carries `giai_doan_1: 700`, `giai_doan_2: 680`, `giai_doan_3: 660`, `giai_doan_4: 640`

#### Scenario: Legacy nulls expand as nulls
- **WHEN** the legacy flat document holds `null` for a stage
- **THEN** every machine carries `null` for that stage after expansion, not `0`

#### Scenario: New shape is read unchanged
- **WHEN** the stored document already holds the per-machine shape
- **THEN** it is returned as stored, with no expansion applied and no values overwritten

#### Scenario: Write after expansion persists the new shape
- **WHEN** a client saves a configuration after a legacy document was expanded on read
- **THEN** the stored document is written in the per-machine shape
- **AND** subsequent reads return it without needing expansion
