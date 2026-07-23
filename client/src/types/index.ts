/** 10 sensor fields emitted in each stage's `data` object */
export interface SensorData {
  ap_suat_vo_hoi: number;
  ap_suat_chan_khong: number;
  ap_suat_vong_nuoc: number;
  nhiet_do: number;
  dong_dien_dong_co_root: number;
  dong_dien_dong_co_vong_nuoc: number;
  nhiet_do_vao_binh_sinh_han: number;
  nhiet_do_ra_binh_sinh_han: number;
  nhiet_do_vao_bom_vong_nuoc: number;
  nhiet_do_ra_bom_vong_nuoc: number;
}

/** set_giai_doan for stages 1-3 */
export interface SetGiaiDoanStages123 {
  thoi_gian_chay: number;
  so_lan_nhung: number;
  thoi_gian_nhung: number;
  thoi_gian_lap_lai: number;
  nhiet_do_cai_dat: number;
  vi_tri_muc_dau: string | number;
}

/** Ảnh chụp full sensor tại thời điểm M6 lên true lần đầu trong mẻ (nhúng lòng đầu) */
export interface NhungLongDau extends SensorData {
  thoi_gian: string;
  thoi_gian_at?: string | null;
  /** Số giây từ lúc M120 start đến khi nhận M6 on lần đầu */
  giay_tu_start?: number | null;
  /** Số giây từ lúc M120 start đến khi vào GĐ1 (M155 on lần đầu) */
  giay_vao_gd1?: number | null;
}

/** set_giai_doan for stage 4 (thoi_gian_treo_long + ảnh chụp nhúng lòng đầu) */
export interface SetGiaiDoanStage4 {
  thoi_gian_treo_long: number;
  nhung_long_dau?: NhungLongDau | null;
}

/** A single stage payload as emitted in the noi_chien_N_data array */
export interface StagePayload {
  data: SensorData & { thoi_gian?: string; [key: string]: unknown };
  giai_doan: string;
  active: boolean;
  tong_thoi_gian_chay: number;
  set_giai_doan: SetGiaiDoanStages123 | SetGiaiDoanStage4;
}

/**
 * Wrapper payload for the noi_chien_N_data event.
 * New shape: { stages: StagePayload[], stage_elapsed_ms: number | null }
 * Backward-compat: raw StagePayload[] (old server without wrapper).
 */
export interface NoiChienDataPayload {
  stages: StagePayload[];
  stage_elapsed_ms?: number | null;
}

/** Batch list item (lean projection from GET /get_noi_chien) */
export interface BatchListItem {
  _id: string;
  ma_me_chien: string;
  ghi_chu: string;
  thoi_gian_start: string;
  thoi_gian_stop: string;
  thoi_gian_start_at?: string | null;
  thoi_gian_stop_at?: string | null;
  tong_thoi_gian_chay: number;
  dong_ep_khoi_dong?: boolean;
  trang_thai?: 'running' | 'completed' | 'forced';
}

/** bien_du_lieu entry for stages 1-3 */
export interface BienDuLieuEntry {
  thoi_gian: string;
  ap_suat_vo_hoi: number;
  ap_suat_chan_khong: number;
  ap_suat_vong_nuoc: number;
  nhiet_do: number;
  so_lan_nhung?: number;
  thoi_gian_nhung?: number;
  thoi_gian_lap_lai?: number;
  nhiet_do_cai_dat?: number;
  vi_tri_dung?: string | number;
  dong_dien_dong_co_root: number;
  dong_dien_dong_co_vong_nuoc: number;
  nhiet_do_vao_binh_sinh_han: number;
  nhiet_do_ra_binh_sinh_han: number;
  nhiet_do_vao_bom_vong_nuoc: number;
  nhiet_do_ra_bom_vong_nuoc: number;
  vi_tri_muc_dau?: string | number;
  [key: string]: unknown;
}

/** Stage stored in a batch document (giai_doan_1/2/3) */
export interface BatchStage123 {
  thoi_gian_chay: number;
  so_lan_nhung: number;
  thoi_gian_nhung: number;
  thoi_gian_lap_lai: number;
  nhiet_do_cai_dat: number;
  vi_tri_dung: string | number;
  bien_du_lieu: BienDuLieuEntry[];
  [key: string]: unknown;
}

/** Stage stored in a batch document (giai_doan_4) */
export interface BatchStage4 {
  thoi_gian_treo_long_gd_4?: number;
  thoi_gian_treo_long?: number;
  bien_du_lieu: BienDuLieuEntry[];
  [key: string]: unknown;
}

/** Full batch document from GET /get_noi_chien_detail */
export interface BatchDocument {
  _id: string;
  ma_me_chien: string;
  ghi_chu: string;
  thoi_gian_start: string;
  thoi_gian_stop: string;
  tong_thoi_gian_chay: number;
  giai_doan_1: BatchStage123;
  giai_doan_2: BatchStage123;
  giai_doan_3: BatchStage123;
  giai_doan_4: BatchStage4;
  nhung_long_dau?: NhungLongDau | null;
  [key: string]: unknown;
}
