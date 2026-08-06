/**
 * Kiểm chứng bộ dựng dữ liệu áp suất chân không mục tiêu cho biểu đồ.
 *
 * Lý do tồn tại: PLC KHÔNG có thanh ghi áp suất cài đặt, giá trị mục tiêu do
 * người vận hành nhập tay nên ranh giới "chưa cài đặt" rất dễ bị code sai.
 * Không có file test này, ai đó có thể:
 *  - Bỏ guard "0 = chưa cài đặt" → vẽ đường 0 kéo miền trục Y xuống tận 0 và
 *    bóp cả đường đo lẫn đường mục tiêu lên đỉnh biểu đồ (cùng lý do đã ghi
 *    trong test/setpoint_builder.test.js cho nhiệt độ)
 *  - Tra nhầm giai đoạn → điểm GĐ2 mang giá trị mục tiêu của GĐ1
 *  - Tra nhầm SỐ MÁY → nồi 5 vẽ theo mục tiêu của nồi 3, một mức tham chiếu
 *    sai mà người xem không có cách nào phát hiện bằng mắt
 *  - Cắt GĐ4 giống nhiệt độ → đường mục tiêu đứt giữa mẻ dù vẫn còn dữ liệu đo
 *  - Cho phút âm lọt qua → trục X kéo về vùng trước khi mẻ bắt đầu
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { register } = require("node:module");

// Node --experimental-strip-types yêu cầu extension tường minh cho relative
// import. Đăng ký resolve hook thêm .ts khi resolve thất bại, giống Vite/tsc.
register("data:text/javascript," + encodeURIComponent(`
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : '';
    const dir = path.dirname(parentPath);
    const candidate = path.join(dir, specifier + '.ts');
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`));

const MOD = path.join(
  __dirname, "..", "frontend", "src", "hooks", "pressureSetpointBuilder.ts",
);
const {
  buildPressureSetpointPoints,
  pressureSetpointForStage,
  isValidPressureSetpoint,
  hasAnyPressureSetpoint,
  machinePressureConfig,
  isValidMachineNumber,
} = require(MOD);

/** Điểm đo giả — builder chỉ đọc phut + stage, value là số đo thật (không dùng). */
function m(phut, stage, value = 700) {
  return { phut, value, stage };
}

const MAY_STAGES = {
  giai_doan_1: 700,
  giai_doan_2: 710,
  giai_doan_3: 720,
  giai_doan_4: 730,
};

/** Cấu hình một nồi duy nhất (nồi 1) đủ 4 giai đoạn. */
const FULL_CONFIG = { 1: { ...MAY_STAGES } };

/** Bọc một bộ giá trị giai đoạn thành cấu hình của nồi 1. */
function cfg1(stages) {
  return { 1: stages };
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildPressureSetpointPoints — ánh xạ theo giai đoạn
// ═══════════════════════════════════════════════════════════════════════════════

test("mỗi điểm đo sinh một điểm mục tiêu cùng phut, cùng giai đoạn", () => {
  const pts = buildPressureSetpointPoints(
    [m(0, 1), m(5, 1), m(10, 1)],
    cfg1({ giai_doan_1: 700, giai_doan_2: null, giai_doan_3: null, giai_doan_4: null }),
    1,
  );
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.map((p) => p.phut), [0, 5, 10]);
  assert.ok(pts.every((p) => p.value === 700 && p.stage === 1));
});

test("tra cứu phủ đủ 4 giai đoạn — mỗi điểm lấy giá trị của CHÍNH giai đoạn nó", () => {
  // Guard: nhiệt độ chỉ có GĐ1-3, rất dễ copy nhầm và bỏ mất GĐ4. Nhưng
  // post_data_plc.js CÓ ghi ap_suat_chan_khong vào GĐ4 nên phải vẽ tới hết mẻ.
  const pts = buildPressureSetpointPoints(
    [m(1, 1), m(2, 2), m(3, 3), m(4, 4)],
    FULL_CONFIG,
    1,
  );
  assert.equal(pts.length, 4);
  assert.deepEqual(
    pts.map((p) => [p.phut, p.stage, p.value]),
    [[1, 1, 700], [2, 2, 710], [3, 3, 720], [4, 4, 730]],
  );
});

