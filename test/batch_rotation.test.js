/**
 * Test quy tắc "một máy sang mẻ mới thì mẻ hiện tại của nó xuống Mẻ trước".
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MOD = path.join(__dirname, "..", "client", "src", "hooks", "batchRotation.ts");
const { decideRotation, REANCHOR_TOL_MS } = require(MOD);

const T0 = Date.UTC(2026, 6, 27, 5, 0, 0);

/** Tick "bình thường": đang chạy giai đoạn 1, mốc khớp, đồng hồ tăng. */
function steadyTick(over = {}) {
  return {
    stageNum: 1,
    elapsedMs: 5 * 60000,
    sensorTsMs: T0 + 5 * 60000,
    currentMark: T0,
    running: true,
    previousStage: 1,
    prevElapsed: 4 * 60000,
    ...over,
  };
}

test("tick bình thường không tạo mẻ mới", () => {
  const d = decideRotation(steadyTick());
  assert.equal(d.startsNewBatch, false);
  assert.equal(d.reason, null);
});

test("máy đã dừng rồi chạy lại → mẻ mới", () => {
  const d = decideRotation(steadyTick({ running: false }));
  assert.equal(d.startsNewBatch, true);
  assert.match(d.reason, /dừng/);
});

test("quay về giai đoạn 1 sau giai đoạn sau → mẻ mới", () => {
  for (const prev of [2, 3, 4]) {
    const d = decideRotation(steadyTick({ previousStage: prev, elapsedMs: 1000, prevElapsed: null }));
    assert.equal(d.startsNewBatch, true, `từ giai đoạn ${prev}`);
  }
});

test("đồng hồ giai đoạn tụt lùi → mẻ mới", () => {
  const d = decideRotation(steadyTick({ elapsedMs: 1000, prevElapsed: 40 * 60000 }));
  assert.equal(d.startsNewBatch, true);
});

test("mốc bắt đầu lệch quá ngưỡng → mẻ mới", () => {
  const drift = REANCHOR_TOL_MS + 60000;
  const d = decideRotation(steadyTick({ currentMark: T0 - drift }));
  assert.equal(d.startsNewBatch, true);
  assert.match(d.reason, /lệch/);
});

test("lệch trong ngưỡng cho phép thì KHÔNG tạo mẻ mới", () => {
  // Sai số nhỏ do nhịp emit, không phải mẻ mới — nếu tính là mẻ mới thì biểu đồ
  // sẽ bị reset liên tục giữa mẻ.
  const d = decideRotation(steadyTick({ currentMark: T0 - (REANCHOR_TOL_MS - 1000) }));
  assert.equal(d.startsNewBatch, false);
});

test("chưa có mốc nào (mở trang giữa mẻ) → nhận mốc từ server", () => {
  const d = decideRotation(steadyTick({ currentMark: null }));
  assert.equal(d.startsNewBatch, true);
  assert.equal(d.serverBatchStart, T0);
});

test("giai đoạn 2-4 không bao giờ tạo mẻ mới", () => {
  for (const stage of [2, 3, 4]) {
    const d = decideRotation(steadyTick({
      stageNum: stage,
      running: false,          // dấu hiệu mạnh nhất
      previousStage: 4,
      currentMark: null,
      elapsedMs: 0,
      prevElapsed: 90 * 60000,
    }));
    assert.equal(d.startsNewBatch, false, `giai đoạn ${stage} không được tạo mẻ mới`);
  }
});

test("payload cũ dạng mảng (elapsedMs null) không suy được mốc server", () => {
  const d = decideRotation(steadyTick({ elapsedMs: null, prevElapsed: null }));
  assert.equal(d.serverBatchStart, null);
  // Mốc đang giữ vẫn khớp và máy đang chạy → không tạo mẻ mới
  assert.equal(d.startsNewBatch, false);
});

test("serverBatchStart suy đúng = thời điểm mẫu trừ đồng hồ giai đoạn", () => {
  const d = decideRotation(steadyTick({ elapsedMs: 7 * 60000, sensorTsMs: T0 + 7 * 60000 }));
  assert.equal(d.serverBatchStart, T0);
});

// ---- Ca nhiều máy: quyết định phải độc lập từng máy ---------------------------

test("mỗi máy quyết định độc lập — một máy sang mẻ mới không ảnh hưởng máy khác", () => {
  // Máy 3 sang mẻ mới, 7 máy còn lại đang giữa mẻ
  const decisions = [];
  for (let n = 1; n <= 8; n++) {
    const tick = n === 3
      ? steadyTick({ previousStage: 4, elapsedMs: 500, prevElapsed: 88 * 60000 })
      : steadyTick();
    decisions.push(decideRotation(tick).startsNewBatch);
  }
  assert.deepEqual(decisions, [false, false, true, false, false, false, false, false]);
});

test("chuỗi tick một mẻ đầy đủ chỉ tạo mẻ mới đúng một lần", () => {
  // giai đoạn 1 -> 2 -> 3 -> 4 rồi vòng lại giai đoạn 1 của mẻ sau
  let currentMark = T0;
  let previousStage = null;
  let prevElapsed = null;
  let running = true;
  let count = 0;

  const ticks = [
    { stageNum: 1, elapsed: 1 }, { stageNum: 1, elapsed: 10 },
    { stageNum: 2, elapsed: 5 }, { stageNum: 3, elapsed: 5 },
    { stageNum: 4, elapsed: 5 },
    { stageNum: 1, elapsed: 1, newBatch: true },  // mẻ sau
    { stageNum: 1, elapsed: 6 },
  ];

  let batchStart = T0;
  for (const t of ticks) {
    if (t.newBatch) batchStart = T0 + 100 * 60000;
    const sensorTsMs = batchStart + t.elapsed * 60000;
    const d = decideRotation({
      stageNum: t.stageNum,
      elapsedMs: t.elapsed * 60000,
      sensorTsMs,
      currentMark,
      running,
      previousStage,
      prevElapsed,
    });
    if (d.startsNewBatch) {
      count++;
      currentMark = d.serverBatchStart ?? sensorTsMs;
    }
    previousStage = t.stageNum;
    prevElapsed = t.elapsed * 60000;
  }
  assert.equal(count, 1, `phải tạo mẻ mới đúng 1 lần, thực tế ${count}`);
});
