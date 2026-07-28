/**
 * Kiểm chứng logic lọc máy + stable key + scoped pushState + stale-load guard
 * khi useFleetHistory chạy ở chế độ single-machine (trang chi tiết) thay vì all-8.
 *
 * Test 1 + 2: import HÀM THẬT từ machineList.ts (file thuần, không cần React/socket)
 * để đảm bảo test luôn đồng bộ với production — nếu ai sửa sanitizer mà gây loop
 * thì test phải đỏ.
 *
 * Test 3, 4, 5: mô phỏng ref/effect machinery (pushState scoped, stale-load guard,
 * reset on switch). Logic này nằm bên trong hook — phụ thuộc React refs và effect
 * lifecycle — nên không thể tách ra file thuần như sanitizer. Giống pattern của
 * fleet_history_guard.test.js.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// ─── Import hàm thật (machineList.ts thuần, require() được bằng Node) ─────────
const { sanitizeMachineList, machineListKey } = require(
  path.join(__dirname, "..", "frontend", "src", "hooks", "machineList.ts"),
);

// ─── 1. Machine-list sanitizer ─────────────────────────────────────────────────

test("undefined → all 8 machines", () => {
  const result = sanitizeMachineList(undefined);
  assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("empty array → all 8 machines", () => {
  assert.deepEqual(sanitizeMachineList([]), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("[3] → [3]", () => {
  assert.deepEqual(sanitizeMachineList([3]), [3]);
});

test("duplicates collapse: [5, 5, 5] → [5]", () => {
  assert.deepEqual(sanitizeMachineList([5, 5, 5]), [5]);
});

test("out-of-range values dropped: 0, 9, 3.5 removed", () => {
  assert.deepEqual(sanitizeMachineList([0, 9, 3.5, 4]), [4]);
});

test("unsorted input comes back sorted: [7, 2, 5] → [2, 5, 7]", () => {
  assert.deepEqual(sanitizeMachineList([7, 2, 5]), [2, 5, 7]);
});

test("all invalid values → falls back to all 8", () => {
  assert.deepEqual(sanitizeMachineList([0, -1, 9, 10, 1.5]), [1, 2, 3, 4, 5, 6, 7, 8]);
});

// ─── 2. Stable key: same logical list from different array instances → equal key ─

test("two different array instances with same values produce the same key", () => {
  const a = [3, 5];
  const b = [3, 5];
  assert.notStrictEqual(a, b, "phải là hai instance khác nhau");
  const keyA = machineListKey(sanitizeMachineList(a));
  const keyB = machineListKey(sanitizeMachineList(b));
  assert.equal(keyA, keyB, "key phải bằng nhau → effect không re-run");
});

test("unsorted vs sorted arrays with same values produce the same key", () => {
  const keyA = machineListKey(sanitizeMachineList([7, 2, 5]));
  const keyB = machineListKey(sanitizeMachineList([2, 5, 7]));
  assert.equal(keyA, keyB);
});

test("single machine key is just the number string", () => {
  assert.equal(machineListKey(sanitizeMachineList([5])), "5");
});

test("all 8 machines key", () => {
  assert.equal(machineListKey(sanitizeMachineList(undefined)), "1,2,3,4,5,6,7,8");
});

// ─── 3. pushState scoped to tracked list ────────────────────────────────────────
// Test 3, 4, 5 mô phỏng ref/effect machinery — logic nằm TRONG hook (phụ thuộc
// React refs + effect lifecycle), nên không thể tách ra file thuần. Giữ dạng
// re-model giống fleet_history_guard.test.js, KHÔNG import.

const FRYER_CHART_COLORS = {
  1: '#2196f3',
  2: '#e53935',
  3: '#43a047',
  4: '#fb8c00',
  5: '#8e24aa',
  6: '#00acc1',
  7: '#f06292',
  8: '#6d4c41',
};

// Mô phỏng pushState: chỉ emit series cho máy trong tracked, không lọt dữ liệu
// của máy ngoài danh sách — ngăn bug "hai đường trên Hệ 5".

/** Mô phỏng pushState thuần (không cần React). */
function simulatePushState(tracked, latestTempPts) {
  const series = [];
  for (const n of tracked) {
    const pts = latestTempPts[n];
    if (pts && pts.length > 0) {
      series.push({ n, color: FRYER_CHART_COLORS[n], points: [...pts] });
    }
  }
  return series;
}

test("pushState with tracked=[5] ignores leftover points from machine 3", () => {
  const latestTempPts = {
    3: [{ phut: 0, value: 90, stage: 1 }],  // dữ liệu cũ từ lần xem trước
    5: [{ phut: 0, value: 85, stage: 1 }],
  };
  const series = simulatePushState([5], latestTempPts);
  assert.equal(series.length, 1, "chỉ 1 đường cho máy 5");
  assert.equal(series[0].n, 5);
  assert.equal(series[0].color, FRYER_CHART_COLORS[5]);
});

test("pushState with tracked=[1,2,...,8] emits all machines that have data", () => {
  const latestTempPts = {};
  for (let n = 1; n <= 8; n++) latestTempPts[n] = [{ phut: n, value: 80 + n, stage: 1 }];
  const series = simulatePushState([1, 2, 3, 4, 5, 6, 7, 8], latestTempPts);
  assert.equal(series.length, 8);
});

test("pushState with tracked=[5] returns empty when machine 5 has no data", () => {
  const latestTempPts = { 3: [{ phut: 0, value: 90, stage: 1 }] };
  const series = simulatePushState([5], latestTempPts);
  assert.equal(series.length, 0);
});

