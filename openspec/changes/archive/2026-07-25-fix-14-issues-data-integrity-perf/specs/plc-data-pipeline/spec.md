## MODIFIED Requirements

### Requirement: Batch lifecycle data safety
The PLC data pipeline SHALL guard against cross-batch writes, undefined document targets, and missing timestamp anchors during batch lifecycle transitions.

#### Scenario: setTimeout does not write to wrong batch
- **WHEN** a setTimeout callback fires (e.g., delayed motor current capture) AND `id_document[n]` has changed since the setTimeout was scheduled (new batch started)
- **THEN** the callback SHALL skip the database write entirely

#### Scenario: Stop does not target undefined document
- **WHEN** `postDataPlc` is called with `Start === 0` AND `id_document[n]` is undefined/null
- **THEN** the function SHALL skip the stop updateOne and stop event emit (no-op)

#### Scenario: Resume restores batchStartMs
- **WHEN** the server restarts and `resumeOpenBatches` finds an open batch for fryer N
- **THEN** it SHALL set `batchStartMs[n]` from `doc.thoi_gian_start_at` (or parsed legacy `thoi_gian_start` string) so subsequent snapshots compute correct `giay_tu_start`

#### Scenario: giay_tu_start correct after resume
- **WHEN** M6 fires for the first time after a server resume
- **THEN** the `giay_tu_start` field in the `nhung_long_dau` snapshot SHALL be a non-null number representing seconds since batch start

### Requirement: Schema field validation
The Mongoose schema SHALL use `required: true` (not `require: true`) for all fields that must be present on document creation.

#### Scenario: Missing required field rejected on create
- **WHEN** a new batch document is created without `thoi_gian_start`
- **THEN** Mongoose SHALL throw a validation error (not silently accept)

### Requirement: Schema key consistency for stage 4
The `dataFormat` initial document shape SHALL use `thoi_gian_treo_long` (matching the schema field name), not `thoi_gian_treo_long_gd_4`.

#### Scenario: Initial document has correct key
- **WHEN** a new batch document is created (Start === 1)
- **THEN** the `giai_doan_4` subdocument contains key `thoi_gian_treo_long` (not `thoi_gian_treo_long_gd_4`)

### Requirement: Stop message correctness
The Socket.IO stop event payload SHALL contain the correctly spelled Vietnamese message.

#### Scenario: Stop event text
- **WHEN** a batch stops (M120 goes false)
- **THEN** the `noi_chien_N_stop` event payload contains `stop: "đã hoàn thành xong mẻ chiên"`

### Requirement: Database index for start time queries
The schema SHALL define a descending index on `thoi_gian_start_at` for efficient date-range queries.

#### Scenario: Index exists
- **WHEN** the MongoDB connection is established and indexes are ensured
- **THEN** an index on `{ thoi_gian_start_at: -1 }` exists on each `noi_chien_N` collection

### Requirement: Port parsing safety
The Modbus TCP connection SHALL parse `PORT_PLC` environment variable as an integer with a fallback default of 502.

#### Scenario: PORT_PLC is a string number
- **WHEN** `process.env.PORT_PLC` is "502"
- **THEN** the connection uses port 502 as a numeric value (not string)

#### Scenario: PORT_PLC is undefined
- **WHEN** `process.env.PORT_PLC` is not set
- **THEN** the connection uses port 502 as default

### Requirement: Environment variable documentation
The repository SHALL include a `.env.example` file documenting all required and optional environment variables.

#### Scenario: .env.example contains all variables
- **WHEN** a developer clones the repository
- **THEN** `.env.example` exists at repository root and lists: `PORT_SERVER`, `MONGO_URI`, `IP_PLC1` through `IP_PLC8`, `PORT_PLC`, `DEBUG`
