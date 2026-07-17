## ADDED Requirements

### Requirement: Grouped block reads per fryer

The gateway SHALL read each fryer's registers using grouped Modbus block reads instead of one request per register. Holding registers SHALL be read in the following blocks (`[startAddress, count]`): `[2,4]`, `[60,1]`, `[81,7]`, `[134,2]`, `[202,13]`, `[256,13]`, `[316,1]`, `[501,10]`, `[572,6]`. Coils SHALL be read in the blocks `[15070,86]` (M70 through M155) and `[16000,1]` (X0). After each block read, the block response SHALL be split back into individual register values by their offset within the block, and every register value used today SHALL be populated exactly as before.

#### Scenario: All blocks read successfully
- **WHEN** a fryer's read cycle runs and every block read succeeds
- **THEN** the gateway issues exactly 11 Modbus requests for that fryer (9 holding-register blocks + 2 coil blocks)
- **AND** every register value (D2..D60, D81..D87, D134..D135, D202..D214, D256..D268, D316, D501..D510, D572..D577, coils M70..M155, X0) is populated with the same value it would have had under per-register reads

#### Scenario: Register-to-field mapping and offsets preserved
- **WHEN** block responses are split into individual register values
- **THEN** the intentional +1 address offsets are honored (D575→addr576, D576→addr577, D571→addr572, D572→addr573, D500→addr501, D507→addr508, D502→addr503, D508→addr509, D504→addr505, D509→addr510)
- **AND** float LE assembly, D84–D87 divide-by-10, and `tong_thoi_gian_chay` from address 60 are unchanged

### Requirement: Per-block fallback to single reads

When a block read fails (for example, the HMI does not map an unused address inside the block range contiguously), the gateway SHALL fall back to reading each register in that failed block individually so that no field is lost. A fallback SHALL be scoped to the failing block only and SHALL NOT abort reads of the remaining blocks.

#### Scenario: One block fails, others succeed
- **WHEN** a single holding-register block read throws an error during a fryer's cycle
- **THEN** the gateway reads each register in that block individually
- **AND** the other blocks are still read as normal blocks
- **AND** all register values that can be read are populated for that cycle

#### Scenario: A register still unreadable after fallback
- **WHEN** an individual register read also fails during fallback
- **THEN** that register value defaults to 0 (unchanged from current behavior)
- **AND** the fryer connection status is marked disconnected (unchanged from current behavior)

### Requirement: Sequential reads within a fryer, parallel across fryers

The gateway SHALL read a single fryer's blocks sequentially over that fryer's one TCP connection, never issuing concurrent Modbus requests on the same connection. The gateway MAY read different fryers concurrently because each fryer targets a distinct HMI on a distinct IP.

#### Scenario: No concurrent requests on one connection
- **WHEN** a fryer's read cycle executes its blocks
- **THEN** at most one Modbus request is in flight on that fryer's connection at any time

#### Scenario: Fryers read independently
- **WHEN** multiple fryers are connected
- **THEN** each fryer runs its own read cycle without waiting for another fryer's cycle to finish

### Requirement: Re-entrancy guard and self-scheduling loop

Each fryer SHALL be driven by a self-scheduling loop (read → wait the poll interval → read again) rather than a shared non-awaited `setInterval`. A per-fryer re-entrancy guard SHALL prevent overlapping cycles: if a fryer's previous read cycle has not finished when the next tick is due, that tick SHALL be skipped rather than queued.

#### Scenario: Slow cycle does not overlap
- **WHEN** a fryer's read cycle takes longer than the poll interval
- **THEN** the next cycle for that fryer does not start until the current one completes
- **AND** ticks that arrive while a cycle is running are skipped, not queued

#### Scenario: Poll cadence preserved when cycles are fast
- **WHEN** a fryer's read cycle completes faster than the poll interval
- **THEN** the next cycle starts approximately one poll interval after the previous cycle, keeping the existing ~3s cadence

### Requirement: Batch lifecycle unchanged

The block-read refactor SHALL NOT change the batch lifecycle. The M120 Start counter (create on Start=1, update on Start>1, stop on transition to Start=0), stage gating by coils M155/M124/M126/M127, and orphan-batch cleanup on restart SHALL behave exactly as before.

#### Scenario: Lifecycle behaves as before
- **WHEN** M120 transitions drive a batch through start, running, and stop
- **THEN** documents are created, updated, and stopped identically to the pre-change behavior
- **AND** no PLC write path is introduced and the DB schema is unchanged
