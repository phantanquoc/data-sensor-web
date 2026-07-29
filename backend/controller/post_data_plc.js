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

// --- HIỆU SUẤT MÁY: ảnh chụp tại sườn lên M1 / M155, per-fryer. ---
//
// Nguyên tắc: mỗi ô CHỐT MỘT LẦN rồi cố định vĩnh viễn. Không ghi đè, vì mục đích
// của bảng là thông số ĐÚNG TẠI thời điểm sự kiện — xem lại sau phải ra cùng số.
//
// Bốn nhóm ô, bốn cách chốt:
//
//  1. Cảm biến tức thời (nhiệt độ): chụp NGAY tại cycle bắt sườn lên.
//  2. Dòng điện (root + vòng nước): chốt ngay nếu giá trị trong (0, 50]. Nếu chưa dùng
//     được thì đợi tối đa DONG_DIEN_MAX_WAIT_CYCLES cycle VÀ chỉ khi còn trong pha của
//     mốc. Hết window → chốt null (UI hiện '—').
//  3. Thanh ghi PLC latch (thời gian VÀ áp suất — CHỐT ĐỘC LẬP): PLC ghi trễ vài
//     cycle, và hai thanh ghi này KHÔNG cập nhật cùng một scan (PLC dùng timer ghi
//     từng ô vào HMI ở thời điểm khác nhau, gateway đọc qua TCP theo poll cycle).
//     Mỗi ô đọc tối đa PLC_LATCH_MAX_READS lần độc lập; khác 0 → chốt ô đó. Hết lượt
//     vẫn 0 → chốt null (phân biệt "không đo được" với "đo được = 0"). Tách riêng để
//     ô về sớm không kéo ô về trễ chốt oan = 0.
//  4. Ghi DB: MỘT updateOne duy nhất mỗi cycle mỗi row. Cell chỉ đánh dấu Done SAU KHI
//     write resolve thành công; reject → giữ RAM, retry cycle sau.
const m1Prev = {};
const hieuSuatKickRoot = {};      // RAM snapshot của row kick_root
const hieuSuatNhungHang = {};     // RAM snapshot của row nhung_hang
// Theo dõi row đã persist thành công vào DB chưa (lần đầu = whole-object, sau = field-path)
const kickRootPersisted = {};     // true khi write whole-object thành công
const nhungHangPersisted = {};

// Số lần đọc lại tối đa cho nhóm thanh ghi PLC latch (thời gian + áp suất).
const PLC_LATCH_MAX_READS = 5;

// Số cycle tối đa chờ dòng điện hợp lệ (root + vòng nước, cả 2 mốc).
const DONG_DIEN_MAX_WAIT_CYCLES = 10;

