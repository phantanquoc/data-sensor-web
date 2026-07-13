## ADDED Requirements

### Requirement: MongoDB collection names preserved

The system SHALL persist each fryer's data to a MongoDB collection registered under the exact Mongoose model name `noi_chien_N` for N = 1..8, so that `controller/home.js` and the frontend continue to resolve the same collections after the refactor.

#### Scenario: All eight collections exist and receive documents

- **WHEN** all 8 PLCs are connected and each starts a batch (M120 turns true)
- **THEN** documents are created in collections `noi_chien_1` through `noi_chien_8`, one collection per fryer, using the same names as before the refactor

#### Scenario: Model registration name is unchanged

- **WHEN** the consolidated schema module registers the 8 models
- **THEN** each is registered with `mongoose.model("noi_chien_N", schema)` for the matching N, preserving collection naming

### Requirement: Socket.IO event names preserved

The system SHALL emit real-time data on Socket.IO events named exactly `noi_chien_N_data` and completion on `noi_chien_N_stop` for N = 1..8, matching the listeners in `views/view_home.ejs`.

#### Scenario: Per-fryer data event

- **WHEN** fryer N has an active batch and a poll cycle reads its registers
- **THEN** the server emits `noi_chien_N_data` with the same payload shape (fields `data`, `giai_doan`, `active`, `tong_thoi_gian_chay`, `set_giai_doan`)

#### Scenario: Per-fryer stop event

- **WHEN** fryer N's M120 turns false after having been started (isStart true)
- **THEN** the server emits `noi_chien_N_stop` and writes `thoi_gian_stop` on the current document

### Requirement: Modbus register map and float assembly preserved

The system SHALL read the same Modbus registers (same `name`/`modbusAddr` pairs, including coil offset +15000 for M-addresses and +16000 for X-addresses, `reg` via readHoldingRegisters and `coil` via readCoils, one register at a time) and SHALL assemble 32-bit floats identically: `Buffer.alloc(4)`, `writeUInt16LE(low, 0)`, `writeUInt16LE(high, 2)`, `readFloatLE(0)`, `.toFixed(2)` parsed as float.

#### Scenario: Register list unchanged per fryer

- **WHEN** the poll cycle reads a fryer's registers
- **THEN** it reads the identical set of D*/M*/X* registers at the identical modbus addresses as the pre-refactor `registerList_PLCn`

#### Scenario: Float pairs assembled identically

- **WHEN** a paired value such as D2/D3 (ap_suat_vo_hoi) is computed
- **THEN** the low word is written at byte 0, the high word at byte 2, and the result is `parseFloat(readFloatLE(0).toFixed(2))`

### Requirement: Batch start/stop logic preserved

The system SHALL preserve the per-fryer batch lifecycle: when M120 is boolean true, set isStart true, increment Start (capped at 2), create a document when Start === 1 and update it when Start > 1; when M120 is boolean false and isStart is true, set Start = 0, isStart false, and finalize. The `id_document` for each fryer SHALL remain in module memory (behavior including loss on restart is unchanged), keyed per fryer index.

#### Scenario: Batch creation on first start tick

- **WHEN** M120 becomes boolean true and Start transitions to 1 for fryer N
- **THEN** a new document is created in `noi_chien_N` and its id is retained for subsequent updates

#### Scenario: Batch updates on subsequent ticks

- **WHEN** M120 remains boolean true and Start > 1 for fryer N
- **THEN** the active document is updated (per active giai_doan) using the retained id, with `$set` of the stage fields and `$push` into that stage's `bien_du_lieu`

#### Scenario: Batch finalize on stop

- **WHEN** M120 becomes boolean false while isStart is true for fryer N
- **THEN** Start resets to 0, isStart to false, `thoi_gian_stop` is written, and `noi_chien_N_stop` is emitted

### Requirement: Value transforms preserved

The system SHALL apply the same value transforms: divide D84..D87 by 10; map `vi_tri_muc_dau` numeric 0 to "1/3 mức dầu", 1 to "2/3 mức dầu", 2 to "ngập dầu".

#### Scenario: Temperature scaling

- **WHEN** D84..D87 are read
- **THEN** each is divided by 10 before being stored/emitted

#### Scenario: Oil level label mapping

- **WHEN** the oil-level register value is 0, 1, or 2
- **THEN** it maps to "1/3 mức dầu", "2/3 mức dầu", or "ngập dầu" respectively

### Requirement: Polling and reconnect timing preserved

The system SHALL poll all fryers on a single 3000ms `setInterval`, retry a disconnected PLC via `setTimeout(plcLoop, 1000)` in the not-connected branch, and retry a failed connection via `setTimeout(plcLoop, 5000)` in the connect catch handler. `readAllRegisters` SHALL be defined once, not redefined on each interval tick.

#### Scenario: Single poll interval

- **WHEN** the app runs
- **THEN** exactly one 3000ms interval drives reads for all 8 fryers

#### Scenario: Reconnect cadence unchanged

- **WHEN** a PLC is not connected during a tick
- **THEN** a 1000ms retry is scheduled; and when an initial connect throws, a 5000ms retry is scheduled

### Requirement: HTTP routes and MongoDB connection preserved

The system SHALL keep the routes `GET /`, `GET /get_noi_chien?so_noiChien=N`, `GET /get_noi_chien_detail?id=&so_noiChien=N`, `DELETE /xoa_noi_chien_detail?id=&so_noiChien=N`, and `POST /enable_machine` with identical response behavior, and SHALL connect to MongoDB using `process.env.MONGO_URI` with no reference to Atlas remaining in source.

#### Scenario: Fryer query routes resolve by number

- **WHEN** a request hits `/get_noi_chien` or `/get_noi_chien_detail` or `/xoa_noi_chien_detail` with `so_noiChien = N`
- **THEN** the correct `noi_chien_N` model is used and the response matches pre-refactor behavior (`res.send(PLCDatas)` or `res.send({ success: true })`)

#### Scenario: No Atlas reference in source

- **WHEN** the source is grepped for `atlas`, `atlat`, or `mongodb+srv`
- **THEN** no matches exist in tracked application code, and `.env` is no longer tracked by git

