## MODIFIED Requirements

### Requirement: Block-level Modbus read error handling
The Modbus read functions SHALL handle block-level errors by logging a warning and retaining previous register values, without attempting per-register fallback reads.

#### Scenario: Holding register block timeout
- **WHEN** a `readHoldingRegisters(start, count)` call throws an error (timeout or communication failure)
- **THEN** the system SHALL log a console.warn with the block address and error message, leave all `reg.val` in that block unchanged from their previous cycle values, and proceed to the next block

#### Scenario: Coil block timeout
- **WHEN** a `readCoils(start, count)` call throws an error
- **THEN** the system SHALL log a console.warn, leave `reg.val` unchanged for affected coils, and proceed to the next block

#### Scenario: No updateStatus(n, false) on block failure
- **WHEN** a single block read fails but the connection is still open
- **THEN** the system SHALL NOT call `updateStatus(n, false)` — connection status changes are only triggered by full connection loss detected at the scheduling level
