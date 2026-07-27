## MODIFIED Requirements

### Requirement: Detail page socket listener efficiency
The `useSocket` hook SHALL register event listeners only for the currently active fryer (soNoiChien), not for all 8 fryers.

#### Scenario: Listener registration on mount
- **WHEN** `useSocket` mounts with `soNoiChien = "3"`
- **THEN** it registers listeners only on `noi_chien_3_data` and `noi_chien_3_stop` events (not on all 8 fryers)

#### Scenario: Listener re-registration on tab switch
- **WHEN** `soNoiChien` changes from "3" to "5"
- **THEN** the hook unregisters `noi_chien_3_data` / `noi_chien_3_stop` and registers `noi_chien_5_data` / `noi_chien_5_stop`

### Requirement: Overview hooks use shared socket manager
Both `useAllFryers` and `useFleetHistory` SHALL use the shared socket manager instead of creating their own Socket.IO connections.

#### Scenario: useAllFryers subscribes via shared manager
- **WHEN** the Overview page mounts
- **THEN** `useAllFryers` subscribes to all 8 fryer data events through the shared socket manager (no `io({ forceNew: true })` calls)

#### Scenario: useFleetHistory subscribes via shared manager
- **WHEN** the Overview page mounts
- **THEN** `useFleetHistory` subscribes to all 8 fryer data events through the same shared socket manager instance used by `useAllFryers`

### Requirement: useFleetHistory uses chart endpoint
The `useFleetHistory` hook SHALL use the lightweight `/get_noi_chien_chart` endpoint for initial batch data loading instead of the full `/get_noi_chien_detail` endpoint.

#### Scenario: Initial load uses chart endpoint
- **WHEN** `useFleetHistory` loads batch history for each machine on mount
- **THEN** it calls `GET /get_noi_chien_chart` (not `GET /get_noi_chien_detail`) to get only timestamp + temperature + vacuum pressure data
