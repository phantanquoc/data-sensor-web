const { Buffer } = require("buffer");
const { formatVietnamTimestamp, formatVietnamDateCode } = require("../utils/time");

const DEBUG = process.env.DEBUG === "true" || process.env.DEBUG === "1";
function dbg(...args) { if (DEBUG) console.log(...args); }

// id_document keyed by fryer index (n = 1..8), module-scoped in memory
// Behavior including loss on restart is unchanged.
const id_document = {};

const PUSH_EVERY_N_CYCLES = 5;   // K: mỗi 5 chu kỳ mới $push 1 điểm vào bien_du_lieu
const pushCount = {};            // pushCount[n] = {1,2,3,4} đếm số chu kỳ active mỗi giai đoạn

// Cache latest stagesArray per fryer for instant snapshot on client join
const latestStages = {};

// Server-authoritative stage-start timestamps (RAM). Anchored on each stage's
// rising edge; cleared on its falling edge. Lost on restart — elapsed timers
// restart from zero (stage timestamps are RAM-only, not recovered).
// stageStartMs[n] = { 1: ms|null, 2: ms|null, 3: ms|null, 4: ms|null }
const stageStartMs = {};

// M6 (đèn nhúng lòng) rising-edge tracking + ảnh chụp nhúng lòng đầu, per-fryer.
// m6Prev[n]: trạng thái M6 chu kỳ trước (bắt sườn lên).
// nhungLongDau[n]: snapshot đã chụp cho mẻ hiện tại (null = chưa chụp). Reset ở đầu mẻ.
const m6Prev = {};
const nhungLongDau = {};
// batchStartMs[n]: mốc M120 bắt đầu mẻ (ms) — để tính số giây từ start đến M6 on lần đầu.
const batchStartMs = {};
// M155 (vào Giai đoạn 1) rising-edge tracking, per-fryer.
// m155Prev[n]: trạng thái M155 chu kỳ trước (bắt sườn lên).
// giayVaoGd1[n]: số giây từ M120 start → M155 on lần đầu trong mẻ (null = chưa vào GĐ1). Reset ở đầu mẻ.
const m155Prev = {};
const giayVaoGd1 = {};

// --- HIỆU SUẤT MÁY: ảnh chụp full sensor tại sườn lên đầu tiên trong mẻ, per-fryer. ---
// m1Prev[n]: trạng thái M1 (bắt đầu kick root) chu kỳ trước (bắt sườn lên).
// hieuSuatKickRoot[n]: snapshot tại M1 on lần đầu (null = chưa chụp). Reset ở đầu mẻ.
// hieuSuatNhungHang[n]: snapshot tại M155 (null = chưa chụp). Reset ở đầu mẻ.
//   Chụp lại mỗi cycle khi M155 còn on cho tới khi ap_suat_chan_khong (D672) khác 0 thì khóa
//   — vì PLC latch D672 trễ vài chu kỳ sau sườn lên nhưng giữ giá trị suốt Giai đoạn 1.
const m1Prev = {};
const hieuSuatKickRoot = {};
const hieuSuatNhungHang = {};
// Đếm số cycle đã chụp lại nhúng hàng (tránh ghi DB vô hạn nếu dòng điện không ổn định).
// Sau MAX cycle → khóa snapshot dù dòng điện còn bất thường.
const nhungHangRetries = {};
const NHUNG_HANG_MAX_RETRIES = 20; // ~20 cycles ≈ 20-40s (cycle ~1-2s)

// Retry kick_root dòng điện: thay setTimeout(2s) bằng retry mỗi cycle cho tới khi hợp lệ.
const kickRootRetries = {};
const kickRootLocked = {};
const KICK_ROOT_MAX_RETRIES = 10; // ~10 cycles ≈ 8-16s

// Dòng điện mới nhất mỗi cycle, per-fryer. Dùng để chụp TRỄ cho cột "Dòng điện"
// của mốc kick_root (M1) & nhúng hàng (M155): tại sườn lên, motor vừa nhận lệnh →
// thanh ghi PLC có thể chứa giá trị quá độ (vài nghìn A). Sau vài giây motor ổn định
// → đọc lại giá trị này ghi đè vào snapshot.
const dongDienRootMoiNhat = {};
const dongDienVongNuocMoiNhat = {};

// Ngưỡng hợp lệ: dòng điện > giá trị này coi là nhiễu quá độ (inrush/transient garbage).
// Motor root ~5-12A, motor vòng nước ~10-25A → max thực tế < 50A.
const DONG_DIEN_MAX_REASONABLE = 50;
exports.DONG_DIEN_MAX_REASONABLE = DONG_DIEN_MAX_REASONABLE;

function temporaryBatchCode(n, startedAt, id) {
  const datePart = formatVietnamDateCode(startedAt);
  return `NC${n}-${datePart}-${String(id).slice(-6).toUpperCase()}`;
}