// Cờ chốt từng ô, per-fryer. Reset ở đầu mẻ (Start === 1).
// Chốt riêng từng ô để một ô rác không giữ ô tốt lại chờ cùng: đo trên 258 mẻ,
// vòng nước hợp lệ 96.9% còn root chỉ ~61%.
//
// HAI LỚP CỜ (tách "giá trị ổn định trong RAM" khỏi "đã ghi DB"):
//   *Settled = giá trị đã xác định trong RAM → KHÔNG BAO GIỜ rollback. Bảo vệ RAM
//             khỏi bị window-close ghi đè null khi write DB thất bại.
//   *Done    = ô đã persist thành công vào DB. Khi write reject → rollback Done (để
//             retry write), nhưng Settled giữ nguyên nên RAM an toàn.
// Nhóm latch tách đôi: thời gian (D668/D666) và áp suất (D216/D217) chốt ĐỘC LẬP,
// mỗi ô một bộ đếm + cờ riêng vì PLC ghi hai thanh ghi lệch nhịp scan.
const kickRootTimeReads = {};    // số lần đã đọc thời gian của kick_root
const kickRootTimeSettled = {};  // giá trị thời gian đã xác định trong RAM (sticky)
const kickRootTimeDone = {};     // đã persist thời gian kick_root vào DB
const kickRootPresReads = {};    // số lần đã đọc áp suất của kick_root
const kickRootPresSettled = {};  // giá trị áp suất đã xác định trong RAM (sticky)
const kickRootPresDone = {};     // đã persist áp suất kick_root vào DB
const kickRootRootSettled = {};  // giá trị root current đã xác định trong RAM (sticky)
const kickRootRootDone = {};     // đã persist dòng điện root của kick_root vào DB
const kickRootVongNuocSettled = {}; // giá trị vòng nước current đã xác định trong RAM (sticky)
const kickRootVongNuocDone = {}; // đã persist dòng điện vòng nước của kick_root vào DB
const kickRootCycles = {};       // số cycle kể từ sườn lên M1 (đếm window chờ dòng điện)
const nhungHangTimeReads = {};   // số lần đã đọc thời gian của nhung_hang
const nhungHangTimeSettled = {}; // giá trị thời gian đã xác định trong RAM (sticky)
const nhungHangTimeDone = {};    // đã persist thời gian nhung_hang vào DB
const nhungHangPresReads = {};   // số lần đã đọc áp suất của nhung_hang
const nhungHangPresSettled = {}; // giá trị áp suất đã xác định trong RAM (sticky)
const nhungHangPresDone = {};    // đã persist áp suất nhung_hang vào DB
const nhungHangRootSettled = {}; // giá trị root current đã xác định trong RAM (sticky)
const nhungHangRootDone = {};    // đã persist dòng điện root của nhung_hang vào DB
const nhungHangVongNuocSettled = {}; // giá trị vòng nước current đã xác định trong RAM (sticky)
const nhungHangVongNuocDone = {}; // đã persist dòng điện vòng nước của nhung_hang vào DB
const nhungHangCycles = {};      // số cycle kể từ sườn lên M155

// Dòng điện mới nhất mỗi cycle, per-fryer. Dùng cho ô dòng điện khi cần chờ đọc lại.
const dongDienRootMoiNhat = {};
const dongDienVongNuocMoiNhat = {};

// Ngưỡng hợp lệ: dòng điện > giá trị này coi là nhiễu quá độ (inrush/transient garbage).
// Motor root ~5-12A, motor vòng nước ~10-25A → max thực tế < 50A.
const DONG_DIEN_MAX_REASONABLE = 50;
exports.DONG_DIEN_MAX_REASONABLE = DONG_DIEN_MAX_REASONABLE;
exports.PLC_LATCH_MAX_READS = PLC_LATCH_MAX_READS;
exports.DONG_DIEN_MAX_WAIT_CYCLES = DONG_DIEN_MAX_WAIT_CYCLES;

/**
 * Dòng điện có dùng được không? Phải trong (0, MAX].
 * 0 = chưa đọc kịp; > MAX = nhiễu quá độ lúc motor vừa nhận lệnh.
 */
function dongDienHopLe(v) {
  return Number.isFinite(v) && v > 0 && v <= DONG_DIEN_MAX_REASONABLE;
}
exports.dongDienHopLe = dongDienHopLe;

/**
 * Đã đến lúc chốt dòng điện chưa? (dùng chung cho root và vòng nước, cả 2 mốc)
 * Giá trị trong (0, 50] → chốt luôn. Ngoài dải → chưa chốt.
 * @param {number} v - dòng điện đọc ở cycle này
 */
function nenChotDongDien(v) {
  return dongDienHopLe(v);
}
exports.nenChotDongDien = nenChotDongDien;
// Giữ tên cũ cho tương thích ngược (test pure helper)
const nenChotDongDienRoot = nenChotDongDien;
exports.nenChotDongDienRoot = nenChotDongDienRoot;

/**
 * Đã đến lúc chốt MỘT ô latch PLC chưa? (dùng riêng cho thời gian HOẶC áp suất)
 * Thời gian và áp suất cập nhật lệch nhịp scan nên phải xét độc lập từng ô, không
 * gộp OR — nếu gộp, ô về sớm sẽ kéo ô về trễ chốt oan = 0.
 * Khác 0 → chốt luôn. Hết PLC_LATCH_MAX_READS lượt vẫn 0 → chốt null (không đo được).
 * @param {number} reads - lần đọc thứ mấy (1 = lần đầu)
 * @param {number} giaTri - giá trị ô này đọc ở cycle này (giây hoặc áp suất)
 */
