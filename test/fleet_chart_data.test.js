/**
 * Test bộ dựng dữ liệu biểu đồ đội máy. Node chạy TS trực tiếp qua
 * --experimental-strip-types (đã bật trong npm script test).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MOD = path.join(__dirname, "..", "client", "src", "components", "fleetChartData.ts");
const { buildGrid, valueAt, buildMerged, MAX_GRID_ROWS } = require(MOD);

/** Series đơn giản: điểm mỗi `step` phút từ `from` đến `to`. */
function mkSeries(n, from, to, step = 1, value = 90) {
  const points = [];
  for (let t = from; t <= to + 1e-9; t += step) {
    points.push({ phut: Math.round(t * 100) / 100, value, stage: 1 });
  }
  return { n, color: "#000", points };
}

test("grid là hợp các mốc thật, không phải bước đều", () => {
  const a = { n: 1, color: "#a", points: [{ phut: 0, value: 1, stage: 1 }, { phut: 5, value: 2, stage: 1 }] };
  const b = { n: 2, color: "#b", points: [{ phut: 2, value: 3, stage: 1 }, { phut: 7, value: 4, stage: 1 }] };
  assert.deepEqual(buildGrid([a, b]), [0, 2, 5, 7]);
});

test("mốc trùng giữa các hệ chỉ xuất hiện một lần", () => {
  const a = { n: 1, color: "#a", points: [{ phut: 0, value: 1, stage: 1 }, { phut: 3, value: 2, stage: 1 }] };
  const b = { n: 2, color: "#b", points: [{ phut: 0, value: 5, stage: 1 }, { phut: 3, value: 6, stage: 1 }] };
  assert.deepEqual(buildGrid([a, b]), [0, 3]);
});

test("grid bị giới hạn số row nhưng giữ mốc đầu và cuối", () => {
  const big = mkSeries(1, 0, 2000, 1);
  const g = buildGrid([big]);
  assert.ok(g.length <= MAX_GRID_ROWS, `${g.length} row vượt trần`);
  assert.equal(g[0], 0);
  assert.equal(g[g.length - 1], 2000);
});

test("valueAt nội suy tuyến tính đúng giữa hai điểm", () => {
  const pts = [{ phut: 0, value: 10, stage: 1 }, { phut: 10, value: 20, stage: 1 }];
  assert.equal(valueAt(pts, 5).value, 15);
  assert.equal(valueAt(pts, 0).value, 10);
  assert.equal(valueAt(pts, 10).value, 20);
});

test("valueAt trả null ngoài khoảng dữ liệu của hệ", () => {
  const pts = [{ phut: 5, value: 10, stage: 1 }, { phut: 10, value: 20, stage: 1 }];
  assert.equal(valueAt(pts, 4.9), null, "trước khi hệ vào mẻ");
  assert.equal(valueAt(pts, 10.1), null, "sau khi mẻ kết thúc");
  assert.equal(valueAt([], 1), null);
});

test("valueAt dùng nhị phân vẫn đúng trên chuỗi dài", () => {
  const pts = [];
  for (let i = 0; i <= 500; i++) pts.push({ phut: i, value: i * 2, stage: 1 });
  for (const t of [0, 1, 123.5, 250, 499.25, 500]) {
    assert.equal(valueAt(pts, t).value, t * 2, `t=${t}`);
  }
});

// ---- Ca chính: 8 hệ vào mẻ lệch giờ nhau -------------------------------------

test("8 hệ vào mẻ lệch nhau: mỗi hệ có giá trị trong suốt khoảng nó chạy", () => {
  // Mô phỏng đúng tình huống thật: hệ 3/5/6 vào lúc 12:02, còn lại 12:08
  // → 5 hệ bắt đầu ở phut 0 nhưng chạy ngắn hơn 6 phút.
  const series = [
    mkSeries(1, 0, 40), mkSeries(2, 0, 40), mkSeries(3, 0, 46),
    mkSeries(4, 0, 40), mkSeries(5, 0, 46), mkSeries(6, 0, 46),
    mkSeries(7, 0, 40), mkSeries(8, 0, 40),
  ];
  const { rows } = buildMerged(series);

  // Tại phut 8.5 mọi hệ đều đang chạy → cả 8 phải có giá trị
  const near = rows.reduce((best, r) =>
    Math.abs(r.phut - 8.5) < Math.abs(best.phut - 8.5) ? r : best);
  for (let n = 1; n <= 8; n++) {
    assert.notEqual(rows.find((r) => r.phut === near.phut)[`m${n}`], null,
      `hệ ${n} phải có giá trị ở phut ${near.phut}`);
  }

  // Tại phut 44 chỉ 3 hệ còn chạy → 5 hệ kia null, đó là ĐÚNG
  const late = rows.find((r) => r.phut === 44);
  assert.ok(late, "phải có row ở phut 44");
  for (const n of [3, 5, 6]) assert.notEqual(late[`m${n}`], null, `hệ ${n} còn chạy`);
  for (const n of [1, 2, 4, 7, 8]) assert.equal(late[`m${n}`], null, `hệ ${n} đã xong`);
});

