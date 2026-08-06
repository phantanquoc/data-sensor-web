## ADDED Requirements

### Requirement: Pressure setpoint configuration storage
The system SHALL persist a single fleet-wide set of vacuum pressure setpoints — one value per fryer stage (1 through 4) — in a MongoDB singleton document. Each value SHALL be either a non-negative finite number or `null`, where `null` means "not configured".

#### Scenario: Values shared across all machines
- **WHEN** the configuration is read for any purpose
- **THEN** the same four values apply to all 8 fryers (the stored document contains no per-machine dimension)

#### Scenario: Unconfigured stage stored as null
- **WHEN** a stage's setpoint is saved with an empty value
- **THEN** the stored value for that stage is `null`, not `0`

### Requirement: Read pressure setpoint configuration
The system SHALL expose an authenticated `GET /cai_dat_he_thong` endpoint returning the four stage setpoints.

#### Scenario: Configuration has been saved before
- **WHEN** an authenticated client sends `GET /cai_dat_he_thong` and a configuration document exists
- **THEN** the server responds HTTP 200 with `{ "ap_suat_cai_dat": { "giai_doan_1": <number|null>, "giai_doan_2": <number|null>, "giai_doan_3": <number|null>, "giai_doan_4": <number|null> } }`

#### Scenario: Configuration never saved
- **WHEN** an authenticated client sends `GET /cai_dat_he_thong` and no configuration document exists yet
- **THEN** the server responds HTTP 200 with all four stage values set to `null`
- **AND** the server does NOT respond 404

#### Scenario: Unauthenticated read is rejected
- **WHEN** a client without a valid `iot_token` cookie sends `GET /cai_dat_he_thong`
- **THEN** the server responds HTTP 401 and no configuration data is returned

### Requirement: Write pressure setpoint configuration
The system SHALL expose an authenticated `PUT /cai_dat_he_thong` endpoint that stores the four stage setpoints, creating the document on first write via upsert.

#### Scenario: First save creates the document
- **WHEN** an authenticated client sends `PUT /cai_dat_he_thong` with a valid body and no configuration document exists yet
- **THEN** the server creates the document via upsert, responds HTTP 200, and returns the saved values
- **AND** no manual seeding or migration step is required beforehand

#### Scenario: Subsequent save overwrites all four values
- **WHEN** an authenticated client sends `PUT /cai_dat_he_thong` with `{ "ap_suat_cai_dat": { "giai_doan_1": 700, "giai_doan_2": 650, "giai_doan_3": null, "giai_doan_4": 600 } }`
- **THEN** the stored document holds exactly those four values, including the `null` for stage 3
- **AND** a subsequent `GET /cai_dat_he_thong` returns the same four values

#### Scenario: Decimal values are preserved
- **WHEN** an authenticated client saves a stage setpoint of `680.5`
- **THEN** the stored and subsequently returned value is `680.5` (not rounded or truncated)

#### Scenario: Unauthenticated write is rejected
- **WHEN** a client without a valid `iot_token` cookie sends `PUT /cai_dat_he_thong`
- **THEN** the server responds HTTP 401 and no data is written

### Requirement: Pressure setpoint input validation
The server SHALL validate each submitted stage setpoint as either `null` or a finite number greater than or equal to zero, and SHALL reject invalid input with HTTP 400 and a Vietnamese error message matching the existing `{ "error": "<message>" }` shape used by other handlers in `backend/controller/home.js`.

#### Scenario: Negative value rejected
- **WHEN** an authenticated client sends a stage setpoint of `-5`
- **THEN** the server responds HTTP 400 with a Vietnamese `{ "error": ... }` message
- **AND** no value is written to the database

#### Scenario: Non-numeric value rejected
- **WHEN** an authenticated client sends a stage setpoint that is a non-numeric string, `NaN`, or `Infinity`
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