function nenChotLatchPlcMotO(reads, giaTri) {
  return Number(giaTri) !== 0 || (Number(reads) || 0) >= PLC_LATCH_MAX_READS;
}
exports.nenChotLatchPlcMotO = nenChotLatchPlcMotO;

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

  // --- M1 (bắt đầu kick root) sườn lên → chụp cảm biến tại đúng thời điểm đó ---
  // Chụp vào RAM NGAY tại sườn lên, BẤT KỂ id_document có sẵn hay chưa.
  // Persist vào DB ở bước dưới — nếu id chưa có thì retry cycle sau.
  const m1Now = values && values["M1"] === true;
  if (Start > 1 && m1Now && !m1Prev[n] && !hieuSuatKickRoot[n]) {
    const snap = {
      ...buildPerfSnapshot(new Date()),
      giay_tu_start: null,             // chờ D668/D666 (nhóm latch)
      ap_suat_chan_khong: null,        // chờ D216/D217 (nhóm latch)
      dong_dien_dong_co_root: null,    // chờ dải hợp lệ
      dong_dien_dong_co_vong_nuoc: null, // chờ dải hợp lệ
    };
    hieuSuatKickRoot[n] = snap;
    kickRootCycles[n] = 0;
    kickRootPersisted[n] = false;
    dbg("nồi chiên " + n + " chụp hiệu suất kick root (M1) vào RAM");
  }
  m1Prev[n] = m1Now;

  // --- Chốt các ô còn chờ của kick_root + persist MỘT write duy nhất mỗi cycle ---
  // Mỗi ô chốt độc lập; cell Done chỉ set SAU KHI write thành công.
  const m155Now = giai_doan_1 === true;
  if (Start > 1 && hieuSuatKickRoot[n]) {
    kickRootCycles[n] = (kickRootCycles[n] || 0) + 1;
    // Window dòng điện: còn trong pha = M155 chưa lên. Hết window = cap hoặc qua pha.
    const kickRootWindowOpen = !m155Now && kickRootCycles[n] <= DONG_DIEN_MAX_WAIT_CYCLES;

    // Ghi nhận trạng thái TRƯỚC cycle này để biết ô nào vừa mới chốt
    const prevRootDone = !!kickRootRootDone[n];
    const prevVongNuocDone = !!kickRootVongNuocDone[n];
    const prevTimeDone = !!kickRootTimeDone[n];
    const prevPresDone = !!kickRootPresDone[n];

    // --- Dòng điện root ---
    // Chỉ đánh giá khi giá trị CHƯA ổn định trong RAM (Settled bảo vệ khỏi ghi đè)
    if (!kickRootRootSettled[n]) {
      const v = dongDienRootMoiNhat[n];
      if (dongDienHopLe(v)) {
        hieuSuatKickRoot[n].dong_dien_dong_co_root = v;
        kickRootRootSettled[n] = true;
        kickRootRootDone[n] = true;
      } else if (!kickRootWindowOpen) {
        // Window đóng, chốt null (không thay thế bằng giá trị sai thời điểm)
        hieuSuatKickRoot[n].dong_dien_dong_co_root = null;
        kickRootRootSettled[n] = true;
        kickRootRootDone[n] = true;
      }
    }

    // --- Dòng điện vòng nước ---
    if (!kickRootVongNuocSettled[n]) {
      const v = dongDienVongNuocMoiNhat[n];
      if (dongDienHopLe(v)) {
        hieuSuatKickRoot[n].dong_dien_dong_co_vong_nuoc = v;
        kickRootVongNuocSettled[n] = true;
        kickRootVongNuocDone[n] = true;
      } else if (!kickRootWindowOpen) {
        hieuSuatKickRoot[n].dong_dien_dong_co_vong_nuoc = null;
        kickRootVongNuocSettled[n] = true;
        kickRootVongNuocDone[n] = true;
      }
    }

    // --- Thời gian (D668/D666): tối đa PLC_LATCH_MAX_READS lần, chốt ĐỘC LẬP ---
    // Chỉ tăng bộ đếm khi giá trị CHƯA ổn định — write DB reject không tiêu hao budget.
    if (!kickRootTimeSettled[n]) {
      kickRootTimeReads[n] = (kickRootTimeReads[n] || 0) + 1;
      if (nenChotLatchPlcMotO(kickRootTimeReads[n], giay_m120_m1)) {
        hieuSuatKickRoot[n].giay_tu_start = giay_m120_m1 !== 0 ? giay_m120_m1 : null;
        kickRootTimeSettled[n] = true;
        kickRootTimeDone[n] = true;
        if (giay_m120_m1 === 0) dbg("nồi chiên " + n + " kick_root thời gian: hết " + PLC_LATCH_MAX_READS + " lần đọc vẫn 0 → chốt null");
      }
    }

    // --- Áp suất (D216/D217): tối đa PLC_LATCH_MAX_READS lần, chốt ĐỘC LẬP ---
    if (!kickRootPresSettled[n]) {
      kickRootPresReads[n] = (kickRootPresReads[n] || 0) + 1;
      if (nenChotLatchPlcMotO(kickRootPresReads[n], d_216_217)) {
        hieuSuatKickRoot[n].ap_suat_chan_khong = d_216_217 !== 0 ? d_216_217 : null;
        kickRootPresSettled[n] = true;
        kickRootPresDone[n] = true;
        if (d_216_217 === 0) dbg("nồi chiên " + n + " kick_root áp suất: hết " + PLC_LATCH_MAX_READS + " lần đọc vẫn 0 → chốt null");
      }
    }

    // --- Persist: MỘT updateOne duy nhất cho row kick_root trong cycle này ---
    // Ghi khi: (a) row chưa persist lần đầu, hoặc (b) có ô mới chốt trong cycle này,
    // hoặc (c) có ô đã settled nhưng chưa persist (write trước đó fail).
    const newlyLatchedRoot = !prevRootDone && !!kickRootRootDone[n];
    const newlyLatchedVN = !prevVongNuocDone && !!kickRootVongNuocDone[n];
    const newlyLatchedTime = !prevTimeDone && !!kickRootTimeDone[n];
    const newlyLatchedPres = !prevPresDone && !!kickRootPresDone[n];
    // Ô settled nhưng Done = false → write trước reject, cần retry
    const retryRoot = !!kickRootRootSettled[n] && !kickRootRootDone[n];
    const retryVN = !!kickRootVongNuocSettled[n] && !kickRootVongNuocDone[n];
    const retryTime = !!kickRootTimeSettled[n] && !kickRootTimeDone[n];
    const retryPres = !!kickRootPresSettled[n] && !kickRootPresDone[n];
    const hasNewCell = newlyLatchedRoot || newlyLatchedVN || newlyLatchedTime || newlyLatchedPres;
    const hasRetry = retryRoot || retryVN || retryTime || retryPres;
    if (id_document[n] && (!kickRootPersisted[n] || hasNewCell || hasRetry)) {
      try {
        if (!kickRootPersisted[n]) {
          // Lần đầu: ghi whole-object (row chưa tồn tại trong DB)
          await model.updateOne(
            { _id: id_document[n] },
            { $set: { "hieu_suat_may.kick_root": hieuSuatKickRoot[n] } },
          );
          kickRootPersisted[n] = true;
          // Whole-object ghi tất cả cells đã settled → đánh dấu Done cho chúng
          if (kickRootRootSettled[n]) kickRootRootDone[n] = true;
          if (kickRootVongNuocSettled[n]) kickRootVongNuocDone[n] = true;
          if (kickRootTimeSettled[n]) kickRootTimeDone[n] = true;
          if (kickRootPresSettled[n]) kickRootPresDone[n] = true;
        } else {
          // Đã persist rồi: chỉ ghi field-path cho các ô cần ghi (mới chốt hoặc retry)
          const set = {};
          if (newlyLatchedRoot || retryRoot) set["hieu_suat_may.kick_root.dong_dien_dong_co_root"] = hieuSuatKickRoot[n].dong_dien_dong_co_root;
          if (newlyLatchedVN || retryVN) set["hieu_suat_may.kick_root.dong_dien_dong_co_vong_nuoc"] = hieuSuatKickRoot[n].dong_dien_dong_co_vong_nuoc;
          if (newlyLatchedTime || retryTime) set["hieu_suat_may.kick_root.giay_tu_start"] = hieuSuatKickRoot[n].giay_tu_start;
          if (newlyLatchedPres || retryPres) set["hieu_suat_may.kick_root.ap_suat_chan_khong"] = hieuSuatKickRoot[n].ap_suat_chan_khong;
          if (Object.keys(set).length > 0) {
            await model.updateOne({ _id: id_document[n] }, { $set: set });
          }
          // Ghi thành công → mark Done cho các ô vừa ghi
          if (newlyLatchedRoot || retryRoot) kickRootRootDone[n] = true;
          if (newlyLatchedVN || retryVN) kickRootVongNuocDone[n] = true;
          if (newlyLatchedTime || retryTime) kickRootTimeDone[n] = true;
          if (newlyLatchedPres || retryPres) kickRootPresDone[n] = true;
        }
        dbg("nồi chiên " + n + " persist kick_root (cycle " + kickRootCycles[n] + ")");
      } catch (err) {
        // Write thất bại → rollback Done (để retry write cycle sau).
        // KHÔNG rollback Settled — giá trị RAM đã xác định, không bao giờ bị ghi đè.
        if (newlyLatchedRoot || retryRoot) kickRootRootDone[n] = false;
        if (newlyLatchedVN || retryVN) kickRootVongNuocDone[n] = false;
        if (newlyLatchedTime || retryTime) kickRootTimeDone[n] = false;
        if (newlyLatchedPres || retryPres) kickRootPresDone[n] = false;
        if (!kickRootPersisted[n]) {
          // Row chưa ghi lần đầu → retry whole-object cycle sau
        }
        console.log(err);
      }
    }
  }

  // --- M155 (vào Giai đoạn 1) rising edge → ghi số giây từ M120 start → vào GĐ1 + chụp hiệu suất (1 lần/mẻ) ---
  if (Start > 1 && m155Now && !m155Prev[n] && giayVaoGd1[n] == null && batchStartMs[n] != null) {
    giayVaoGd1[n] = Math.max(0, Math.round((Date.now() - batchStartMs[n]) / 1000));
  }
  // --- M155 sườn lên → chụp cảm biến vào RAM (BẤT KỂ id_document) ---
  // Dòng điện (root + vòng nước) cũng qua cùng rule: (0,50] → chốt, ngoài → chờ.
  if (Start > 1 && m155Now && !m155Prev[n] && !hieuSuatNhungHang[n]) {
    const snap = {
      ...buildPerfSnapshot(new Date()),
      giay_tu_start: null,             // chờ D676/D674 (nhóm latch)
      ap_suat_chan_khong: null,        // chờ D672/D673 (nhóm latch)
      dong_dien_dong_co_root: null,    // chờ dải hợp lệ
      dong_dien_dong_co_vong_nuoc: null, // chờ dải hợp lệ
    };
    hieuSuatNhungHang[n] = snap;
    nhungHangCycles[n] = 0;
    nhungHangPersisted[n] = false;
    dbg("nồi chiên " + n + " chụp hiệu suất nhúng hàng (M155) vào RAM");
  }

  // --- Chốt các ô còn chờ của nhung_hang + persist MỘT write duy nhất mỗi cycle ---
  if (Start > 1 && hieuSuatNhungHang[n]) {
    nhungHangCycles[n] = (nhungHangCycles[n] || 0) + 1;
    // Window dòng điện: còn trong Stage 1 = giai_doan_1 còn true. Cap + rời pha → đóng.
    const nhungHangWindowOpen = m155Now && nhungHangCycles[n] <= DONG_DIEN_MAX_WAIT_CYCLES;

    // Ghi nhận trạng thái TRƯỚC cycle này
    const prevNHRootDone = !!nhungHangRootDone[n];
    const prevNHVongNuocDone = !!nhungHangVongNuocDone[n];
    const prevNHTimeDone = !!nhungHangTimeDone[n];
    const prevNHPresDone = !!nhungHangPresDone[n];

    // --- Dòng điện root ---
    // Chỉ đánh giá khi giá trị CHƯA ổn định trong RAM (Settled bảo vệ khỏi ghi đè)
    if (!nhungHangRootSettled[n]) {
      const v = dongDienRootMoiNhat[n];
      if (dongDienHopLe(v)) {
        hieuSuatNhungHang[n].dong_dien_dong_co_root = v;
        nhungHangRootSettled[n] = true;
        nhungHangRootDone[n] = true;
      } else if (!nhungHangWindowOpen) {
        hieuSuatNhungHang[n].dong_dien_dong_co_root = null;
        nhungHangRootSettled[n] = true;
        nhungHangRootDone[n] = true;
      }
    }

    // --- Dòng điện vòng nước ---
    if (!nhungHangVongNuocSettled[n]) {
      const v = dongDienVongNuocMoiNhat[n];
      if (dongDienHopLe(v)) {
        hieuSuatNhungHang[n].dong_dien_dong_co_vong_nuoc = v;
        nhungHangVongNuocSettled[n] = true;
        nhungHangVongNuocDone[n] = true;
      } else if (!nhungHangWindowOpen) {
        hieuSuatNhungHang[n].dong_dien_dong_co_vong_nuoc = null;
        nhungHangVongNuocSettled[n] = true;
        nhungHangVongNuocDone[n] = true;
      }
    }

    // --- Thời gian (D676/D674): tối đa PLC_LATCH_MAX_READS lần, chốt ĐỘC LẬP ---
    // Chỉ tăng bộ đếm khi giá trị CHƯA ổn định — write DB reject không tiêu hao budget.
    if (!nhungHangTimeSettled[n]) {
      nhungHangTimeReads[n] = (nhungHangTimeReads[n] || 0) + 1;
      if (nenChotLatchPlcMotO(nhungHangTimeReads[n], giay_m1_m155)) {
        hieuSuatNhungHang[n].giay_tu_start = giay_m1_m155 !== 0 ? giay_m1_m155 : null;
        nhungHangTimeSettled[n] = true;
        nhungHangTimeDone[n] = true;
        if (giay_m1_m155 === 0) dbg("nồi chiên " + n + " nhung_hang thời gian: hết " + PLC_LATCH_MAX_READS + " lần đọc vẫn 0 → chốt null");
      }
    }

    // --- Áp suất (D672/D673): tối đa PLC_LATCH_MAX_READS lần, chốt ĐỘC LẬP ---
    if (!nhungHangPresSettled[n]) {
      nhungHangPresReads[n] = (nhungHangPresReads[n] || 0) + 1;
      if (nenChotLatchPlcMotO(nhungHangPresReads[n], d_672_673)) {
        hieuSuatNhungHang[n].ap_suat_chan_khong = d_672_673 !== 0 ? d_672_673 : null;
        nhungHangPresSettled[n] = true;
        nhungHangPresDone[n] = true;
        if (d_672_673 === 0) dbg("nồi chiên " + n + " nhung_hang áp suất: hết " + PLC_LATCH_MAX_READS + " lần đọc vẫn 0 → chốt null");
      }
    }

    // --- Persist: MỘT updateOne duy nhất cho row nhung_hang trong cycle này ---
    const newlyNHRoot = !prevNHRootDone && !!nhungHangRootDone[n];
    const newlyNHVN = !prevNHVongNuocDone && !!nhungHangVongNuocDone[n];
    const newlyNHTime = !prevNHTimeDone && !!nhungHangTimeDone[n];
    const newlyNHPres = !prevNHPresDone && !!nhungHangPresDone[n];
    // Ô settled nhưng Done = false → write trước reject, cần retry
    const retryNHRoot = !!nhungHangRootSettled[n] && !nhungHangRootDone[n];
    const retryNHVN = !!nhungHangVongNuocSettled[n] && !nhungHangVongNuocDone[n];
    const retryNHTime = !!nhungHangTimeSettled[n] && !nhungHangTimeDone[n];
    const retryNHPres = !!nhungHangPresSettled[n] && !nhungHangPresDone[n];
    const hasNewNHCell = newlyNHRoot || newlyNHVN || newlyNHTime || newlyNHPres;
    const hasNHRetry = retryNHRoot || retryNHVN || retryNHTime || retryNHPres;
    if (id_document[n] && (!nhungHangPersisted[n] || hasNewNHCell || hasNHRetry)) {
      try {
        if (!nhungHangPersisted[n]) {
          await model.updateOne(
            { _id: id_document[n] },
            { $set: { "hieu_suat_may.nhung_hang": hieuSuatNhungHang[n] } },
          );
          nhungHangPersisted[n] = true;
          // Whole-object ghi tất cả cells đã settled → đánh dấu Done cho chúng
          if (nhungHangRootSettled[n]) nhungHangRootDone[n] = true;
          if (nhungHangVongNuocSettled[n]) nhungHangVongNuocDone[n] = true;
          if (nhungHangTimeSettled[n]) nhungHangTimeDone[n] = true;
          if (nhungHangPresSettled[n]) nhungHangPresDone[n] = true;
        } else {
          const set = {};
          if (newlyNHRoot || retryNHRoot) set["hieu_suat_may.nhung_hang.dong_dien_dong_co_root"] = hieuSuatNhungHang[n].dong_dien_dong_co_root;
          if (newlyNHVN || retryNHVN) set["hieu_suat_may.nhung_hang.dong_dien_dong_co_vong_nuoc"] = hieuSuatNhungHang[n].dong_dien_dong_co_vong_nuoc;
          if (newlyNHTime || retryNHTime) set["hieu_suat_may.nhung_hang.giay_tu_start"] = hieuSuatNhungHang[n].giay_tu_start;
          if (newlyNHPres || retryNHPres) set["hieu_suat_may.nhung_hang.ap_suat_chan_khong"] = hieuSuatNhungHang[n].ap_suat_chan_khong;
          if (Object.keys(set).length > 0) {
            await model.updateOne({ _id: id_document[n] }, { $set: set });
          }
          // Ghi thành công → mark Done cho các ô vừa ghi
          if (newlyNHRoot || retryNHRoot) nhungHangRootDone[n] = true;
          if (newlyNHVN || retryNHVN) nhungHangVongNuocDone[n] = true;
          if (newlyNHTime || retryNHTime) nhungHangTimeDone[n] = true;
          if (newlyNHPres || retryNHPres) nhungHangPresDone[n] = true;
        }
        dbg("nồi chiên " + n + " persist nhung_hang (cycle " + nhungHangCycles[n] + ")");
      } catch (err) {
        // Write thất bại → rollback Done (để retry write cycle sau).
        // KHÔNG rollback Settled — giá trị RAM đã xác định, không bao giờ bị ghi đè.
        if (newlyNHRoot || retryNHRoot) nhungHangRootDone[n] = false;
        if (newlyNHVN || retryNHVN) nhungHangVongNuocDone[n] = false;
        if (newlyNHTime || retryNHTime) nhungHangTimeDone[n] = false;
        if (newlyNHPres || retryNHPres) nhungHangPresDone[n] = false;
        if (!nhungHangPersisted[n]) {
          // Row chưa ghi lần đầu → retry whole-object cycle sau
        }
        console.log(err);
      }
    }
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
      kickRootCycles[n] = 0;
      kickRootTimeReads[n] = 0;
      kickRootTimeSettled[n] = false;
      kickRootTimeDone[n] = false;
      kickRootPresReads[n] = 0;
      kickRootPresSettled[n] = false;
      kickRootPresDone[n] = false;
      kickRootRootSettled[n] = false;
      kickRootRootDone[n] = false;
      kickRootVongNuocSettled[n] = false;
      kickRootVongNuocDone[n] = false;
      kickRootPersisted[n] = false;
      nhungHangCycles[n] = 0;
      nhungHangTimeReads[n] = 0;
      nhungHangTimeSettled[n] = false;
      nhungHangTimeDone[n] = false;
      nhungHangPresReads[n] = 0;
      nhungHangPresSettled[n] = false;
      nhungHangPresDone[n] = false;
      nhungHangRootSettled[n] = false;
      nhungHangRootDone[n] = false;
      nhungHangVongNuocSettled[n] = false;
      nhungHangVongNuocDone[n] = false;
      nhungHangPersisted[n] = false;
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