test("hệ vào mẻ muộn vẫn xuất hiện đủ từ lúc nó bắt đầu", () => {
  // hệ 1 chạy 0..40, hệ 2 vào muộn ở phut 12
  const series = [mkSeries(1, 0, 40), mkSeries(2, 12, 40)];
  const { rows } = buildMerged(series);
  const before = rows.filter((r) => r.phut < 12);
  const after = rows.filter((r) => r.phut >= 12);
  assert.ok(before.every((r) => r.m2 === null), "trước phut 12 hệ 2 chưa có dữ liệu");
  assert.ok(after.every((r) => r.m2 !== null), "từ phut 12 hệ 2 phải liên tục có giá trị");
  assert.ok(rows.every((r) => r.m1 !== null), "hệ 1 liên tục suốt mẻ");
});

test("một mẻ dài bất thường không xoá dữ liệu các hệ khác", () => {
  // Đúng ca mẻ zombie 2127 phút kéo giãn trục X
  const series = [mkSeries(1, 0, 2127, 5), mkSeries(2, 0, 40), mkSeries(3, 0, 40)];
  const { rows, xMax } = buildMerged(series);
  assert.ok(xMax > 2000, "trục X vẫn phải phủ mẻ dài");
  // Hệ 2, 3 phải còn giá trị ở vùng 0..40 chứ không bị grid thô làm mất
  const inRange = rows.filter((r) => r.phut <= 40);
  const has2 = inRange.filter((r) => r.m2 !== null && r.m2 !== undefined).length;
  assert.ok(has2 >= 8, `hệ 2 chỉ còn ${has2} điểm trong vùng nó chạy`);
});

test("mỗi row mang stage của hệ tại mốc đó", () => {
  const s = { n: 1, color: "#a", points: [
    { phut: 0, value: 90, stage: 1 },
    { phut: 10, value: 95, stage: 2 },
  ] };
  const { rows } = buildMerged([s]);
  assert.equal(rows[0].m1_stage, 1);
});

test("series rỗng không sinh cột, không làm sập bộ dựng", () => {
  const { rows, machines } = buildMerged([
    { n: 1, color: "#a", points: [] },
    mkSeries(2, 0, 5),
  ]);
  assert.equal(machines.length, 2, "legend vẫn liệt kê cả hai");
  assert.ok(rows.every((r) => !("m1" in r)), "hệ không có điểm thì không có cột");
  assert.ok(rows.every((r) => r.m2 !== null));
});

test("không series nào có điểm → không có row", () => {
  const { rows, xMax } = buildMerged([{ n: 1, color: "#a", points: [] }]);
  assert.deepEqual(rows, []);
  assert.equal(xMax, 0);
});

test("vMin/vMax bao trùm mọi hệ để thang Y không cắt mất đường", () => {
  const a = mkSeries(1, 0, 5, 1, 50);
  const b = mkSeries(2, 0, 5, 1, 120);
  const { vMin, vMax } = buildMerged([a, b]);
  assert.equal(vMin, 50);
  assert.equal(vMax, 120);
});

// ---- Setpoint series (nhóm thứ hai) ------------------------------------------

const { findExactOrLastBefore } = require(MOD);

