/**
 * Kiểm chứng mô hình mẻ theo THẾ HỆ của biểu đồ dàn (useFleetHistory):
 * "Mẻ mới nhất" chỉ chứa các máy đã qua thế hệ mới; máy còn ở thế hệ cũ (dù
 * đang chạy) tụt xuống "Mẻ trước". Logic nằm trong hook (phụ thuộc React refs),
 * nên re-model đúng cấu trúc genRef/fleetGen + pushState + rotation, KHÔNG import.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const FRYER_CHART_COLORS = {
  1: '#2196f3', 2: '#e53935', 3: '#43a047', 4: '#fb8c00',
  5: '#8e24aa', 6: '#00acc1', 7: '#f06292', 8: '#6d4c41',
};
const GEN_WINDOW_MS = 30 * 60 * 1000;

/** Re-model tối giản của refs + pushState + rotation trong useFleetHistory. */
function makeFleet(tracked) {
  const gen = {};
  const latestStart = {};
  const latestTemp = {};
  const prevTemp = {};
  let fleetGen = 0;
  for (const n of tracked) gen[n] = 0;

  /** pushState định tuyến theo thế hệ. Trả về { latest, previous } số máy. */
  const pushState = () => {
    const latest = [];
    const previous = [];
    for (const n of tracked) {
      const caughtUp = (gen[n] ?? 0) >= fleetGen;
      const lt = latestTemp[n];
      const pt = prevTemp[n];
      if (caughtUp) {
        if (lt && lt.length > 0) latest.push(n);
        if (pt && pt.length > 0) previous.push(n);
      } else {
        if (lt && lt.length > 0) previous.push(n);
      }
    }
    return { latest, previous };
  };

  /** Máy n sang mẻ mới (đã có mẻ cũ để đẩy xuống → nâng thế hệ). */
  const rotate = (n, newStartMs) => {
    const hasCurrent = (latestTemp[n]?.length ?? 0) > 0;
    if (hasCurrent) {
      prevTemp[n] = latestTemp[n];
      gen[n] = (gen[n] ?? 0) + 1;
      fleetGen = Math.max(fleetGen, gen[n]);
    }
    latestStart[n] = newStartMs;
    latestTemp[n] = [{ phut: 0, value: 80, stage: 1 }]; // mẻ mới vừa có điểm đầu
  };

  /** Gán thế hệ ban đầu theo cụm mốc bắt đầu (mô phỏng loadAll). */
  const assignLoadGenerations = () => {
    let maxStart = -Infinity;
    for (const n of tracked) {
      const s = latestStart[n];
      if (s != null && s > maxStart) maxStart = s;
    }
    if (!Number.isFinite(maxStart)) return;
    let hasBehind = false;
    for (const n of tracked) {
      const s = latestStart[n];
      if (s != null && s < maxStart - GEN_WINDOW_MS) hasBehind = true;
    }
    if (hasBehind) {
      fleetGen = Math.max(fleetGen, 1);
      for (const n of tracked) {
        const s = latestStart[n];
        const clusterGen = s != null && s >= maxStart - GEN_WINDOW_MS ? 1 : 0;
        gen[n] = Math.max(gen[n] ?? 0, clusterGen);
      }
    }
  };

  const loadBatch = (n, startMs) => {
    latestStart[n] = startMs;
    latestTemp[n] = [{ phut: 0, value: 80, stage: 1 }];
  };

  return { pushState, rotate, assignLoadGenerations, loadBatch, _gen: gen, get fleetGen() { return fleetGen; } };
}

const ALL8 = [1, 2, 3, 4, 5, 6, 7, 8];
const T0 = 1_700_000_000_000;

// ─── 1. Chưa có xoay mẻ trong phiên: mẻ đang chạy đều ở "Mẻ mới nhất" ─────────

test("dàn đồng bộ: cả 8 máy ở Mẻ mới nhất, không có ở Mẻ trước", () => {
  const f = makeFleet(ALL8);
  for (const n of ALL8) f.loadBatch(n, T0 + n * 60_000); // cách nhau vài phút
  f.assignLoadGenerations();
  const { latest, previous } = f.pushState();
  assert.deepEqual(latest, ALL8, "cả 8 máy ở Mẻ mới nhất");
  assert.equal(previous.length, 0, "không máy nào ở Mẻ trước");
  assert.equal(f.fleetGen, 0, "chưa nâng thế hệ vì cùng cụm");
});

// ─── 2. Mở trang giữa lúc so le đổi mẻ: gom theo cụm mốc bắt đầu ───────────────