test("giai đoạn chưa cài đặt bị bỏ qua, các giai đoạn khác VẪN vẽ bình thường", () => {
  // Guard: cài một phần là trạng thái hợp lệ — không được vì thiếu GĐ2 mà bỏ cả chuỗi.
  const pts = buildPressureSetpointPoints(
    [m(1, 1), m(2, 2), m(3, 3), m(4, 4)],
    cfg1({ giai_doan_1: 700, giai_doan_2: null, giai_doan_3: 720, giai_doan_4: null }),
    1,
  );
  assert.deepEqual(pts.map((p) => [p.phut, p.value]), [[1, 700], [3, 720]]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Chiều SỐ MÁY — mỗi nồi có mục tiêu riêng
// ═══════════════════════════════════════════════════════════════════════════════

test("mỗi nồi lấy đúng cấu hình của CHÍNH nó, không rơi sang nồi khác", () => {
  // Guard hồi quy quan trọng nhất của thay đổi này: trước đây một bộ giá trị
  // dùng chung cho cả dàn, giờ nồi 3 và nồi 5 phải cho hai đường khác nhau.
  const config = {
    3: { giai_doan_1: 700, giai_doan_2: null, giai_doan_3: null, giai_doan_4: null },
    5: { giai_doan_1: 640, giai_doan_2: null, giai_doan_3: null, giai_doan_4: null },
  };
  const measured = [m(0, 1), m(2, 1)];
  assert.deepEqual(
    buildPressureSetpointPoints(measured, config, 3).map((p) => p.value),
    [700, 700],
  );
  assert.deepEqual(
    buildPressureSetpointPoints(measured, config, 5).map((p) => p.value),
    [640, 640],
  );
});

test("nồi chưa cài đặt trả rỗng trong khi nồi đã cài vẫn sinh điểm", () => {
  const config = { 2: { ...MAY_STAGES } };
  const measured = [m(1, 1), m(2, 2)];
  assert.deepEqual(buildPressureSetpointPoints(measured, config, 2).length, 2);
  assert.deepEqual(buildPressureSetpointPoints(measured, config, 7), []);
  assert.equal(hasAnyPressureSetpoint(config, 2), true);
  assert.equal(hasAnyPressureSetpoint(config, 7), false);
});

test("khoá chuỗi từ JSON REST được chấp nhận như khoá số", () => {
  // Guard: JSON.parse luôn cho khoá chuỗi — nếu chỉ tra bằng khoá số thì toàn
  // bộ cấu hình tải từ REST sẽ im lặng biến mất khỏi biểu đồ.
  const config = { "4": { ...MAY_STAGES } };
  assert.deepEqual(machinePressureConfig(config, 4), MAY_STAGES);
  assert.equal(pressureSetpointForStage(config, 4, 2), 710);
});

test("số máy ngoài 1..8 hoặc không phải số nguyên → rỗng / null / false", () => {
  const config = { 1: { ...MAY_STAGES }, 8: { ...MAY_STAGES } };
  for (const bad of [0, 9, -1, 1.5, NaN, Infinity, "1", null, undefined, {}]) {
    assert.equal(isValidMachineNumber(bad), false, `số máy ${String(bad)} phải bị loại`);
    assert.deepEqual(buildPressureSetpointPoints([m(1, 1)], config, bad), []);
    assert.equal(pressureSetpointForStage(config, bad, 1), null);
    assert.equal(hasAnyPressureSetpoint(config, bad), false);
  }
  // Hai biên hợp lệ vẫn phải chạy.
  assert.equal(isValidMachineNumber(1), true);
  assert.equal(isValidMachineNumber(8), true);
  assert.equal(pressureSetpointForStage(config, 8, 1), 700);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 0 / null / NaN / Infinity / undefined = CHƯA CÀI ĐẶT
// ═══════════════════════════════════════════════════════════════════════════════

test("giá trị 0 → KHÔNG sinh điểm (guard đường 0 kéo trục Y xuống, bóp cả hai đường)", () => {
  const pts = buildPressureSetpointPoints(
    [m(1, 1), m(2, 1), m(3, 1)],
    cfg1({ giai_doan_1: 0, giai_doan_2: 0, giai_doan_3: 0, giai_doan_4: 0 }),
    1,
  );
  assert.equal(pts.length, 0, "0 phải bị coi là chưa cài đặt, không phải mục tiêu 0");
});

test("null / undefined / NaN / Infinity đều là chưa cài đặt", () => {
  const measured = [m(1, 1), m(2, 2), m(3, 3), m(4, 4)];
  const pts = buildPressureSetpointPoints(measured, cfg1({
    giai_doan_1: null,
    giai_doan_2: undefined,
    giai_doan_3: NaN,
    giai_doan_4: Infinity,
  }), 1);
  assert.equal(pts.length, 0);
});

test("-Infinity và giá trị không phải number cũng bị loại", () => {
  // Guard: dữ liệu tới từ REST nên kiểu có thể lệch nếu ai đó đổi shape API.
  assert.equal(isValidPressureSetpoint(-Infinity), false);
  assert.equal(isValidPressureSetpoint("700"), false, "chuỗi không phải number");
  assert.equal(isValidPressureSetpoint({}), false);
  assert.equal(isValidPressureSetpoint(null), false);
  assert.equal(isValidPressureSetpoint(undefined), false);
  assert.equal(isValidPressureSetpoint(0), false);
  assert.equal(isValidPressureSetpoint(700), true);
  assert.equal(isValidPressureSetpoint(680.5), true, "số thập phân phải hợp lệ");
});

test("cấu hình thiếu hoàn toàn (null) → không sinh điểm nào, không throw", () => {
  // Guard: trước khi REST trả về, cấu hình là null — không được làm sập chart.
  assert.deepEqual(buildPressureSetpointPoints([m(1, 1)], null, 1), []);
  assert.deepEqual(buildPressureSetpointPoints([m(1, 1)], undefined, 1), []);
  assert.deepEqual(buildPressureSetpointPoints([m(1, 1)], {}, 1), []);
  assert.deepEqual(buildPressureSetpointPoints([m(1, 1)], { 1: null }, 1), []);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Biên: phút âm, input rỗng
// ═══════════════════════════════════════════════════════════════════════════════

test("phut âm → bỏ qua (trục X bắt đầu từ lúc vào mẻ)", () => {
  const pts = buildPressureSetpointPoints(
    [m(-5, 1), m(-0.1, 1), m(0, 1), m(3, 1)],
    FULL_CONFIG,
    1,
  );
  assert.deepEqual(pts.map((p) => p.phut), [0, 3], "chỉ giữ phut >= 0");
});

test("phut không hữu hạn → bỏ qua, không throw", () => {
  const pts = buildPressureSetpointPoints(
    [m(NaN, 1), m(Infinity, 1), m(2, 1)],
    FULL_CONFIG,
    1,
  );
  assert.deepEqual(pts.map((p) => p.phut), [2]);
});

test("mảng đo rỗng → trả []", () => {
  assert.deepEqual(buildPressureSetpointPoints([], FULL_CONFIG, 1), []);
  assert.deepEqual(buildPressureSetpointPoints(null, FULL_CONFIG, 1), []);
  assert.deepEqual(buildPressureSetpointPoints(undefined, FULL_CONFIG, 1), []);
});

test("thứ tự điểm đo được giữ nguyên (buildMerged tra cứu nhị phân theo phut tăng dần)", () => {
  // Guard: nếu builder sắp xếp lại hoặc đảo thứ tự, findExactOrLastBefore ở
  // fleetChartData.ts sẽ trả sai giá trị vì nó giả định mảng đã tăng dần.
  const pts = buildPressureSetpointPoints(
    [m(0, 1), m(4, 1), m(9, 2), m(15, 3), m(22, 4)],
    FULL_CONFIG,
    1,
  );
  assert.deepEqual(pts.map((p) => p.phut), [0, 4, 9, 15, 22]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// pressureSetpointForStage / hasAnyPressureSetpoint
// ═══════════════════════════════════════════════════════════════════════════════

test("pressureSetpointForStage: giai đoạn ngoài 1..4 → null", () => {
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, 0), null);
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, 5), null);
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, -1), null);
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, 1.5), null, "không phải số nguyên");
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, 1), 700);
  assert.equal(pressureSetpointForStage(FULL_CONFIG, 1, 4), 730);
});

test("hasAnyPressureSetpoint: chỉ true khi có ít nhất một giai đoạn cài đặt hợp lệ", () => {
  // Dùng để bỏ qua hẳn việc dựng series khi chưa ai cài gì.
  assert.equal(hasAnyPressureSetpoint(null, 1), false);
  assert.equal(hasAnyPressureSetpoint({}, 1), false);
  assert.equal(
    hasAnyPressureSetpoint(
      cfg1({ giai_doan_1: 0, giai_doan_2: null, giai_doan_3: NaN, giai_doan_4: undefined }),
      1,
    ),
    false,
  );
  assert.equal(
    hasAnyPressureSetpoint(
      cfg1({ giai_doan_1: null, giai_doan_2: null, giai_doan_3: null, giai_doan_4: 730 }),
      1,
    ),
    true,
  );
});
