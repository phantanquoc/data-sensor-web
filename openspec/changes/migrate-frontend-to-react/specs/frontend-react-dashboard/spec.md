## ADDED Requirements

### Requirement: React SPA served by Express at root

The system SHALL serve the built React + TypeScript single-page application from Express at `GET /`, replacing the EJS-rendered `view_home`. The server SHALL serve the SPA's static build assets, and SHALL preserve the existing REST routes (`GET /get_noi_chien`, `GET /get_noi_chien_detail`, `DELETE /xoa_noi_chien_detail`, `POST /enable_machine`) and Socket.IO endpoint unchanged, so no API or socket behavior changes.

#### Scenario: Root serves the SPA
- **WHEN** a browser requests `GET /`
- **THEN** the server responds with the React application's `index.html` and its static assets load successfully

#### Scenario: REST routes are not shadowed by the SPA
- **WHEN** a request hits `GET /get_noi_chien`, `GET /get_noi_chien_detail`, `DELETE /xoa_noi_chien_detail`, or `POST /enable_machine`
- **THEN** the existing route handler responds exactly as before, and the SPA fallback does not intercept it

#### Scenario: Socket endpoint preserved
- **WHEN** the client opens a Socket.IO connection to the page origin
- **THEN** the connection is established on the same server and the client receives the `message` "Connected successfully" event as before

### Requirement: Eight-fryer tab navigation

The dashboard SHALL present 8 tabs labeled "Hệ Chiên 1" through "Hệ Chiên 8". Exactly one tab SHALL be active at a time, visually highlighted, defaulting to fryer 1 on load. Switching tabs SHALL reset the realtime view, emit `join_noi` with the selected fryer number, and load that fryer's current state.

#### Scenario: Default tab on load
- **WHEN** the dashboard first loads
- **THEN** tab "Hệ Chiên 1" is active, the client emits `join_noi` with `1`, and fryer 1's current state loads

#### Scenario: Switching tabs
- **WHEN** the user clicks a different fryer's tab
- **THEN** the previously active tab is deactivated and the clicked tab becomes active
- **AND** the realtime view resets, the client emits `join_noi` with the new fryer number, and the new fryer's current state loads

### Requirement: Realtime four-stage view

For the active fryer, the dashboard SHALL display the fryer number, the current `tong_thoi_gian_chay`, and four stage columns (Giai đoạn 1-4). For stages 1-3, each column SHALL show `thoi_gian_chay` (phút), `so_lan_nhung` (lần), `thoi_gian_nhung` (S), `thoi_gian_lap_lai` (phút), `nhiet_do_cai_dat` (độ C), and `vi_tri_muc_dau` from the stage's `set_giai_doan`. Stage 4 SHALL show only `thoi_gian_treo_long` (phút). The dashboard SHALL also display a 10-card sensor grid populated from the active stage's `data` object.

#### Scenario: Rendering a data event
- **WHEN** the client receives a `noi_chien_N_data` event (4-stage array) for the active fryer
- **THEN** each of the 4 stage columns renders its `set_giai_doan` fields with the same values and units as the previous EJS view
- **AND** the sensor grid renders `ap_suat_vo_hoi`, `ap_suat_chan_khong`, `ap_suat_vong_nuoc`, `nhiet_do`, `dong_dien_dong_co_root`, `dong_dien_dong_co_vong_nuoc`, `nhiet_do_vao_binh_sinh_han`, `nhiet_do_ra_binh_sinh_han`, `nhiet_do_vao_bom_vong_nuoc`, and `nhiet_do_ra_bom_vong_nuoc`

#### Scenario: Events for non-active fryers are ignored
- **WHEN** the client receives a `noi_chien_N_data` event for a fryer that is not the active tab
- **THEN** the realtime view is not updated

#### Scenario: Stage 4 shows only treo lòng
- **WHEN** stage 4 data is rendered
- **THEN** only `thoi_gian_treo_long` is shown for stage 4, and no stage 1-3 fields are shown for it

