/**
 * Quyết định thuần (không I/O) cho sức khoẻ kết nối Modbus.
 *
 * Tách riêng khỏi app.js để test được mà không phải mở server/socket.
 * app.js giữ phần I/O: gọi updateStatus / connect / setTimeout.
 */

// Bao nhiêu block đọc lỗi liên tiếp thì coi là mất kết nối thật (không phải
// timeout lẻ). Cycle ~800ms nên 3 cycle ≈ 2.4s — đủ ngắn để reconnect kịp,
// đủ dài để bỏ qua nhiễu một nhịp.
const STALE_CYCLES_BEFORE_DROP = 3;

/**
 * Một cycle đọc có đủ tươi để được ghi vào DB không?
 *
 * Chỉ những block chứa cảm biến đưa vào bien_du_lieu mới quyết định:
 * D2..D5 (áp suất), D81..D87 (áp vòng nước + 4 nhiệt độ bình), D134/135
 * (nhiệt độ chính), D571..D576 (dòng điện), và coil block chứa M120/M155
 * (trạng thái giai đoạn). Block config lỗi thì chỉ mất thông số cài đặt,
 * không làm sai điểm dữ liệu.
 *
 * @param {Array<string>} failedBlocks - nhãn block lỗi trong cycle, dạng "h2", "c15070"
 * @returns {boolean} true nếu được phép ghi DB
 */
function isCycleFresh(failedBlocks) {
  if (!Array.isArray(failedBlocks) || failedBlocks.length === 0) return true;
  const critical = new Set(["h2", "h60", "h81", "h134", "h572", "c15070"]);
  return !failedBlocks.some((b) => critical.has(b));
}

/**
 * Sau cycle này có nên hạ cờ kết nối để kích hoạt reconnect?
 *
 * @param {number} staleStreak - số cycle liên tiếp đã lỗi TRƯỚC cycle này
 * @param {boolean} cycleHadFailure - cycle này có block nào lỗi không
 * @returns {{streak: number, shouldDrop: boolean}} streak mới + có hạ cờ hay không
 */
function nextStaleState(staleStreak, cycleHadFailure) {
  if (!cycleHadFailure) return { streak: 0, shouldDrop: false };
  const streak = (Number(staleStreak) || 0) + 1;
  return { streak, shouldDrop: streak >= STALE_CYCLES_BEFORE_DROP };
}

module.exports = {
  STALE_CYCLES_BEFORE_DROP,
  isCycleFresh,
  nextStaleState,
};
