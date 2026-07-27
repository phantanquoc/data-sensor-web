## Why

The IoT Gateway has accumulated 14 issues across backend and frontend — ranging from silent data corruption (API loading entire MongoDB collections into JS memory for filtering, setTimeout writing sensor data to the wrong batch document, updateOne targeting undefined _id) to resource waste (16 WebSocket connections per browser tab instead of 8) and silent schema validation bypass (`require` typo). These issues degrade reliability and performance progressively as batch count grows.

## What Changes

- **API query optimization**: `GET /get_noi_chien` and `GET /thong_ke` move filtering from JS to MongoDB query level with proper indexes, preventing memory spikes on large collections.
- **Batch lifecycle safety**: Guard setTimeout cross-batch writes, guard Stop on undefined document, restore `batchStartMs` on server resume so sensor snapshots have correct timestamps.
- **Schema validation enforcement**: Fix `require` → `required` typo across all schema fields; add missing `thoi_gian_start_at` index; fix `thoi_gian_treo_long_gd_4` key mismatch.
- **WebSocket consolidation**: Replace 16 duplicate socket connections per Overview tab with 8 shared connections via a singleton socket manager.
- **Chart data projection**: New lightweight `/get_noi_chien_chart` endpoint returns only timestamp + temperature + pressure fields for the fleet chart, avoiding full document transfers.
- **Modbus read resilience**: Remove per-register fallback cascade that amplifies timeouts; keep stale values on block failure instead.
- **Socket listener cleanup**: Detail page registers only the active fryer's listeners instead of all 8.
- **Port parsing & env docs**: Explicit parseInt for PORT_PLC, new `.env.example` documenting all required variables.
- **Typo fix**: Correct Vietnamese stop message.

## Capabilities

### New Capabilities
- `chart-data-endpoint`: Lightweight REST endpoint (`GET /get_noi_chien_chart`) serving only the fields needed for fleet line charts (timestamps, temperature, vacuum pressure per stage).
- `shared-socket-manager`: Singleton socket connection pool for the React frontend that opens exactly 8 connections and allows multiple hook subscribers, eliminating duplicate connections.

### Modified Capabilities
- `plc-data-pipeline`: Fix batch lifecycle guards (setTimeout cross-batch, stop on undefined, resume batchStartMs), schema key mismatch, Modbus fallback cascade removal, port parsing.
- `hmi-modbus-read`: Modbus block-error handling changed from per-register fallback to skip-and-retain.
- `frontend-react-dashboard`: useSocket registers only active fryer listeners; useAllFryers and useFleetHistory use shared socket manager.
- `realtime-socket-delivery`: No protocol change, but connection pooling changes client-side subscription pattern.

## Impact

- **Backend files**: `controller/home.js`, `controller/post_data_plc.js`, `model/plc_schema.js`, `app.js`, `connectPLC.js`, `router/home.js`
- **Frontend files**: `client/src/hooks/sharedSockets.ts` (new), `client/src/hooks/useAllFryers.ts`, `client/src/hooks/useFleetHistory.ts`, `client/src/hooks/useSocket.ts`, `client/src/api/index.ts`
- **New files**: `.env.example`, `client/src/hooks/sharedSockets.ts`
- **APIs**: New route `GET /get_noi_chien_chart`; existing routes unchanged in response shape but faster
- **Database**: New index on `thoi_gian_start_at: -1` (auto-created on startup by Mongoose)
- **Dependencies**: None added or removed
