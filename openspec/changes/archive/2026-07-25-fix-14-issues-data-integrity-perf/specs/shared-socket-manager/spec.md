## ADDED Requirements

### Requirement: Singleton socket connection pool
The frontend SHALL use a shared socket manager module that opens exactly 8 Socket.IO connections (one per fryer) and allows multiple hook subscribers per connection event.

#### Scenario: First subscriber triggers connection
- **WHEN** the first React hook subscribes to fryer N events via the shared manager
- **THEN** the manager opens a Socket.IO connection for fryer N and joins room `noi_` + N

#### Scenario: Multiple subscribers share one connection
- **WHEN** two hooks (useAllFryers and useFleetHistory) both subscribe to fryer 3 data events
- **THEN** only one Socket.IO connection exists for fryer 3, and both hooks receive the same event payloads

#### Scenario: Last subscriber unsubscribes
- **WHEN** the last subscriber for fryer N unsubscribes (e.g., component unmount)
- **THEN** the manager disconnects the Socket.IO connection for fryer N after a short delay (2s debounce)

#### Scenario: Overview page total connections
- **WHEN** the Overview page mounts (useAllFryers + useFleetHistory both active)
- **THEN** the browser has at most 8 WebSocket connections open to the server (not 16)