/**
 * postDataPlc - single parameterized function replacing the 8 post_data_to_db_* files.
 *
 * @param {object} model     - Mongoose model for noi_chien_N
 * @param {number} n         - fryer index 1..8
 * @param {object} values    - register values map
 * @param {object} io_       - Socket.IO server instance
 * @param {number} Start     - current Start counter (0, 1, or 2)
 * @param {*} giai_doan_1    - boolean or falsy (M155 coil)
 * @param {*} giai_doan_2    - boolean or falsy (M124 coil)
 * @param {*} giai_doan_3    - boolean or falsy (M126 coil)
 * @param {*} giai_doan_4    - boolean or falsy (M127 coil)
 */
exports.postDataPlc = async (
  model,
  n,
  values,
  io_,
  Start,
  giai_doan_1,
  giai_doan_2,
  giai_doan_3,
  giai_doan_4,
) => {
  // --- Float assembly (Buffer LE 32-bit pairs) ---
  let d2 = values && values["D2"] !== undefined ? values["D2"] : 0;
  let d3 = values && values["D3"] !== undefined ? values["D3"] : 0;
  const buf_2_3 = Buffer.alloc(4);
  buf_2_3.writeUInt16LE(d2, 0);
  buf_2_3.writeUInt16LE(d3, 2);
  let d_2_3 = parseFloat(buf_2_3.readFloatLE(0).toFixed(2));

  let d4 = values && values["D4"] !== undefined ? values["D4"] : 0;
  let d5 = values && values["D5"] !== undefined ? values["D5"] : 0;
  const buf_4_5 = Buffer.alloc(4);
  buf_4_5.writeUInt16LE(d4, 0);
  buf_4_5.writeUInt16LE(d5, 2);
  let d_4_5 = parseFloat(buf_4_5.readFloatLE(0).toFixed(2));

  let d81 = values && values["D81"] !== undefined ? values["D81"] : 0;
  let d82 = values && values["D82"] !== undefined ? values["D82"] : 0;
  const buf_81_82 = Buffer.alloc(4);
  buf_81_82.writeUInt16LE(d81, 0);
  buf_81_82.writeUInt16LE(d82, 2);
  let d_81_82 = parseFloat(buf_81_82.readFloatLE(0).toFixed(2));

  let d134 = values && values["D134"] !== undefined ? values["D134"] : 0;
  let d135 = values && values["D135"] !== undefined ? values["D135"] : 0;
  const buf_134_135 = Buffer.alloc(4);
  buf_134_135.writeUInt16LE(d134, 0);
  buf_134_135.writeUInt16LE(d135, 2);
  let d_134_135 = parseFloat(buf_134_135.readFloatLE(0).toFixed(2));

  let d575 = values && values["D575"] !== undefined ? values["D575"] : 0;
  let d576 = values && values["D576"] !== undefined ? values["D576"] : 0;
  const buf_575_576 = Buffer.alloc(4);
  buf_575_576.writeUInt16LE(d575, 0);
  buf_575_576.writeUInt16LE(d576, 2);
  let d_575_576 = parseFloat(buf_575_576.readFloatLE(0).toFixed(2));
  // Lưu dòng điện mới nhất mỗi cycle — dùng cho chụp trễ mốc kick_root & nhúng hàng.
  dongDienRootMoiNhat[n] = d_575_576;

  let d571 = values && values["D571"] !== undefined ? values["D571"] : 0;
  let d572 = values && values["D572"] !== undefined ? values["D572"] : 0;
  const buf_571_572 = Buffer.alloc(4);
  buf_571_572.writeUInt16LE(d571, 0);
  buf_571_572.writeUInt16LE(d572, 2);
  let d_571_572 = parseFloat(buf_571_572.readFloatLE(0).toFixed(2));
  dongDienVongNuocMoiNhat[n] = d_571_572;

  // --- HIỆU SUẤT MÁY: đọc thẳng từ PLC (thay cho giá trị tính ở server) ---
  // Áp suất bắt đầu kick root: D216 (float LE = D216 low + D217 high)
  let d216 = values && values["D216"] !== undefined ? values["D216"] : 0;
  let d217 = values && values["D217"] !== undefined ? values["D217"] : 0;
  const buf_216_217 = Buffer.alloc(4);
  buf_216_217.writeUInt16LE(d216 || 0, 0);
  buf_216_217.writeUInt16LE(d217 || 0, 2);
  let d_216_217 = parseFloat(buf_216_217.readFloatLE(0).toFixed(2));

  // Áp suất khi bắt đầu nhúng lồng: D672 (float LE = D672 low + D673 high)
  let d672 = values && values["D672"] !== undefined ? values["D672"] : 0;
  let d673 = values && values["D673"] !== undefined ? values["D673"] : 0;
  const buf_672_673 = Buffer.alloc(4);
  buf_672_673.writeUInt16LE(d672 || 0, 0);
  buf_672_673.writeUInt16LE(d673 || 0, 2);
  let d_672_673 = parseFloat(buf_672_673.readFloatLE(0).toFixed(2));

  // Thời gian bắt đầu → kick root (M120→M1): D668 phút + D666 giây → tổng giây
  let d666 = values && values["D666"] !== undefined ? Number(values["D666"]) || 0 : 0; // giây
  let d668 = values && values["D668"] !== undefined ? Number(values["D668"]) || 0 : 0; // phút
  const giay_m120_m1 = d668 * 60 + d666;
  // Thời gian kick root → hạ lồng (M1→M155): D676 phút + D674 giây → tổng giây
  let d674 = values && values["D674"] !== undefined ? Number(values["D674"]) || 0 : 0; // giây
  let d676 = values && values["D676"] !== undefined ? Number(values["D676"]) || 0 : 0; // phút
  const giay_m1_m155 = d676 * 60 + d674;

  // D84..D87 divided by 10
  let d84 = values && values["D84"] !== undefined ? values["D84"] : 0;
  let d85 = values && values["D85"] !== undefined ? values["D85"] : 0;
  let d86 = values && values["D86"] !== undefined ? values["D86"] : 0;
  let d87 = values && values["D87"] !== undefined ? values["D87"] : 0;

  let d60 = values && values["D60"] !== undefined ? values["D60"] : 0;

  // --- Stage params ---
  //giai đoạn 1
  let thoi_gian_chay_gd1 =
    values && values["D260"] !== undefined ? values["D260"] : 0;
  let so_lan_nhung_gd1 =
    values && values["D258"] !== undefined ? values["D258"] : 0;
  let thoi_gian_nhung_gd1 =
    values && values["D256"] !== undefined ? values["D256"] : 0;
  let thoi_gian_lap_lai_gd1 =
    values && values["D316"] !== undefined ? values["D316"] : 0;
  let nhiet_do_cai_dat_gd1 =
    values && values["D500"] !== undefined ? values["D500"] : 0;
  let gia_tri_muc_dau_gd_1 =
    values && values["D507"] !== undefined ? values["D507"] : 0;
  let vi_tri_muc_dau_gd_1;
  if (gia_tri_muc_dau_gd_1 === 0) vi_tri_muc_dau_gd_1 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_1 === 1) vi_tri_muc_dau_gd_1 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_1 === 2) vi_tri_muc_dau_gd_1 = "ngập dầu";

  //giai đoạn 2
  let thoi_gian_chay_gd2 =
    values && values["D202"] !== undefined ? values["D202"] : 0;
  let so_lan_nhung_gd2 =
    values && values["D262"] !== undefined ? values["D262"] : 0;
  let thoi_gian_nhung_gd2 =
    values && values["D204"] !== undefined ? values["D204"] : 0;
  let thoi_gian_lap_lai_gd2 =
    values && values["D264"] !== undefined ? values["D264"] : 0;
  let nhiet_do_cai_dat_gd2 =
    values && values["D502"] !== undefined ? values["D502"] : 0;
  let gia_tri_muc_dau_gd_2 =
    values && values["D508"] !== undefined ? values["D508"] : 0;
  let vi_tri_muc_dau_gd_2;
  if (gia_tri_muc_dau_gd_2 === 0) vi_tri_muc_dau_gd_2 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_2 === 1) vi_tri_muc_dau_gd_2 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_2 === 2) vi_tri_muc_dau_gd_2 = "ngập dầu";

  //giai đoạn 3
  let thoi_gian_chay_gd3 =
    values && values["D206"] !== undefined ? values["D206"] : 0;
  let so_lan_nhung_gd3 =
    values && values["D266"] !== undefined ? values["D266"] : 0;
  let thoi_gian_nhung_gd3 =
    values && values["D208"] !== undefined ? values["D208"] : 0;
  let thoi_gian_lap_lai_gd3 =
    values && values["D268"] !== undefined ? values["D268"] : 0;
  let nhiet_do_cai_dat_gd3 =
    values && values["D504"] !== undefined ? values["D504"] : 0;
  let gia_tri_muc_dau_gd_3 =
    values && values["D509"] !== undefined ? values["D509"] : 0;
  let vi_tri_muc_dau_gd_3;
  if (gia_tri_muc_dau_gd_3 === 0) vi_tri_muc_dau_gd_3 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_3 === 1) vi_tri_muc_dau_gd_3 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_3 === 2) vi_tri_muc_dau_gd_3 = "ngập dầu";

  //giai đoạn 4
  let thoi_gian_treo_long_gd4 =
    values && values["D214"] !== undefined ? values["D214"] : 0;

  // --- Document initial shape ---
  const batchStartedAt = new Date();
  const dataFormat = {
    ma_me_chien: "",
    ghi_chu: "",
    thoi_gian_start: formatVietnamTimestamp(batchStartedAt),
    thoi_gian_stop: "",
    thoi_gian_start_at: batchStartedAt,
    thoi_gian_stop_at: null,
    tong_thoi_gian_chay: 0,
    giai_doan_1: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [],
    },
    giai_doan_2: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [],
    },
    giai_doan_3: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [],
    },
    giai_doan_4: {
      thoi_gian_treo_long: 0,
      bien_du_lieu: [],
    },
  };

  const newData_gd_1 = {
    thoi_gian: formatVietnamTimestamp(),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd1,
    thoi_gian_nhung: thoi_gian_nhung_gd1,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd1,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd1,
    vi_tri_dung: vi_tri_muc_dau_gd_1,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_2 = {
    thoi_gian: formatVietnamTimestamp(),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd2,
    thoi_gian_nhung: thoi_gian_nhung_gd2,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd2,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd2,
    vi_tri_dung: vi_tri_muc_dau_gd_2,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_3 = {
    thoi_gian: formatVietnamTimestamp(),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd3,
    thoi_gian_nhung: thoi_gian_nhung_gd3,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd3,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd3,
    vi_tri_dung: vi_tri_muc_dau_gd_3,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_4 = {
    thoi_gian: formatVietnamTimestamp(),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  // --- Stage-start tracking + elapsed computation (server-authoritative) ---
  if (!stageStartMs[n]) stageStartMs[n] = { 1: null, 2: null, 3: null, 4: null };
  const activeFlags = [
    giai_doan_1 && typeof giai_doan_1 === "boolean",
    giai_doan_2 && typeof giai_doan_2 === "boolean",
    giai_doan_3 && typeof giai_doan_3 === "boolean",
    giai_doan_4 && typeof giai_doan_4 === "boolean",
  ];

  for (let k = 1; k <= 4; k++) {
    const wasActive = stageStartMs[n][k] !== null;
    const nowActive = !!activeFlags[k - 1];
    if (nowActive && !wasActive) {
      stageStartMs[n][k] = Date.now();
    } else if (!nowActive && wasActive) {
      stageStartMs[n][k] = null;
    }
  }

  const elapsedMeasuredAt = Date.now();
  let stage_elapsed_ms = null;
  for (let k = 1; k <= 4; k++) {
    if (activeFlags[k - 1] && stageStartMs[n][k] !== null) {
      stage_elapsed_ms = Math.max(0, elapsedMeasuredAt - stageStartMs[n][k]);
      break;
    }
  }

  // Helper: ảnh chụp hiệu suất máy tại 1 mốc sự kiện (full sensor + số giây từ M120 start).
  const buildPerfSnapshot = (capturedAt) => ({
    thoi_gian: formatVietnamTimestamp(capturedAt),
    thoi_gian_at: capturedAt,
    giay_tu_start:
      batchStartMs[n] != null
        ? Math.max(0, Math.round((capturedAt.getTime() - batchStartMs[n]) / 1000))
        : null,
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  });

  // --- M1 (bắt đầu kick root) rising edge → chụp hiệu suất máy (1 lần/mẻ) ---
  const m1Now = values && values["M1"] === true;
  if (Start > 1 && m1Now && !m1Prev[n] && !hieuSuatKickRoot[n] && id_document[n]) {
    // Thời gian + áp suất đọc thẳng từ PLC (D668/D666 phút·giây, D216 float).
    // Nhiệt độ + dòng điện giữ ảnh chụp cảm biến tại sườn lên (PLC không có thanh ghi riêng).
    const snap = {
      ...buildPerfSnapshot(new Date()),
      giay_tu_start: giay_m120_m1,     // D668 phút + D666 giây (thay giá trị tính ở server)
      ap_suat_chan_khong: d_216_217,   // D216 — áp suất bắt đầu kick root
    };
    hieuSuatKickRoot[n] = snap;
    model
      .updateOne({ _id: id_document[n] }, { $set: { "hieu_suat_may.kick_root": snap } })
      .catch((err) => console.log(err));
    dbg("nồi chiên " + n + " chụp hiệu suất kick root (M1)");
  }
  m1Prev[n] = m1Now;

  // Retry kick_root dòng điện: mỗi cycle kiểm tra lại cho tới khi giá trị hợp lệ hoặc hết retry.
  if (Start > 1 && hieuSuatKickRoot[n] && !kickRootLocked[n] && id_document[n]) {
    kickRootRetries[n] = (kickRootRetries[n] || 0) + 1;
    const dongDienRoot = dongDienRootMoiNhat[n];
    const dongDienVongNuoc = dongDienVongNuocMoiNhat[n];
    const rootOk = Number.isFinite(dongDienRoot) && dongDienRoot > 0 && dongDienRoot <= DONG_DIEN_MAX_REASONABLE;
    const vongNuocOk = Number.isFinite(dongDienVongNuoc) && dongDienVongNuoc > 0 && dongDienVongNuoc <= DONG_DIEN_MAX_REASONABLE;

    if (rootOk && vongNuocOk) {
      hieuSuatKickRoot[n].dong_dien_dong_co_root = dongDienRoot;
      hieuSuatKickRoot[n].dong_dien_dong_co_vong_nuoc = dongDienVongNuoc;
      model
        .updateOne({ _id: id_document[n] }, { $set: {
          "hieu_suat_may.kick_root.dong_dien_dong_co_root": dongDienRoot,
          "hieu_suat_may.kick_root.dong_dien_dong_co_vong_nuoc": dongDienVongNuoc,
        }})
        .catch((err) => console.log(err));
      kickRootLocked[n] = true;
      dbg("nồi chiên " + n + " cập nhật dòng điện (kick_root) cycle " + kickRootRetries[n] + ": root=" + dongDienRoot + " vòng nước=" + dongDienVongNuoc);
    } else if (kickRootRetries[n] >= KICK_ROOT_MAX_RETRIES) {
      kickRootLocked[n] = true;
      dbg("nồi chiên " + n + " kick_root dòng điện: hết retry (" + KICK_ROOT_MAX_RETRIES + " cycles), giữ giá trị hiện tại");
    }
  }

  // --- M155 (vào Giai đoạn 1) rising edge → ghi số giây từ M120 start → vào GĐ1 + chụp hiệu suất (1 lần/mẻ) ---
  const m155Now = giai_doan_1 === true;
  if (Start > 1 && m155Now && !m155Prev[n] && giayVaoGd1[n] == null && batchStartMs[n] != null) {
    giayVaoGd1[n] = Math.max(0, Math.round((Date.now() - batchStartMs[n]) / 1000));
  }
  // Chụp hiệu suất nhúng hàng. PLC latch D672 (áp suất), D674/D676 (thời gian) tại sườn lên
  // M155 nhưng có thể trễ vài chu kỳ scan → tại đúng cycle bắt sườn lên, D672 còn 0.
  // Vì PLC GIỮ ba giá trị này suốt Giai đoạn 1 (chỉ reset khi sang GĐ2), ta chụp lại mỗi
  // cycle khi M155 còn on cho tới khi áp suất khác 0 VÀ dòng điện hợp lệ thì KHÓA.
  // Fallback: sau NHUNG_HANG_MAX_RETRIES cycle → khóa dù dòng điện chưa hợp lệ.
  const nhHasAp = hieuSuatNhungHang[n] != null && Number(hieuSuatNhungHang[n].ap_suat_chan_khong) !== 0;
  const nhDongDienOk = hieuSuatNhungHang[n] != null &&
    hieuSuatNhungHang[n].dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    hieuSuatNhungHang[n].dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;
  const nhExhausted = (nhungHangRetries[n] || 0) >= NHUNG_HANG_MAX_RETRIES;
  const nhungHangLocked = nhHasAp && (nhDongDienOk || nhExhausted);
  if (Start > 1 && m155Now && !nhungHangLocked && id_document[n]) {
    nhungHangRetries[n] = (nhungHangRetries[n] || 0) + 1;
    // Thời gian = M1→M155 (D676 phút + D674 giây), áp suất = D672 float. Đọc thẳng từ PLC.
    const snap = {
      ...buildPerfSnapshot(new Date()),
      giay_tu_start: giay_m1_m155,     // D676 phút + D674 giây (kick root → hạ lồng)
      ap_suat_chan_khong: d_672_673,   // D672 — áp suất khi bắt đầu nhúng lồng
    };
    hieuSuatNhungHang[n] = snap;
    model
      .updateOne({ _id: id_document[n] }, { $set: { "hieu_suat_may.nhung_hang": snap } })
      .catch((err) => console.log(err));
    dbg(
      "nồi chiên " + n + " chụp hiệu suất nhúng hàng (M155)" +
        (Number(d_672_673) === 0
          ? " — áp suất=0, đọc lại cycle sau"
          : snap.dong_dien_dong_co_root > DONG_DIEN_MAX_REASONABLE || snap.dong_dien_dong_co_vong_nuoc > DONG_DIEN_MAX_REASONABLE
            ? " — dòng điện quá độ (" + snap.dong_dien_dong_co_root + "/" + snap.dong_dien_dong_co_vong_nuoc + "), đọc lại cycle sau"
            : " — đã chốt áp suất " + d_672_673),
    );
  }
  m155Prev[n] = m155Now;

  // --- M6 (đèn nhúng lòng) rising edge → chụp ảnh full sensor nhúng lòng đầu (1 lần/mẻ) ---
  const m6Now = values && values["M6"] === true;
  // Chỉ chụp khi mẻ đang chạy (Start>1): lúc đó document đã tạo và state đã reset cho mẻ này.
  // Trên cycle Start===1, document chưa tạo và id_document[n] còn của mẻ trước.
  if (Start > 1 && m6Now && !m6Prev[n] && !nhungLongDau[n] && id_document[n]) {
    const capturedAt = new Date();
    // Số giây từ lúc M120 start đến khi nhận M6 on lần đầu
    const giay_tu_start =
      batchStartMs[n] != null
        ? Math.max(0, Math.round((capturedAt.getTime() - batchStartMs[n]) / 1000))
        : null;
    const snapshot = {
      thoi_gian: formatVietnamTimestamp(capturedAt),
      thoi_gian_at: capturedAt,
      giay_tu_start,
      // Số giây từ M120 start → vào GĐ1 (M155 on lần đầu). Để so sánh với giay_tu_start (mốc M6).
      giay_vao_gd1: giayVaoGd1[n] != null ? giayVaoGd1[n] : null,
      ap_suat_vo_hoi: d_2_3,
      ap_suat_chan_khong: d_4_5,
      ap_suat_vong_nuoc: d_81_82,
      nhiet_do: d_134_135,
      dong_dien_dong_co_root: d_575_576,
      dong_dien_dong_co_vong_nuoc: d_571_572,
      nhiet_do_vao_binh_sinh_han: d84 / 10,
      nhiet_do_ra_binh_sinh_han: d85 / 10,
      nhiet_do_vao_bom_vong_nuoc: d86 / 10,
      nhiet_do_ra_bom_vong_nuoc: d87 / 10,
    };
    nhungLongDau[n] = snapshot;
    model
      .updateOne({ _id: id_document[n] }, { $set: { nhung_long_dau: snapshot } })
      .catch((err) => console.log(err));
    dbg("nồi chiên " + n + " chụp nhúng lòng đầu");
  }
  m6Prev[n] = m6Now;

  // --- Emit realtime data BEFORE DB writes (socket not blocked by Mongo) ---
  const stagesArray = [
    {
      data: newData_gd_1,
      giai_doan: "Giai đoạn: 1",
      active: giai_doan_1 && typeof giai_doan_1 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd1,
        so_lan_nhung: so_lan_nhung_gd1,
        thoi_gian_nhung: thoi_gian_nhung_gd1,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd1,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd1,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_1,
      },
    },
    {
      data: newData_gd_2,
      giai_doan: "Giai đoạn: 2",
      active: giai_doan_2 && typeof giai_doan_2 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd2,
        so_lan_nhung: so_lan_nhung_gd2,
        thoi_gian_nhung: thoi_gian_nhung_gd2,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd2,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd2,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_2,
      },
    },
    {
      data: newData_gd_3,
      giai_doan: "Giai đoạn: 3",
      active: giai_doan_3 && typeof giai_doan_3 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd3,
        so_lan_nhung: so_lan_nhung_gd3,
        thoi_gian_nhung: thoi_gian_nhung_gd3,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd3,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd3,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_3,
      },
    },
    {
      data: newData_gd_4,
      giai_doan: "Giai đoạn: 4",
      active: giai_doan_4 && typeof giai_doan_4 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_treo_long: thoi_gian_treo_long_gd4,
        nhung_long_dau: nhungLongDau[n] || null,
      },
    },
  ];
  // Cache the measurement instant so a late-joining client can be told how old
  // the cached elapsed value is (elapsed_age_ms) and compensate for it, instead
  // of treating a stale snapshot as "now" and lagging behind live listeners.
  latestStages[n] = { stages: stagesArray, stage_elapsed_ms, elapsedMeasuredAt };
  // Live listeners receive the value at measurement time → age 0.
  io_.to("noi_" + n).emit("noi_chien_" + n + "_data", { stages: stagesArray, stage_elapsed_ms, elapsed_age_ms: 0 });

  // --- Batch lifecycle ---
  // khởi tạo
  if (Start === 1) {
    // Đóng mọi mẻ chưa stop cũ của nồi này trước khi tạo mẻ mới
    const staleStoppedAt = new Date();
    await model.updateMany(
      { thoi_gian_stop: "" },
      {
        $set: {
          thoi_gian_stop: formatVietnamTimestamp(staleStoppedAt),
          thoi_gian_stop_at: staleStoppedAt,
        },
      },
    ).catch((err) => console.log(err));

    const docunent = await model.create(dataFormat).catch((err) => {
      console.log(err);
    });
    if (docunent) {
      await model.updateOne(
        { _id: docunent._id },
        { $set: { ma_me_chien: temporaryBatchCode(n, batchStartedAt, docunent._id) } },
      ).catch((err) => console.log(err));
      id_document[n] = docunent._id;
      pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      stageStartMs[n] = { 1: null, 2: null, 3: null, 4: null };
      // Mẻ mới → xóa ảnh chụp nhúng lòng cũ để chụp lại lần M6 lên đầu tiên của mẻ này.
      // Reset m6Prev để lần M6=true đầu tiên của mẻ mới luôn tính là sườn lên.
      nhungLongDau[n] = null;
      m6Prev[n] = false;
      // Reset mốc vào GĐ1 (M155) để bắt sườn lên lần đầu của mẻ mới.
      m155Prev[n] = false;
      giayVaoGd1[n] = null;
      // Reset hiệu suất máy (M1 kick root + M155 nhúng hàng) để chụp lại ở mẻ mới.
      m1Prev[n] = false;
      hieuSuatKickRoot[n] = null;
      hieuSuatNhungHang[n] = null;
      nhungHangRetries[n] = 0;
      kickRootRetries[n] = 0;
      kickRootLocked[n] = false;
      // Mốc bắt đầu mẻ để tính số giây từ M120 start → M6 on lần đầu
      batchStartMs[n] = batchStartedAt.getTime();
    }
  }
  // update
  if (Start > 1) {
    //giai đoạn 1
    if (giai_doan_1 && typeof giai_doan_1 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][1]++;
      const isPushCycle_1 = (pushCount[n][1] % PUSH_EVERY_N_CYCLES === 1);
      if (isPushCycle_1) {
        const update_1 = {
          $set: {
            tong_thoi_gian_chay: d60,
            "giai_doan_1.thoi_gian_chay": thoi_gian_chay_gd1,
            "giai_doan_1.so_lan_nhung": so_lan_nhung_gd1,
            "giai_doan_1.thoi_gian_nhung": thoi_gian_nhung_gd1,
            "giai_doan_1.thoi_gian_lap_lai": thoi_gian_lap_lai_gd1,
            "giai_doan_1.nhiet_do_cai_dat": nhiet_do_cai_dat_gd1,
            "giai_doan_1.vi_tri_dung": vi_tri_muc_dau_gd_1,
          },
          $push: { "giai_doan_1.bien_du_lieu": newData_gd_1 },
        };
        await model
          .updateOne({ _id: id_document[n] }, update_1)
          .catch((err) => console.log(err));
        dbg("nồi chiên " + n + " giai đoạn 1");
      }
    }
    // giai đoạn 2
    if (giai_doan_2 && typeof giai_doan_2 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][2]++;
      const isPushCycle_2 = (pushCount[n][2] % PUSH_EVERY_N_CYCLES === 1);
      if (isPushCycle_2) {
        const update_2 = {
          $set: {
            tong_thoi_gian_chay: d60,
            "giai_doan_2.thoi_gian_chay": thoi_gian_chay_gd2,
            "giai_doan_2.so_lan_nhung": so_lan_nhung_gd2,
            "giai_doan_2.thoi_gian_nhung": thoi_gian_nhung_gd2,
            "giai_doan_2.thoi_gian_lap_lai": thoi_gian_lap_lai_gd2,
            "giai_doan_2.nhiet_do_cai_dat": nhiet_do_cai_dat_gd2,
            "giai_doan_2.vi_tri_dung": vi_tri_muc_dau_gd_2,
          },
          $push: { "giai_doan_2.bien_du_lieu": newData_gd_2 },
        };
        await model
          .updateOne({ _id: id_document[n] }, update_2)
          .catch((err) => console.log(err));
        dbg("nồi chiên " + n + " giai đoạn 2");
      }
    }
    //giai đoạn 3
    if (giai_doan_3 && typeof giai_doan_3 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][3]++;
      const isPushCycle_3 = (pushCount[n][3] % PUSH_EVERY_N_CYCLES === 1);
      if (isPushCycle_3) {
        const update_3 = {
          $set: {
            tong_thoi_gian_chay: d60,
            "giai_doan_3.thoi_gian_chay": thoi_gian_chay_gd3,
            "giai_doan_3.so_lan_nhung": so_lan_nhung_gd3,
            "giai_doan_3.thoi_gian_nhung": thoi_gian_nhung_gd3,
            "giai_doan_3.thoi_gian_lap_lai": thoi_gian_lap_lai_gd3,
            "giai_doan_3.nhiet_do_cai_dat": nhiet_do_cai_dat_gd3,
            "giai_doan_3.vi_tri_dung": vi_tri_muc_dau_gd_3,
          },
          $push: { "giai_doan_3.bien_du_lieu": newData_gd_3 },
        };
        await model
          .updateOne({ _id: id_document[n] }, update_3)
          .catch((err) => console.log(err));
        dbg("nồi chiên " + n + " giai đoạn: 3");
      }
    }
    //giai đoạn 4
    if (giai_doan_4 && typeof giai_doan_4 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][4]++;
      const isPushCycle_4 = (pushCount[n][4] % PUSH_EVERY_N_CYCLES === 1);
      if (isPushCycle_4) {
        const update_4 = {
          $set: {
            tong_thoi_gian_chay: d60,
            "giai_doan_4.thoi_gian_treo_long": thoi_gian_treo_long_gd4,
          },
          $push: { "giai_doan_4.bien_du_lieu": newData_gd_4 },
        };
        await model
          .updateOne({ _id: id_document[n] }, update_4)
          .catch((err) => console.log(err));
        dbg("nồi chiên " + n + " giai đoạn 4");
      }
    }
  }

  // update stop — flush final values + set thoi_gian_stop
  if (Start === 0) {
    if (!id_document[n]) return;
    const batchStoppedAt = new Date();
    await model.updateOne(
      { _id: id_document[n] },
      {
        $set: {
          thoi_gian_stop: formatVietnamTimestamp(batchStoppedAt),
          thoi_gian_stop_at: batchStoppedAt,
          tong_thoi_gian_chay: d60,
          "giai_doan_1.thoi_gian_chay": thoi_gian_chay_gd1,
          "giai_doan_1.so_lan_nhung": so_lan_nhung_gd1,
          "giai_doan_1.thoi_gian_nhung": thoi_gian_nhung_gd1,
          "giai_doan_1.thoi_gian_lap_lai": thoi_gian_lap_lai_gd1,
          "giai_doan_1.nhiet_do_cai_dat": nhiet_do_cai_dat_gd1,
          "giai_doan_1.vi_tri_dung": vi_tri_muc_dau_gd_1,
          "giai_doan_2.thoi_gian_chay": thoi_gian_chay_gd2,
          "giai_doan_2.so_lan_nhung": so_lan_nhung_gd2,
          "giai_doan_2.thoi_gian_nhung": thoi_gian_nhung_gd2,
          "giai_doan_2.thoi_gian_lap_lai": thoi_gian_lap_lai_gd2,
          "giai_doan_2.nhiet_do_cai_dat": nhiet_do_cai_dat_gd2,
          "giai_doan_2.vi_tri_dung": vi_tri_muc_dau_gd_2,
          "giai_doan_3.thoi_gian_chay": thoi_gian_chay_gd3,
          "giai_doan_3.so_lan_nhung": so_lan_nhung_gd3,
          "giai_doan_3.thoi_gian_nhung": thoi_gian_nhung_gd3,
          "giai_doan_3.thoi_gian_lap_lai": thoi_gian_lap_lai_gd3,
          "giai_doan_3.nhiet_do_cai_dat": nhiet_do_cai_dat_gd3,
          "giai_doan_3.vi_tri_dung": vi_tri_muc_dau_gd_3,
          "giai_doan_4.thoi_gian_treo_long": thoi_gian_treo_long_gd4,
        },
      },
    ).catch((err) => console.log(err));
    console.log("nồi chiên " + n + " đã stop mẻ");
    io_.to("noi_" + n).emit("noi_chien_" + n + "_stop", {
      stop: "đã hoàn thành xong mẻ chiên",
    });
  }

};

