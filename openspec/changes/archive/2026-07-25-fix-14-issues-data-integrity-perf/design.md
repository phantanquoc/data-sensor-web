## Context

The IoT Gateway backend polls 8 fryers via Modbus TCP every 800ms, stores batch lifecycle data in MongoDB (8 collections, one per fryer), and pushes realtime sensor data to a React SPA over Socket.IO. The system has been running in production but accumulated 14 issues discovered during a deep code audit — affecting data integrity, performance scalability, and resource efficiency.

Current state:
- API endpoints load entire collections into memory for JS-side filtering (no query-level filtering)
- Batch lifecycle has edge cases: setTimeout can write to wrong document, stop can target undefined _id, resume loses timestamp anchor
- Schema uses `require` (no-op in Mongoose) instead of `required`
- Frontend Overview opens 16 WebSocket connections (8 for status + 8 for charts)
- Modbus read failures trigger per-register fallback that cascades timeouts

## Goals / Non-Goals

**Goals:**
- Eliminate all data integrity bugs (CRITICAL #1-5)
- Reduce Overview page socket connections from 16 to 8
- Prevent Modbus timeout cascades
- Enforce schema validation at database level
- Add lightweight chart endpoint to reduce payload size
- Improve developer onboarding with .env.example

**Non-Goals:**
- Authentication/authorization (separate concern, large scope)
- Refactoring postDataPlc into smaller modules (functional but large)
- Changing Modbus polling interval or protocol
- Changing the Socket.IO event contract (backward compat)

## Decisions

### D1: Mongo query filter with $or for running batches

Both `noi_chien` and `thong_ke` endpoints will build a Mongo query filter:
```
{ $or: [
  { thoi_gian_start_at: { $gte: from, $lte: to } },
  { thoi_gian_stop: "" }  // running batches always included
] }
```
With `.sort({ thoi_gian_start_at: -1, _id: -1 })` at DB level.

**Why over alternatives:**
- Aggregation pipeline: overkill for simple range filter
- Keep JS filter as-is: degrades linearly with collection size — unacceptable

### D2: setTimeout generation guard via captured doc id

Capture `id_document[n]` at setTimeout creation. In callback, compare with current `id_document[n]`. If different, skip.

**Why over alternatives:**
- Generation counter: more complex, same effect
- Cancel timer on stop: fragile (timer id management across async cycles)
- Captured id comparison: simplest, zero state added

### D3: Shared socket singleton pattern

Create `sharedSockets.ts` exporting a module-scoped manager:
- On first import: creates 8 Socket.IO connections, joins rooms
- Exposes `subscribe(n, event, handler)` / `unsubscribe(...)` API
- Both `useAllFryers` and `useFleetHistory` import and subscribe
- Connections are created lazily on first subscribe, cleaned up when last subscriber leaves

**Why over alternatives:**
- React Context + Provider: requires wrapping entire app, heavier
- Single socket joining multiple rooms: server already implements room-per-fryer, would need protocol change
- Module singleton: zero React overhead, works with current server contract

### D4: Modbus skip-on-error (no fallback reads)

On block read failure: `console.warn(...)`, leave `reg.val` at previous value, continue to next block. Remove the inner for-loop that reads individual registers.

**Why:**
- Per-register fallback amplifies timeout from 1s to N×1s
- Stale value for one 800ms cycle is acceptable in an industrial monitoring context
- Full connection loss is still detected at the `scheduleRead` level

### D5: Chart projection endpoint

New route `GET /get_noi_chien_chart?so_noiChien=N&id=ID` returns:
```json
{
  "thoi_gian_start": "...",
  "thoi_gian_start_at": "...",
  "giai_doan_1": { "bien_du_lieu": [{ "thoi_gian": "...", "nhiet_do": N, "ap_suat_chan_khong": N }] },
  ...same for gd2-4
}
```

Uses `.select()` Mongoose projection — same collection, just fewer fields transferred.

## Risks / Trade-offs

- **[Index creation on startup]** → Mongoose `ensureIndexes` runs automatically. On large collections this may take a few seconds on first deploy. Mitigation: index build is background by default in MongoDB 7.
- **[Shared socket manager lifecycle]** → If a component unmounts and remounts rapidly, subscribe/unsubscribe churn. Mitigation: debounce connection teardown with a 2s delay.
- **[Schema `required: true` enforcement]** → Old documents missing required fields will NOT fail reads, only writes. No migration needed. New documents will be validated. Mitigation: none needed.
- **[Removing Modbus fallback]** → If a specific register is consistently unreadable (hardware fault), its value will freeze at last-known. Mitigation: acceptable for monitoring; operators notice frozen values on dashboard.
- **[Running batches in $or query]** → Running batch from 6 months ago would appear in today's list. Mitigation: acceptable — running batches are rare and always relevant.
