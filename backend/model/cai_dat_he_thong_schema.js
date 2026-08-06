const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Cấu hình hệ thống — document DUY NHẤT (singleton) cho cả dàn 8 nồi chiên.
 *
 * Lý do tồn tại: PLC không có thanh ghi áp suất chân không cài đặt (khác nhiệt
 * độ có D500/D502/D504), nên giá trị mục tiêu phải do người vận hành nhập tay.
 * Lưu ở server thay vì localStorage để mọi máy tính trong xưởng nhìn thấy CÙNG
 * một đường tham chiếu — hai người so cùng một mẻ mà thấy hai đường khác nhau
 * thì đường tham chiếu mất ý nghĩa.
 *
 * Lý do có chiều "máy": mỗi nồi chiên chạy công thức riêng và có đặc tính bơm
 * hút chân không riêng, nên một giá trị dùng chung cho cả dàn sẽ tạo đường mục
 * tiêu sai cho những nồi lệch khỏi mức chung. Mỗi máy 1..8 giữ bộ 4 giá trị của
 * chính nó.
 *
 * Lý do vẫn gom vào MỘT document thay vì tám: giao diện luôn nạp và lưu cả dàn
 * cùng lúc, nên tách tám document chỉ đổi lấy tám lượt ghi và nguy cơ lưu dở
 * dang một nửa dàn khi có lỗi giữa chừng.
 *
 * Lý do khoá máy đánh số từ 1: khớp với mọi định danh khác trong hệ (noi_chien_1
 * ..8, /may/:n, phòng socket noi_N) — đánh số từ 0 sẽ mời gọi lỗi lệch một đơn vị.
 *
 * Lý do có đủ 4 giai đoạn (nhiệt độ chỉ có 3): post_data_plc.js ghi
 * ap_suat_chan_khong vào cả newData_gd_4, nên giai đoạn 4 vẫn có dữ liệu đo.
 * Thiếu GĐ4 sẽ khiến đường mục tiêu đứt giữa chừng trong khi đường đo vẫn chạy
 * — người xem sẽ đọc nhầm thành mất dữ liệu.
 */
const apSuatCaiDatMaySchema = new Schema(
  {
    // default: null (KHÔNG phải 0) để phân biệt "chưa cài đặt" với "cài đặt = 0".
    // Nếu default 0, giai đoạn chưa nhập sẽ vẽ đường mục tiêu ở mức 0, kéo tụt
    // trục Y và bóp cả hai đường đo lên đỉnh biểu đồ.
    giai_doan_1: { type: Number, default: null },
    giai_doan_2: { type: Number, default: null },
    giai_doan_3: { type: Number, default: null },
    giai_doan_4: { type: Number, default: null },
  },
  { _id: false }
);

// Khoá là SỐ MÁY dạng chuỗi "1".."8" (Mongo chỉ nhận khoá chuỗi). Liệt kê tường
// minh thay vì Map để Mongoose ép kiểu và áp default: null cho từng giai đoạn.
const apSuatCaiDatSchema = new Schema(
  {
    1: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    2: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    3: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    4: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    5: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    6: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    7: { type: apSuatCaiDatMaySchema, default: () => ({}) },
    8: { type: apSuatCaiDatMaySchema, default: () => ({}) },
  },
  { _id: false }
);

const caiDatHeThongSchema = new Schema(
  {
    // Khoá cố định của singleton: mọi thao tác đọc/ghi đều lọc theo key này với
    // upsert, nhờ vậy không cần bước seed hay migration — lần lưu đầu tiên tự
    // tạo document.
    key: {
      type: String,
      default: "cai_dat_he_thong",
      unique: true,
    },
    ap_suat_cai_dat: {
      type: apSuatCaiDatSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("cai_dat_he_thong", caiDatHeThongSchema);
