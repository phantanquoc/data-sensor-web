## MODIFIED Requirements

### Requirement: API date-range query at database level
The `GET /get_noi_chien` and `GET /thong_ke` endpoints SHALL filter batches using MongoDB query operators (not JavaScript array filtering) with the `thoi_gian_start_at` field.

#### Scenario: Date range filter via Mongo query
- **WHEN** client sends `GET /get_noi_chien?so_noiChien=1&from=2025-01-01&to=2025-01-31`
- **THEN** the server queries MongoDB with `{ $or: [{ thoi_gian_start_at: { $gte: from, $lte: to } }, { thoi_gian_stop: "" }] }` and returns results sorted by `thoi_gian_start_at` descending

#### Scenario: Running batches always included
- **WHEN** a batch has `thoi_gian_stop: ""` (still running) and its `thoi_gian_start_at` is outside the requested date range
- **THEN** the batch SHALL still be included in the response (running batches are always relevant)

#### Scenario: No date filter returns all batches sorted
- **WHEN** client sends `GET /get_noi_chien?so_noiChien=1` without from/to parameters
- **THEN** the server returns all batches sorted by `thoi_gian_start_at` descending (no JS-side filtering)

#### Scenario: Thong ke uses Mongo filter
- **WHEN** client sends `GET /thong_ke?from=2025-01-01&to=2025-01-31`
- **THEN** the server counts batches using a MongoDB query filter (not loading all documents into JS), with running batches always counted regardless of date