test("mở trang khi 3/8 máy đã qua mẻ mới: chỉ nhóm mới ở Mẻ mới nhất", () => {
  const f = makeFleet(ALL8);
  // Máy 1,2,3 đã sang mẻ mới (mốc gần đây); 4-8 còn mẻ cũ (mốc ~80 phút trước).
  const recent = [1, 2, 3];
  const behind = [4, 5, 6, 7, 8];
  for (const n of recent) f.loadBatch(n, T0);
  for (const n of behind) f.loadBatch(n, T0 - 80 * 60_000);
  f.assignLoadGenerations();
  const { latest, previous } = f.pushState();
  assert.deepEqual(latest, recent, "Mẻ mới nhất chỉ gồm máy đã qua mẻ mới");
  assert.deepEqual(previous, behind, "máy còn mẻ cũ nằm ở Mẻ trước");
});

// ─── 3. Xoay mẻ trong phiên: một máy sang mẻ mới đẩy các máy khác xuống ────────

test("một máy xoay mẻ trong phiên → các máy chưa xoay tụt xuống Mẻ trước", () => {
  const f = makeFleet(ALL8);
  for (const n of ALL8) f.loadBatch(n, T0 + n * 60_000);
  f.assignLoadGenerations();

  // Máy 3 sang mẻ mới.
  f.rotate(3, T0 + 90 * 60_000);
  const { latest, previous } = f.pushState();
  assert.deepEqual(latest, [3], "chỉ máy 3 ở Mẻ mới nhất");
  // Mẻ trước = cả thế hệ cũ: 7 máy đang chạy mẻ cũ + mẻ cũ đã hoàn thành của máy 3.
  assert.deepEqual(previous.sort((a, b) => a - b), ALL8, "cả thế hệ cũ nằm ở Mẻ trước");
  assert.equal(f.fleetGen, 1);
});

test("các máy lần lượt bắt kịp: chuyển dần từ Mẻ trước lên Mẻ mới nhất", () => {
  const f = makeFleet(ALL8);
  for (const n of ALL8) f.loadBatch(n, T0 + n * 60_000);
  f.assignLoadGenerations();

  f.rotate(3, T0 + 90 * 60_000);
  f.rotate(1, T0 + 91 * 60_000);
  f.rotate(2, T0 + 92 * 60_000);
  const { latest, previous } = f.pushState();
  assert.deepEqual(latest.sort((a, b) => a - b), [1, 2, 3], "3 máy đã xoay ở Mẻ mới nhất");
  // Mẻ trước = 5 máy chưa xoay (đang chạy mẻ cũ) + mẻ cũ đã hoàn thành của 1,2,3.
  assert.deepEqual(previous.sort((a, b) => a - b), ALL8, "cả thế hệ cũ ở Mẻ trước");
});

test("cả 8 máy đã xoay: tất cả về Mẻ mới nhất, Mẻ trước giữ mẻ cũ", () => {
  const f = makeFleet(ALL8);
  for (const n of ALL8) f.loadBatch(n, T0 + n * 60_000);
  f.assignLoadGenerations();
  for (const n of ALL8) f.rotate(n, T0 + (90 + n) * 60_000);
  const { latest, previous } = f.pushState();
  assert.deepEqual(latest.sort((a, b) => a - b), ALL8, "cả 8 máy ở Mẻ mới nhất");
  assert.deepEqual(previous.sort((a, b) => a - b), ALL8, "mẻ cũ của cả 8 giữ ở Mẻ trước");
  assert.equal(f.fleetGen, 1);
});

// ─── 4. Mốc đầu tiên không nâng thế hệ (không kéo tụt cả dàn) ──────────────────

test("máy vừa khởi động (chưa có mẻ cũ) KHÔNG nâng thế hệ cả dàn", () => {
  const f = makeFleet(ALL8);
  for (const n of ALL8) f.loadBatch(n, T0 + n * 60_000);
  f.assignLoadGenerations();

  // Máy 7 chưa từng có điểm (mô phỏng REST rỗng) rồi nhận tick đầu = mốc đầu.
  f._gen[7] = 0;
  // rotate khi chưa có latestTemp → hasCurrent false → không nâng gen
  const before = f.fleetGen;
  // xóa dữ liệu máy 7 để mô phỏng "chưa có mẻ"
  const f2 = makeFleet([7]);
  f2.rotate(7, T0); // mốc đầu tiên, chưa có latestTemp
  assert.equal(f2.fleetGen, 0, "mốc đầu tiên không nâng thế hệ");
  assert.equal(before, 0);
});