// ─── 4. loadAll stale-load guard keyed by machine number ─────────────────────────
// Guard phải so revision của ĐÚNG máy đó, không phải theo index positional.
// Nếu tracked=[5] thì staleLoad phải kiểm tra revision[5], không phải revision[1].

test("stale-load guard keyed by machine number: rotation of machine 5 marks machine 5 stale", () => {
  // Setup: tracked=[5], revision ban đầu = 0
  const tracked = [5];
  const revision = { 5: 0 };
  const revisionsAtLoad = { 5: revision[5] };

  // Giữa lúc REST load bay, máy 5 sang mẻ mới → revision tăng
  revision[5] = 1;

  // Kiểm tra stale-load guard: phải so revision[5] với revisionsAtLoad[5]
  const staleLoad = (revision[5] ?? 0) !== revisionsAtLoad[5];
  assert.equal(staleLoad, true, "máy 5 phải bị đánh dấu stale");
});

test("stale-load guard: non-rotated machine is NOT stale", () => {
  const tracked = [3, 5];
  const revision = { 3: 0, 5: 0 };
  const revisionsAtLoad = { 3: 0, 5: 0 };

  // Chỉ máy 5 sang mẻ mới
  revision[5] = 1;

  const staleMachine3 = (revision[3] ?? 0) !== revisionsAtLoad[3];
  const staleMachine5 = (revision[5] ?? 0) !== revisionsAtLoad[5];
  assert.equal(staleMachine3, false, "máy 3 không xoay mẻ → không stale");
  assert.equal(staleMachine5, true, "máy 5 xoay mẻ → stale");
});

test("positional index bug: old code with tracked=[5] would compare revision[1] not revision[5]", () => {
  // Đây chính xác là bug mà cách cũ (positional array) gây ra:
  // revisionsAtLoad[i] với i=0 → đọc slot 0, tức revision[1] (hoặc undefined),
  // KHÔNG PHẢI revision[5]. Cách mới dùng Record<number, number> nên đọc đúng.
  const revision = { 1: 0, 5: 0 };

  // Cách cũ: revisionsAtLoad = Array.from({length:8}, (_, i) => revision[i+1] ?? 0)
  // Khi tracked=[5], results chỉ có 1 phần tử, i=0 → revisionsAtLoad[0] = revision[1]
  const revisionsAtLoadOld = Array.from({ length: 8 }, (_, i) => revision[i + 1] ?? 0);
  // results[0] là kết quả cho máy 5 nhưng guard so revisionsAtLoad[0] = revision[1] = 0
  // Máy 5 revision = 1 → staleLoad = true. ĐÚNG tình cờ ở đây.
  // Nhưng nếu máy 1 có revision=1 mà máy 5 revision=0, guard sẽ SAI:
  revision[1] = 1;
  revision[5] = 0;
  const revisionsAtLoadBuggy = Array.from({ length: 8 }, (_, i) => revision[i + 1] ?? 0);
  // tracked=[5], i=0, n thực sự là 5, nhưng guard so revisionsAtLoad[0] = revision[1] = 1
  // revision[5] = 0 !== 1 → staleLoad = true → SAI! Máy 5 không xoay mẻ mà bị đánh stale.
  const buggyStale = (revision[5] ?? 0) !== revisionsAtLoadBuggy[0];
  assert.equal(buggyStale, true, "cách cũ (positional) đánh sai máy 5 là stale vì so nhầm slot");

  // Cách mới: Record keyed by machine number
  const revisionsAtLoadNew = { 5: 0 }; // ghi đúng revision[5]=0 tại lúc load
  const correctStale = (revision[5] ?? 0) !== revisionsAtLoadNew[5];
  assert.equal(correctStale, false, "cách mới so đúng revision[5] → không stale");
});

// ─── 5. Reset on machine switch ─────────────────────────────────────────────────
// Sau khi đổi tracked 3 → 5, dữ liệu máy 3 phải biến khỏi emitted state.

test("reset on switch: machine 3 data gone from emitted state after switching to 5", () => {
  // Ban đầu xem máy 3, refs có dữ liệu
  const latestTempPts = {
    3: [{ phut: 0, value: 88, stage: 1 }],
  };

  // Đổi sang máy 5: effect reset refs cho tracked machines rồi pushState
  // Mô phỏng: xoá slot 5 (đang theo dõi), nhưng slot 3 vẫn nằm trong refs
  // vì nó KHÔNG thuộc tracked mới. pushState chỉ emit tracked → 3 biến mất.
  const trackedNew = [5];
  // Reset chỉ xoá tracked machines:
  for (const n of trackedNew) {
    delete latestTempPts[n];
  }
  // pushState chỉ nhìn tracked:
  const series = simulatePushState(trackedNew, latestTempPts);
  assert.equal(series.length, 0, "máy 3 không xuất hiện trong series sau khi đổi sang máy 5");
});

test("reset does not affect other machines' data in refs (for Overview re-mount)", () => {
  // Overview dùng all 8, reset xoá tất cả 8 rồi load lại — OK
  const latestTempPts = {};
  for (let n = 1; n <= 8; n++) latestTempPts[n] = [{ phut: 0, value: 90, stage: 1 }];
  const tracked = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const n of tracked) delete latestTempPts[n];
  const series = simulatePushState(tracked, latestTempPts);
  assert.equal(series.length, 0, "sau reset, không có series nào cho đến khi loadAll hoàn thành");
});