test("setpoint cột s${n} không ghi đè measured cột m${n} — cả hai giá trị song song", () => {
  // Một máy (n=1) có cả measured và setpoint tại cùng mốc X.
  // Key "m1" (measured) và "s1" (setpoint) phải cùng tồn tại trên row.
  const measured = { n: 1, color: "#a", points: [
    { phut: 0, value: 35, stage: 1 },
    { phut: 5, value: 40, stage: 1 },
  ] };
  const setpoint = { n: 1, color: "#b", points: [
    { phut: 0, value: 90, stage: 1 },
    { phut: 5, value: 88, stage: 2 },
  ] };
  const { rows } = buildMerged([measured], [setpoint]);
  // Tại phut 0 cả hai phải có giá trị
  const row0 = rows.find((r) => r.phut === 0);
  assert.ok(row0, "phải có row ở phut 0");
  assert.equal(row0.m1, 35, "measured giá trị 35");
  assert.equal(row0.s1, 90, "setpoint giá trị 90");
  // Tại phut 5 cả hai phải có giá trị
  const row5 = rows.find((r) => r.phut === 5);
  assert.ok(row5, "phải có row ở phut 5");
  assert.equal(row5.m1, 40, "measured giá trị 40");
  assert.equal(row5.s1, 88, "setpoint giá trị 88");
});

test("vMin/vMax bao trùm cả setpoint — measured thấp + setpoint cao phải mở rộng range", () => {
  // Measured 25-40, setpoint 90 → range phải chứa 90
  const measured = mkSeries(1, 0, 5, 1, 30);
  const setpoint = { n: 1, color: "#b", points: [
    { phut: 0, value: 90, stage: 1 },
    { phut: 5, value: 90, stage: 1 },
  ] };
  const { vMin, vMax } = buildMerged([measured], [setpoint]);
  assert.ok(vMin <= 30, `vMin phải <= 30, nhận ${vMin}`);
  assert.ok(vMax >= 90, `vMax phải >= 90, nhận ${vMax}`);
});

test("grid là hợp mốc X của cả measured và setpoint — mốc chỉ setpoint vẫn có row", () => {
  // Measured có phut 0 và 10; setpoint có phut 0, 5, 10.
  // Grid phải chứa phut 5 (mốc chỉ có ở setpoint).
  const measured = { n: 1, color: "#a", points: [
    { phut: 0, value: 30, stage: 1 },
    { phut: 10, value: 40, stage: 1 },
  ] };
  const setpoint = { n: 1, color: "#b", points: [
    { phut: 0, value: 90, stage: 1 },
    { phut: 5, value: 88, stage: 2 },
    { phut: 10, value: 88, stage: 2 },
  ] };
  const { rows } = buildMerged([measured], [setpoint]);
  const phuts = rows.map((r) => r.phut);
  assert.ok(phuts.includes(5), "mốc phut=5 (chỉ setpoint) phải có trong grid");
  // Measured ở phut 5 phải được nội suy (nằm trong khoảng 0-10)
  const row5 = rows.find((r) => r.phut === 5);
  assert.ok(row5.m1 != null, "measured phải được nội suy tại mốc setpoint");
});

test("không truyền setpointSeries → output giống hệt phiên bản cũ (backward-compat)", () => {
  const a = mkSeries(1, 0, 10, 2, 80);
  const b = mkSeries(2, 0, 10, 2, 90);
  const withSp = buildMerged([a, b], undefined);
  const withoutSp = buildMerged([a, b]);
  // Rows, xMax, vMin, vMax, machines phải giống nhau
  assert.deepEqual(withSp.rows, withoutSp.rows);
  assert.equal(withSp.xMax, withoutSp.xMax);
  assert.equal(withSp.vMin, withoutSp.vMin);
  assert.equal(withSp.vMax, withoutSp.vMax);
  assert.deepEqual(withSp.machines, withoutSp.machines);
  // Không có setpointMachines khi không truyền
  assert.equal(withoutSp.setpointMachines, undefined);
});

test("setpoint kết thúc sớm hơn measured → null ở các mốc sau mốc cuối setpoint", () => {
  // Setpoint chỉ covers phut 0-5 (stage 1-3 xong ở phut 5).
  // Measured tiếp tục đến phut 10 (stage 4).
  const measured = { n: 1, color: "#a", points: [
    { phut: 0, value: 30, stage: 1 },
    { phut: 5, value: 35, stage: 3 },
    { phut: 10, value: 25, stage: 4 },
  ] };
  const setpoint = { n: 1, color: "#b", points: [
    { phut: 0, value: 90, stage: 1 },
    { phut: 5, value: 88, stage: 3 },
  ] };
  const { rows } = buildMerged([measured], [setpoint]);
  const row10 = rows.find((r) => r.phut === 10);
  assert.ok(row10, "phải có row ở phut 10");
  assert.equal(row10.m1, 25, "measured vẫn có giá trị ở phut 10");
  assert.equal(row10.s1, null, "setpoint phải là null ở mốc vượt quá phạm vi setpoint");
});