### Requirement: SVG donut stage timer

The active stage SHALL display a hand-drawn SVG donut progress timer (radius 27, circumference 169.646). The donut SHALL show elapsed minutes over target minutes as center text (`"<elapsed .1f> / <round(target)>"` above `"phút"`), fill proportionally to elapsed/target, use color `#00aaff` normally and `#fd7e14` when elapsed exceeds target, and update every second. The target minutes SHALL come from `set_giai_doan.thoi_gian_chay` for stages 1-3 and `set_giai_doan.thoi_gian_treo_long` for stage 4. Only the active stage SHALL show a donut; on stage transition the previous stage's donut SHALL be cleared.

#### Scenario: Active stage shows a running donut
- **WHEN** a stage is active (`active: true`) with a positive target
- **THEN** a donut renders on that stage, updates its elapsed time every second, and fills toward 100%

#### Scenario: Overtime coloring
- **WHEN** the elapsed minutes exceed the target minutes
- **THEN** the donut arc color changes to `#fd7e14`

#### Scenario: Seeding elapsed time from the running document
- **WHEN** a running batch is loaded and its stage's `bien_du_lieu` has at least 2 entries
- **THEN** the donut's start time is anchored directly to `bien_du_lieu[1]`'s timestamp (parsed as "HH:MM:SS DD/MM/YYYY", skipping the [0] init row), so elapsed = now − stage-start
- **AND** re-anchoring on tab switch is idempotent (tsFirst is constant, so the timer never resets)
- **AND** if no valid anchor is available (insufficient entries or unparseable timestamp) the timer returns null and the caller falls back to `Date.now()` for a stage that only just went active live
- **AND** a future anchor (clock skew) is clamped to `Date.now()` to prevent negative elapsed
- **AND** after the first live tick the timer continues from live time

#### Scenario: Stage transition clears the previous donut
- **WHEN** the active stage changes from one stage to another
- **THEN** the previous stage's donut is removed and the new active stage's donut is shown

#### Scenario: Inactive stage shows no donut
- **WHEN** a stage is not active
- **THEN** that stage shows no donut

### Requirement: Auto-load current fryer state on tab open

When a fryer tab becomes active, the dashboard SHALL fetch that fryer's batch list, select the most recent running batch (the newest batch with an empty `thoi_gian_stop`; if none is running, the newest batch), fetch that batch's full document, and rebuild the four stage views from it with `active: false`, showing the last recorded `bien_du_lieu` values for each stage — without waiting for the next socket tick. The selected running document SHALL be retained so the donut can seed its elapsed time on the first subsequent live tick.

#### Scenario: Running batch exists
- **WHEN** a fryer tab opens and that fryer has a batch with empty `thoi_gian_stop`
- **THEN** the newest such running batch is loaded and its last-recorded stage values are shown immediately with no active donut yet
- **AND** the running document is retained for donut seeding on the first live tick

#### Scenario: No running batch
- **WHEN** a fryer tab opens and no batch is running
- **THEN** the newest batch's last-recorded values are shown, and no document is retained for seeding

#### Scenario: No batches at all
- **WHEN** a fryer tab opens and the fryer has no batches
- **THEN** the realtime view is shown in its reset (zero) state

### Requirement: Batch stop resets the realtime view

When the client receives `noi_chien_N_stop` for the active fryer, the dashboard SHALL reset the realtime view to its zero state and notify the user that the batch completed via a non-blocking toast (replacing the previous blocking `alert`).

#### Scenario: Stop for the active fryer
- **WHEN** the client receives `noi_chien_N_stop` for the active fryer
- **THEN** the realtime view resets to zero and a toast "Đã hoàn thành mẻ hệ chiên N" is shown

#### Scenario: Stop for a non-active fryer
- **WHEN** the client receives `noi_chien_N_stop` for a fryer that is not the active tab
- **THEN** the active fryer's view is not reset

