const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STALE_CYCLES_BEFORE_DROP,
  isCycleFresh,
  nextStaleState,
} = require("../utils/modbus_health");

test("cycle không lỗi block nào thì tươi", () => {
  assert.equal(isCycleFresh([]), true);
  assert.equal(isCycleFresh(undefined), true);
  assert.equal(isCycleFresh(null), true);
});

test("block cảm biến lỗi → cycle không tươi, không được ghi DB", () => {
  // D2..D5 áp suất, D134/135 nhiệt độ chính, D572.. dòng điện, coil trạng thái
  for (const b of ["h2", "h60", "h81", "h134", "h572", "c15070"]) {
    assert.equal(isCycleFresh([b]), false, `${b} phải làm cycle mất tươi`);
  }
});

test("block config hoặc coil lẻ lỗi thì cycle vẫn ghi được", () => {
  // config: chỉ mất thông số cài đặt, không làm sai điểm dữ liệu
  for (const b of ["h202", "h256", "h316", "h501", "h216", "h667", "c15001", "c15006"]) {
    assert.equal(isCycleFresh([b]), true, `${b} không nên chặn ghi`);
  }
});

test("một block cảm biến lỗi lẫn trong nhiều block lành vẫn chặn ghi", () => {
  assert.equal(isCycleFresh(["h202", "h134", "h667"]), false);
});

test("streak reset về 0 khi cycle đọc thành công", () => {
  assert.deepEqual(nextStaleState(2, false), { streak: 0, shouldDrop: false });
  assert.deepEqual(nextStaleState(0, false), { streak: 0, shouldDrop: false });
});

test("chỉ hạ cờ kết nối sau đủ số cycle lỗi liên tiếp", () => {
  assert.equal(STALE_CYCLES_BEFORE_DROP, 3);
  let s = 0;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const r = nextStaleState(s, true);
    s = r.streak;
    seen.push(r.shouldDrop);
  }
  // 2 cycle đầu chỉ đếm, cycle thứ 3 mới hạ cờ → bỏ qua timeout nhiễu 1 nhịp
  assert.deepEqual(seen, [false, false, true]);
});

test("lỗi rời rạc không bao giờ hạ cờ", () => {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    s = nextStaleState(s, true).streak;      // lỗi
    const ok = nextStaleState(s, false);      // rồi thành công
    assert.equal(ok.shouldDrop, false);
    s = ok.streak;
    assert.equal(s, 0);
  }
});

test("streak đầu vào không hợp lệ được coi là 0", () => {
  assert.deepEqual(nextStaleState(undefined, true), { streak: 1, shouldDrop: false });
  assert.deepEqual(nextStaleState(NaN, true), { streak: 1, shouldDrop: false });
});
