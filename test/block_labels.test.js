/**
 * Nhãn block trong isCycleFresh() được viết tay ("h134", "c15070"...). Nếu ai đó
 * đổi địa chỉ block trong app.js mà quên sửa danh sách critical thì cổng chặn ghi
 * lặng lẽ mất tác dụng — không có lỗi nào nổ ra. Test này đọc app.js và bắt lệch.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function parseBlocks(constName) {
  const m = APP.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(m, `không tìm thấy ${constName} trong app.js`);
  return [...m[1].matchAll(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)].map((x) => [
    Number(x[1]),
    Number(x[2]),
  ]);
}

const realtimeHolding = parseBlocks("REALTIME_HOLDING_BLOCKS");
const realtimeCoil = parseBlocks("REALTIME_COIL_BLOCKS");
const configHolding = parseBlocks("CONFIG_HOLDING_BLOCKS");

// Danh sách critical trong utils/modbus_health.js
const CRITICAL = fs
  .readFileSync(path.join(__dirname, "..", "utils", "modbus_health.js"), "utf8")
  .match(/new Set\(\[([^\]]*)\]\)/)[1]
  .match(/"([^"]+)"/g)
  .map((s) => s.replace(/"/g, ""));

test("mọi nhãn critical đều trỏ tới một block realtime thật", () => {
  const realLabels = new Set([
    ...realtimeHolding.map(([s]) => "h" + s),
    ...realtimeCoil.map(([s]) => "c" + s),
  ]);
  for (const label of CRITICAL) {
    assert.ok(
      realLabels.has(label),
      `nhãn critical "${label}" không khớp block realtime nào — cổng chặn ghi mất tác dụng`,
    );
  }
});

test("không có nhãn critical nào trỏ vào block config", () => {
  const configLabels = new Set(configHolding.map(([s]) => "h" + s));
  for (const label of CRITICAL) {
    assert.ok(
      !configLabels.has(label),
      `"${label}" là block config, lỗi nó không nên chặn ghi dữ liệu`,
    );
  }
});

test("các thanh ghi cảm biến đi vào bien_du_lieu đều nằm trong block critical", () => {
  // Từ newData_gd_* trong controller/post_data_plc.js: D2..D5, D81..D87,
  // D134/135, D571..D576. Cộng D60 (tong_thoi_gian_chay) và coil trạng thái.
  const sensorAddrs = [2, 3, 4, 5, 60, 81, 82, 84, 85, 86, 87, 134, 135, 571, 572, 575, 576];
  const criticalRanges = realtimeHolding
    .filter(([s]) => CRITICAL.includes("h" + s))
    .map(([s, c]) => [s, s + c]);

  for (const d of sensorAddrs) {
    // Offset HMI: D <= 400 → addr = D; D > 400 → addr = D + 1
    const addr = d <= 400 ? d : d + 1;
    const covered = criticalRanges.some(([lo, hi]) => addr >= lo && addr < hi);
    assert.ok(covered, `D${d} (modbus ${addr}) không nằm trong block critical nào`);
  }
});

test("coil trạng thái giai đoạn (M120/M124/M126/M127/M155) nằm trong block critical", () => {
  const coils = [120, 124, 126, 127, 155].map((m) => m + 15000);
  const ranges = realtimeCoil
    .filter(([s]) => CRITICAL.includes("c" + s))
    .map(([s, c]) => [s, s + c]);
  for (const addr of coils) {
    assert.ok(
      ranges.some(([lo, hi]) => addr >= lo && addr < hi),
      `coil ${addr} không nằm trong block critical`,
    );
  }
});