### Requirement: Batch list with view and delete

The dashboard SHALL show a "Danh sách mẻ chiên" section with a button to display the active fryer's batch list and a table with columns for start time, stop time, batch ID, and actions. Each row SHALL provide a "Xem" (view) action that loads the batch detail and a "Xóa" (delete) action that deletes the batch via `DELETE /xoa_noi_chien_detail` and refreshes the list. The batch list SHALL also be auto-loaded when a fryer tab opens.

#### Scenario: Display the batch list
- **WHEN** the user clicks the "Hiển thị danh sách" button, or a fryer tab opens
- **THEN** the client fetches `GET /get_noi_chien?so_noiChien=N` and renders one row per batch with its start time, stop time, ID, and Xem/Xóa actions

#### Scenario: View a batch
- **WHEN** the user clicks "Xem" on a batch row
- **THEN** the client fetches `GET /get_noi_chien_detail?id=<id>&so_noiChien=N` and renders the batch detail

#### Scenario: Delete a batch
- **WHEN** the user clicks "Xóa" on a batch row
- **THEN** the client sends `DELETE /xoa_noi_chien_detail?id=<id>&so_noiChien=N`, and on success refreshes the batch list and shows a non-blocking toast

### Requirement: Batch detail with per-stage averages, durations, and field dump

When a batch detail is viewed, the dashboard SHALL render a summary panel (start time, stop time, `tong_thoi_gian_chay`, and per-stage run durations) and a 4-column comparison table of per-sensor averages, then dump each `giai_doan_*` object. Each sensor average SHALL be computed as the sum of that field over `bien_du_lieu` divided by `(bien_du_lieu.length - 1)`, formatted to 2 decimals. Each stage's run duration SHALL be computed from `bien_du_lieu[1].thoi_gian` to the last entry's `thoi_gian` (parsed as "HH:MM:SS DD/MM/YYYY"), matching the previous EJS output. Stages whose `bien_du_lieu` length is ≤ 1 SHALL show duration `0` and SHALL not contribute averages.

#### Scenario: Averages for a stage with data
- **WHEN** a stage's `bien_du_lieu` has more than one entry
- **THEN** each sensor's cell shows the field's sum divided by `(length - 1)` to 2 decimals, for the ten sensors (áp suất vỏ hơi, áp suất chân không, áp suất vòng nước, nhiệt độ, dòng điện động cơ root, dòng điện động cơ vòng nước, nhiệt độ vào/ra bình sinh hàn, nhiệt độ vào/ra bơm vòng nước)

#### Scenario: Stage run duration
- **WHEN** a stage's `bien_du_lieu` has more than one entry
- **THEN** the stage's run duration is shown as "X phút Y giây" computed from `bien_du_lieu[1]` to the last entry

#### Scenario: Empty stage
- **WHEN** a stage's `bien_du_lieu` has one or zero entries
- **THEN** that stage's duration shows `0` and it contributes no averages

#### Scenario: Per-stage field dump
- **WHEN** the batch detail renders
- **THEN** each `giai_doan_*` object is dumped with its scalar fields and, when present, its `bien_du_lieu` rows in a table, matching the previous view

### Requirement: Type-safe payload consumption

The client SHALL define TypeScript types for every consumed payload (the stage object, its `set_giai_doan` variants for stages 1-3 versus stage 4, the sensor `data` object, the batch list item, and the full batch document) so that a mismatched or misspelled field is a compile-time error rather than a silent zero.

#### Scenario: Build fails on field mismatch
- **WHEN** the client code references a payload field name that does not exist in the typed contract
- **THEN** the TypeScript build fails rather than silently rendering an undefined value

#### Scenario: Clean typecheck and build
- **WHEN** `npm run build` runs for the client
- **THEN** TypeScript type-checking passes and a production bundle is produced

