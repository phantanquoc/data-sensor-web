/**
 * Kiểm chứng bộ dựng dữ liệu setpoint (nhiệt độ cài đặt) cho biểu đồ.
 *
 * Lý do tồn tại: setpointBuilder.ts được tách khỏi useFleetHistory để test
 * được không cần React/socket. Nếu không có file test này, ai đó có thể:
 *  - Bỏ guard "0 = no data" → vẽ phantom 0 °C kéo trục Y xuống 0 (squash cả 2 đường)
 *  - Cho phép live setpoint ở stage 4 → đường nét đứt chạy vào giai đoạn treo lòng
 *  - Chấp nhận timestamp lỗi → throw giữa render loop
 *  - Cho phút âm → kéo trục X vào vùng trước khi mẻ bắt đầu
 *
 * Format timestamp: "HH:MM:SS D/M/YYYY" — sản xuất bởi formatVietnamTimestamp()
 * trong utils/time.js (dùng Intl.DateTimeFormat Asia/Ho_Chi_Minh, hour/min/sec
 * luôn 2 chữ số, day/month đã Number() bỏ leading zero).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { register } = require("node:module");

// setpointBuilder.ts import './timeUtils' (không có extension .ts) — Node
// --experimental-strip-types yêu cầu extension tường minh cho relative import.
// Đăng ký custom resolve hook để thêm .ts khi resolve thất bại, giống cách
// Vite/tsc xử lý. Hook này an toàn — chỉ thêm .ts cho relative path không
// có extension và chỉ khi file .ts tồn tại trên đĩa.
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

const MOD = path.join(__dirname, "..", "client", "src", "hooks", "setpointBuilder.ts");
const { buildSetpointFromStage, buildBatchSetpointPoints, isLiveSetpointValid } = require(MOD);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Batch bắt đầu lúc 08:00:00 ngày 15/7/2026 (giờ Việt Nam).
// parseTs trả Date dựa trên local components (new Date(y, mo-1, d, h, m, s))
// nên batchStartMs phải khớp với cùng constructor.
const BATCH_START = new Date(2026, 6, 15, 8, 0, 0); // tháng 7 = index 6
const BATCH_START_MS = BATCH_START.getTime();

/** Tạo timestamp "HH:MM:SS D/M/YYYY" cách batch start N phút */
function tsAfter(minutes) {
  const d = new Date(BATCH_START_MS + minutes * 60000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildSetpointFromStage
// ═══════════════════════════════════════════════════════════════════════════════

test("happy path: entry hợp lệ → point với phut đúng, value đúng, stage đúng", () => {
  // Mỗi entry có nhiet_do_cai_dat > 0 và timestamp hợp lệ → tạo 1 point.
  // Guard: nếu ai sửa công thức tính phut (chia sai đơn vị) thì assert sẽ bắt.
  const entries = [
    { thoi_gian: tsAfter(5), nhiet_do_cai_dat: 90, nhiet_do: 35 },
    { thoi_gian: tsAfter(12), nhiet_do_cai_dat: 88, nhiet_do: 40 },
  ];
  const pts = buildSetpointFromStage(entries, 1, BATCH_START_MS);
  assert.equal(pts.length, 2);
  assert.equal(pts[0].phut, 5);
  assert.equal(pts[0].value, 90);
  assert.equal(pts[0].stage, 1);
  assert.equal(pts[1].phut, 12);
  assert.equal(pts[1].value, 88);
  assert.equal(pts[1].stage, 1);
});

test("nhiet_do_cai_dat = 0 → KHÔNG tạo point (guard phantom 0 °C squash Y axis)", () => {
  // BUG CỤ THỂ: nếu isValidSetpoint chấp nhận 0, chart sẽ vẽ điểm ở 0 °C
  // → trục Y zoom ra 0-100 thay vì 80-95 → cả 2 đường bị nén phẳng, khó đọc.
  // Đây là locked decision 7.
  const entries = [
    { thoi_gian: tsAfter(3), nhiet_do_cai_dat: 0, nhiet_do: 35 },
  ];
  const pts = buildSetpointFromStage(entries, 2, BATCH_START_MS);
  assert.equal(pts.length, 0, "giá trị 0 phải bị loại bỏ hoàn toàn");
});

test("nhiet_do_cai_dat missing/undefined/null/NaN → không tạo point", () => {
  // Guard: đảm bảo mọi dạng "không có dữ liệu" đều bị lọc, không chỉ 0.
  const entries = [
    { thoi_gian: tsAfter(1), nhiet_do: 30 },                          // missing
    { thoi_gian: tsAfter(2), nhiet_do_cai_dat: undefined, nhiet_do: 31 },
    { thoi_gian: tsAfter(3), nhiet_do_cai_dat: null, nhiet_do: 32 },
    { thoi_gian: tsAfter(4), nhiet_do_cai_dat: NaN, nhiet_do: 33 },
  ];
  const pts = buildSetpointFromStage(entries, 1, BATCH_START_MS);
  assert.equal(pts.length, 0, "tất cả dạng invalid đều phải bị bỏ qua");
});

test("thoi_gian không parse được → skip, không throw", () => {
  // Guard: backend có thể gửi timestamp rỗng/lỗi khi PLC mất kết nối.
  // Nếu parseTs throw thay vì trả null → crash toàn bộ chart render.
  // Lưu ý: parseTs chỉ từ chối chuỗi SAI CẤU TRÚC (thiếu phần, không split được),
  // KHÔNG từ chối giá trị overflow (JS Date tự wrap). Nên chỉ test các dạng
  // thực sự trả null.
  const entries = [
    { thoi_gian: "", nhiet_do_cai_dat: 90, nhiet_do: 35 },           // rỗng → null
    { thoi_gian: "garbage", nhiet_do_cai_dat: 90, nhiet_do: 36 },    // thiếu space split → null
    { thoi_gian: "12:30", nhiet_do_cai_dat: 90, nhiet_do: 37 },      // thiếu phần ngày → null
    { thoi_gian: null, nhiet_do_cai_dat: 90, nhiet_do: 38 },         // null → null
    { thoi_gian: undefined, nhiet_do_cai_dat: 90, nhiet_do: 39 },    // undefined → null
    { thoi_gian: "ab:cd:ef gh/ij/kl", nhiet_do_cai_dat: 90, nhiet_do: 40 }, // NaN parts → null
  ];
  // Phải không throw
  const pts = buildSetpointFromStage(entries, 1, BATCH_START_MS);
  // Timestamp rỗng/garbage → parseTs trả null → entry bị skip
  assert.equal(pts.length, 0);
});

test("timestamp TRƯỚC batch start (phut âm) → skip", () => {
  // Guard: nếu có entry lạc từ mẻ trước (data cũ chưa flush) mà chấp nhận,
  // trục X sẽ bắt đầu ở giá trị âm, biểu đồ bị lệch hẳn sang trái.
  const entries = [
    { thoi_gian: tsAfter(-5), nhiet_do_cai_dat: 90, nhiet_do: 34 }, // 5 phút trước batch
  ];
  const pts = buildSetpointFromStage(entries, 1, BATCH_START_MS);
  assert.equal(pts.length, 0, "phut < 0 phải bị loại");
});

test("mixed input: valid + zero + unparseable → chỉ giữ valid, đúng thứ tự", () => {
  // Guard tổng hợp: đảm bảo logic lọc không làm mất thứ tự hoặc duplicate.
  const entries = [
    { thoi_gian: tsAfter(2), nhiet_do_cai_dat: 90, nhiet_do: 30 },  // valid
    { thoi_gian: tsAfter(4), nhiet_do_cai_dat: 0, nhiet_do: 31 },   // zero → skip
    { thoi_gian: "invalid", nhiet_do_cai_dat: 88, nhiet_do: 32 },   // bad ts → skip
    { thoi_gian: tsAfter(8), nhiet_do_cai_dat: 85, nhiet_do: 33 },  // valid
  ];
  const pts = buildSetpointFromStage(entries, 3, BATCH_START_MS);
  assert.equal(pts.length, 2);
  assert.equal(pts[0].phut, 2);
  assert.equal(pts[0].value, 90);
  assert.equal(pts[0].stage, 3);
  assert.equal(pts[1].phut, 8);
  assert.equal(pts[1].value, 85);
  assert.equal(pts[1].stage, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildBatchSetpointPoints
// ═══════════════════════════════════════════════════════════════════════════════

test("ghép stages 1→3 theo thứ tự, mỗi point mang stage riêng, phut tính từ cùng batchStartMs", () => {
  // Guard: nếu ai reset phut cho mỗi stage (batchStart khác) thì trục X bị gãy,
  // đường setpoint nhảy lại 0 phút giữa chừng.
  const stages = [
    { stage: 1, entries: [
      { thoi_gian: tsAfter(2), nhiet_do_cai_dat: 90, nhiet_do: 30 },
      { thoi_gian: tsAfter(10), nhiet_do_cai_dat: 90, nhiet_do: 35 },
    ]},
    { stage: 2, entries: [
      { thoi_gian: tsAfter(15), nhiet_do_cai_dat: 88, nhiet_do: 40 },
    ]},
    { stage: 3, entries: [
      { thoi_gian: tsAfter(25), nhiet_do_cai_dat: 88, nhiet_do: 42 },
    ]},
  ];
  const pts = buildBatchSetpointPoints(stages, BATCH_START_MS);
  assert.equal(pts.length, 4);
  // Stage 1
  assert.equal(pts[0].phut, 2);
  assert.equal(pts[0].stage, 1);
  assert.equal(pts[1].phut, 10);
  assert.equal(pts[1].stage, 1);
  // Stage 2
  assert.equal(pts[2].phut, 15);
  assert.equal(pts[2].stage, 2);
  assert.equal(pts[2].value, 88);
  // Stage 3
  assert.equal(pts[3].phut, 25);
  assert.equal(pts[3].stage, 3);
});

test("stage với entries rỗng không gây lỗi, không đóng góp point nào", () => {
  // Guard: mẻ mới bắt đầu, stage 2 + 3 chưa có entry → không được throw.
  const stages = [
    { stage: 1, entries: [
      { thoi_gian: tsAfter(1), nhiet_do_cai_dat: 90, nhiet_do: 30 },
    ]},
    { stage: 2, entries: [] },
    { stage: 3, entries: [] },
  ];
  const pts = buildBatchSetpointPoints(stages, BATCH_START_MS);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].stage, 1);
});

test("mọi stage rỗng → trả [] (mẻ mới chưa có data), không throw", () => {
  // Guard: ngay khi batch document được tạo, chưa có bien_du_lieu nào cả.
  const stages = [
    { stage: 1, entries: [] },
    { stage: 2, entries: [] },
    { stage: 3, entries: [] },
  ];
  const pts = buildBatchSetpointPoints(stages, BATCH_START_MS);
  assert.deepEqual(pts, []);
});

test("setpoint-step thực tế: stage 1 ở 90, stages 2-3 ở 88 → value đổi đúng tại ranh giới stage", () => {
  // Đây là data shape thực tế quan sát trên máy: đường setpoint nét đứt bậc thang
  // nhảy từ 90 xuống 88 khi chuyển giai đoạn. Nếu ai sửa logic ghép gây mất
  // điểm cuối stage 1 hoặc đầu stage 2, bậc thang sẽ bị smooth hóa → sai nghiệp vụ.
  const stages = [
    { stage: 1, entries: [
      { thoi_gian: tsAfter(0), nhiet_do_cai_dat: 90, nhiet_do: 30 },
      { thoi_gian: tsAfter(5), nhiet_do_cai_dat: 90, nhiet_do: 35 },
      { thoi_gian: tsAfter(10), nhiet_do_cai_dat: 90, nhiet_do: 38 },
    ]},
    { stage: 2, entries: [
      { thoi_gian: tsAfter(11), nhiet_do_cai_dat: 88, nhiet_do: 40 },
      { thoi_gian: tsAfter(20), nhiet_do_cai_dat: 88, nhiet_do: 42 },
    ]},
    { stage: 3, entries: [
      { thoi_gian: tsAfter(21), nhiet_do_cai_dat: 88, nhiet_do: 43 },
      { thoi_gian: tsAfter(30), nhiet_do_cai_dat: 88, nhiet_do: 44 },
    ]},
  ];
  const pts = buildBatchSetpointPoints(stages, BATCH_START_MS);
  assert.equal(pts.length, 7);

  // Điểm cuối stage 1 vẫn ở 90
  const lastS1 = pts.filter(p => p.stage === 1).at(-1);
  assert.equal(lastS1.value, 90);
  assert.equal(lastS1.phut, 10);

  // Điểm đầu stage 2 nhảy xuống 88 — đây là ranh giới bậc thang
  const firstS2 = pts.filter(p => p.stage === 2)[0];
  assert.equal(firstS2.value, 88);
  assert.equal(firstS2.phut, 11);

  // Tất cả stage 2 + 3 đều 88
  const s23 = pts.filter(p => p.stage >= 2);
  assert.ok(s23.every(p => p.value === 88), "stages 2-3 phải đồng nhất 88");
});

// ═══════════════════════════════════════════════════════════════════════════════
// isLiveSetpointValid
// ═══════════════════════════════════════════════════════════════════════════════

test("stages 1, 2, 3 với giá trị dương hữu hạn → true", () => {
  // Guard: đây là trường hợp bình thường — live tick ở giai đoạn có setpoint.
  assert.equal(isLiveSetpointValid(1, 90), true);
  assert.equal(isLiveSetpointValid(2, 88), true);
  assert.equal(isLiveSetpointValid(3, 85.5), true);
});

test("stage 4 với BẤT KỲ value → false (locked decision 5: đường nét đứt KẾT THÚC ở stage 3)", () => {
  // BUG CỤ THỂ: PLC không điều khiển nhiệt độ ở giai đoạn treo lòng (stage 4),
  // không có thanh ghi Modbus cho nhiet_do_cai_dat ở GĐ4. Nếu guard này mất,
  // live tick sẽ append điểm setpoint vào stage 4 → đường nét đứt kéo dài
  // qua vùng không có ý nghĩa → gây hiểu nhầm cho operator.
  assert.equal(isLiveSetpointValid(4, 90), false);
  assert.equal(isLiveSetpointValid(4, 88), false);
  assert.equal(isLiveSetpointValid(4, 1), false);
  assert.equal(isLiveSetpointValid(4, 999), false);
});

test("stage ngoài phạm vi (0, 5, âm, lớn) → false", () => {
  // Guard: stageNum đến từ PLC register — nếu PLC gửi giá trị lỗi (0, 5, -1)
  // thì không được append vào chart.
  // Lưu ý: code chỉ check >= 1 && <= 3, không check integer (PLC luôn gửi int).
  assert.equal(isLiveSetpointValid(0, 90), false);
  assert.equal(isLiveSetpointValid(5, 90), false);
  assert.equal(isLiveSetpointValid(-1, 90), false);
  assert.equal(isLiveSetpointValid(100, 90), false);
});

test("value 0, undefined, null, NaN, non-number → false (dù stage hợp lệ)", () => {
  // Guard: giống logic buildSetpointFromStage — 0 = "PLC chưa ghi" chứ không
  // phải "nhiệt độ cài đặt = 0 °C". undefined/null/NaN = socket chưa nhận data.
  assert.equal(isLiveSetpointValid(1, 0), false);
  assert.equal(isLiveSetpointValid(2, undefined), false);
  assert.equal(isLiveSetpointValid(3, null), false);
  assert.equal(isLiveSetpointValid(1, NaN), false);
  assert.equal(isLiveSetpointValid(2, "90"), false, "string không phải number");
  assert.equal(isLiveSetpointValid(3, {}), false, "object không phải number");
  assert.equal(isLiveSetpointValid(1, Infinity), false, "Infinity không finite");
  assert.equal(isLiveSetpointValid(2, -Infinity), false);
});

test("hàm trả boolean thuần — hoạt động đúng dưới type stripping (không cần TS runtime)", () => {
  // Guard: isLiveSetpointValid được khai báo là type predicate (setpointValue is number).
  // Dưới --experimental-strip-types, type annotation bị strip → hàm phải vẫn trả
  // true/false bình thường mà không phụ thuộc vào TS type system.
  const resultTrue = isLiveSetpointValid(1, 90);
  const resultFalse = isLiveSetpointValid(4, 90);
  assert.equal(typeof resultTrue, "boolean");
  assert.equal(typeof resultFalse, "boolean");
  assert.equal(resultTrue, true);
  assert.equal(resultFalse, false);
});
