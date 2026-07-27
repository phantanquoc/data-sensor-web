## ADDED Requirements

### Requirement: Chart data projection endpoint
The system SHALL expose a `GET /get_noi_chien_chart` endpoint that returns only the fields needed for fleet line charts (timestamps, temperature, vacuum pressure) for a given batch document.

#### Scenario: Successful chart data fetch
- **WHEN** client sends `GET /get_noi_chien_chart?so_noiChien=3&id=<valid-objectid>`
- **THEN** server responds with JSON containing only `thoi_gian_start`, `thoi_gian_start_at`, and for each `giai_doan_1` through `giai_doan_4`: `bien_du_lieu` array with only `thoi_gian`, `nhiet_do`, and `ap_suat_chan_khong` fields per entry

#### Scenario: Invalid machine number
- **WHEN** client sends `GET /get_noi_chien_chart?so_noiChien=9&id=<valid-objectid>`
- **THEN** server responds with HTTP 400 and `{ "error": "so_noiChien must be between 1 and 8" }`

#### Scenario: Invalid or missing id
- **WHEN** client sends `GET /get_noi_chien_chart?so_noiChien=1&id=invalid`
- **THEN** server responds with HTTP 400 and `{ "error": "id không hợp lệ" }`

#### Scenario: Document not found
- **WHEN** client sends `GET /get_noi_chien_chart?so_noiChien=1&id=<valid-but-nonexistent-objectid>`
- **THEN** server responds with HTTP 404 and `{ "error": "Không tìm thấy mẻ chiên" }`