exports.getLatestStages = (n) => {
  const snap = latestStages[n];
  if (!snap) return snap;
  // Re-derive how stale the cached elapsed value is at join time so the client
  // can anchor correctly (receivedAt = now - elapsed_age_ms) and match the live
  // listeners immediately, instead of jumping a full emit-gap later.
  const elapsed_age_ms = snap.elapsedMeasuredAt != null
    ? Math.max(0, Date.now() - snap.elapsedMeasuredAt)
    : 0;
  return { stages: snap.stages, stage_elapsed_ms: snap.stage_elapsed_ms, elapsed_age_ms };
};

// --- Resume helpers (used by app.js on restart) ---

/**
 * Restore in-memory doc id so update/stop branches write to the correct document.
 */
exports.setBatchDocId = function setBatchDocId(n, id) {
  id_document[n] = id;
};

/**
 * Restore in-memory batch start timestamp so giay_tu_start is correct after resume.
 */
exports.setBatchStartMs = function setBatchStartMs(n, ms) {
  batchStartMs[n] = ms;
};

/**
 * Pure predicate: does liveD60 indicate a NEW physical batch started
 * while the server was down? (D60 went backwards meaningfully.)
 * @param {number|undefined} liveD60  - machine's current total run-time (minutes)
 * @param {number|undefined} resumedTong - tong_thoi_gian_chay stored on the open doc
 * @param {number} [eps=2] - tolerance in minutes for rounding/noise
 * @returns {boolean} true => new batch started during downtime, do NOT resume old doc
 */
exports.shouldResumeAsNewBatch = function shouldResumeAsNewBatch(liveD60, resumedTong, eps = 2) {
  const live = Number(liveD60) || 0;
  const prev = Number(resumedTong) || 0;
  return live + eps < prev;
};
