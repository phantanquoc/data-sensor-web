/**
 * Chuẩn hoá cấu hình áp suất chân không cài đặt về dạng CÓ CHIỀU MÁY.
 *
 * Lý do tồn tại: bản trước lưu 4 giá trị dùng chung cho cả dàn (dạng "phẳng"),
 * và một hệ đang chạy thật đã có dữ liệu người vận hành nhập ở dạng đó. Nếu đọc
 * lên mà không hiểu dạng cũ, giao diện sẽ báo "chưa cài đặt" cho cả 8 máy —
 * không có lỗi nào hiện ra, người vận hành chỉ thấy trống rồi nhập đè lên, mất
 * sạch cấu hình cũ. Bung dạng cũ ra cả 8 máy ngay lúc đọc khiến việc di trú
 * không cần script, không cần ai nhớ chạy gì lúc triển khai, và chạy lại bao
 * nhiêu lần cũng cho cùng kết quả.
 *
 * Lý do là HÀM THUẦN, không đụng Mongoose/DB: đây là điểm duy nhất mà một lỗi
 * lập trình có thể âm thầm xoá cấu hình đang chạy của người vận hành, nên nó
 * phải kiểm chứng được bằng unit test độc lập, không cần dựng database.
 */

/** Số máy 1-based, khớp với noi_chien_1..8 / /may/:n / phòng socket noi_N. */
const MACHINE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const GIAI_DOAN_AP_SUAT = [
  "giai_doan_1",
  "giai_doan_2",
  "giai_doan_3",
  "giai_doan_4",
];

/**
 * Giá trị hợp lệ để LƯU là số hữu hạn không âm; mọi thứ khác về null.
 * Lưu ý: 0 vẫn hợp lệ ở tầng lưu trữ — tầng biểu đồ mới là nơi coi 0 là
 * "không vẽ đường", hai tầng cố ý tách nhau.
 */
function chuanHoaGiaTri(raw) {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** Bộ 4 giai đoạn toàn null — dùng cho máy chưa có cấu hình. */
function bonGiaiDoanRong() {
  const out = {};
  for (const gd of GIAI_DOAN_AP_SUAT) out[gd] = null;
  return out;
}

function chuanHoaMotMay(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return bonGiaiDoanRong();
  }
  const out = {};
  for (const gd of GIAI_DOAN_AP_SUAT) out[gd] = chuanHoaGiaTri(raw[gd]);
  return out;
}

/**
 * Dạng cũ nhận diện bằng việc có ÍT NHẤT một khoá giai_doan_* ngay ở mức gốc.
 * Dạng mới không bao giờ có khoá đó ở mức gốc (mức gốc chỉ có số máy), nên hai
 * dạng phân biệt được chắc chắn mà không cần cờ phiên bản trong document.
 */
function laDangPhangCu(apSuat) {
  if (!apSuat || typeof apSuat !== "object") return false;
  return GIAI_DOAN_AP_SUAT.some((gd) => gd in apSuat);
}

/**
 * Nhận document cấu hình đã lưu (hoặc null/rỗng) và trả về dạng có chiều máy:
 * { 1: {giai_doan_1..4}, ..., 8: {...} }.
 *
 * - Dạng phẳng cũ  → 4 giá trị áp cho cả 8 máy.
 * - Dạng theo máy  → giữ nguyên, chỉ chuẩn hoá kiểu và bù máy còn thiếu.
 * - Không có gì    → 8 máy toàn null.
 */
function expandApSuatCaiDat(doc) {
  const apSuat =
    doc && typeof doc === "object" && !Array.isArray(doc)
      ? doc.ap_suat_cai_dat
      : null;

  const out = {};

  if (laDangPhangCu(apSuat)) {
    const chung = chuanHoaMotMay(apSuat);
    for (const n of MACHINE_NUMBERS) out[n] = { ...chung };
    return out;
  }

  for (const n of MACHINE_NUMBERS) {
    // Khoá số máy có thể là số hoặc chuỗi tuỳ nguồn (Mongo trả chuỗi).
    const raw =
      apSuat && typeof apSuat === "object" ? apSuat[n] ?? apSuat[String(n)] : null;
    out[n] = chuanHoaMotMay(raw);
  }
  return out;
}

module.exports = {
  MACHINE_NUMBERS,
  GIAI_DOAN_AP_SUAT,
  expandApSuatCaiDat,
};
