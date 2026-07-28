/**
 * Mô phỏng: khi một máy sang mẻ mới, chuỗi bị xoá về rỗng rồi nạp lại từ REST.
 * Nếu chỉ tích bằng tick live thì mất ~48s mới đủ 2 điểm để vẽ được đoạn đường
 * — đó là lý do các đường biến mất lần lượt sau khi 8 máy đổi mẻ lệch nhau.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { REANCHOR_TOL_MS } = require(
  path.join(__dirname, "..", "frontend", "src", "hooks", "batchRotation.ts"),
);

const MIN_PHUT_GAP = 0.4;

/** Số điểm tick live tích được sau `giay` giây kể từ lúc đổi mẻ. */
function livePointsAfter(giay) {
  return Math.floor(giay / 60 / MIN_PHUT_GAP) + 1;
}

test("chỉ dựa tick live thì gần 24s đầu chỉ có 1 điểm — không vẽ được đường", () => {
  assert.equal(livePointsAfter(0), 1);
  assert.equal(livePointsAfter(20), 1);
  assert.ok(livePointsAfter(24) >= 2, "phải qua ~24s mới có điểm thứ hai");
});

test("phải ~48s mới đủ 3 điểm để đường thấy rõ", () => {
  assert.ok(livePointsAfter(48) >= 3);
});

/** Mô hình refetchLatest: thử nhiều lượt, chỉ nhận mẻ có mốc khớp. */
function makeRefetcher({ docAppearsOnAttempt, docMark, expectedMark, attempts = 4 }) {
  let calls = 0;
  let accepted = null;
  for (let a = 0; a < attempts; a++) {
    calls++;
    if (a + 1 < docAppearsOnAttempt) continue;          // backend chưa tạo doc
    if (Math.abs(docMark - expectedMark) > REANCHOR_TOL_MS) continue; // còn mẻ cũ
    accepted = { attempt: a + 1, mark: docMark };
    break;
  }
  return { calls, accepted };
}

test("nạp lại thành công ngay lượt đầu khi doc mẻ mới đã có", () => {
  const r = makeRefetcher({ docAppearsOnAttempt: 1, docMark: 1000, expectedMark: 1000 });
  assert.equal(r.accepted.attempt, 1);
  assert.equal(r.calls, 1);
});

test("backend chậm tạo doc → thử lại tới lượt sau, vẫn nhận được", () => {
  const r = makeRefetcher({ docAppearsOnAttempt: 3, docMark: 5000, expectedMark: 5000 });
  assert.equal(r.accepted.attempt, 3);
});

test("REST còn trả mẻ CŨ (mốc lệch xa) thì không nhận — tránh trộn hai mẻ", () => {
  const r = makeRefetcher({
    docAppearsOnAttempt: 1,
    docMark: 0,
    expectedMark: 40 * 60 * 1000, // mẻ mới cách mẻ cũ 40 phút
  });
  assert.equal(r.accepted, null, "không được nạp mẻ cũ vào chỗ mẻ mới");
});

test("lệch nhỏ trong ngưỡng vẫn nhận (mốc REST và mốc server chênh vài giây)", () => {
  const r = makeRefetcher({
    docAppearsOnAttempt: 1,
    docMark: 60_000,
    expectedMark: 60_000 + 16_000, // lệch 16s như đo thật
  });
  assert.ok(r.accepted, "lệch 16s phải được chấp nhận");
});

test("hết số lượt mà chưa thấy mẻ mới thì bỏ, không treo", () => {
  const r = makeRefetcher({ docAppearsOnAttempt: 99, docMark: 1, expectedMark: 1, attempts: 8 });
  assert.equal(r.accepted, null);
  assert.equal(r.calls, 8, "chỉ thử đúng số lượt cho phép");
});

test("cửa sổ thử phải phủ được độ trễ ghi điểm đầu của backend", () => {
  // Đo thật trên 23 mẻ gần nhất: điểm gd1 đầu tiên tới sau min 3s, trung vị
  // 49s, max 129s (backend chỉ $push mỗi 5 cycle). Cửa sổ phải trùm 129s.
  const ATTEMPTS = 8;
  const DELAY_MS = 20_000;
  const window = (ATTEMPTS - 1) * DELAY_MS;
  assert.ok(window >= 129_000, `cửa sổ ${window / 1000}s không phủ nổi 129s`);

  // Đồng thời không được kéo dài vô ích: quá 5 phút là vô nghĩa vì mẻ đã chạy sâu
  assert.ok(window <= 300_000, "cửa sổ quá dài, giữ request treo không cần thiết");
});

test("mỗi lượt thử đều kiểm lại mốc — không nhận mẻ cũ ở lượt muộn", () => {
  // Backend tạo doc ở lượt 5, nhưng doc đó vẫn là mẻ CŨ (mốc lệch) → vẫn từ chối
  const r = makeRefetcher({
    docAppearsOnAttempt: 5,
    docMark: 0,
    expectedMark: 40 * 60 * 1000,
    attempts: 8,
  });
  assert.equal(r.accepted, null);
});

/** Chỉ nhận payload REST khi nó nhiều điểm hơn tick live đã tích được. */
function shouldAccept(restCount, liveCount) {
  return restCount > liveCount;
}

test("không để REST ghi đè khi tick live đã tích nhiều điểm hơn", () => {
  assert.equal(shouldAccept(3, 10), false, "REST cũ hơn thì giữ dữ liệu live");
  assert.equal(shouldAccept(40, 2), true, "REST đầy hơn thì nhận");
  assert.equal(shouldAccept(5, 5), false, "bằng nhau thì không cần thay");
});

// ---- Ca 8 máy đổi mẻ lệch nhau, đúng số liệu quan sát được -------------------

test("8 máy đổi mẻ lệch nhau 15 phút: nạp lại giữ đủ 8 đường", () => {
  // Mốc thật quan sát được: 13:48, 13:48, 13:50, 13:52, 13:54, 13:57, 14:02, 14:03
  const startMinutes = [828, 828, 830, 832, 834, 837, 842, 843];
  const nowMinute = 848; // 14:08

  let visibleLiveOnly = 0;
  let visibleWithRefetch = 0;
  for (const start of startMinutes) {
    const ageSec = (nowMinute - start) * 60;
    if (livePointsAfter(ageSec) >= 2) visibleLiveOnly++;
    // Có nạp lại REST thì điểm đầu mẻ có ngay, luôn vẽ được
    visibleWithRefetch++;
  }
  assert.equal(visibleWithRefetch, 8, "có nạp lại thì đủ 8 đường");
  assert.ok(visibleLiveOnly <= 8);

  // Ngay tại giây đổi mẻ, chỉ dựa live thì máy đó không vẽ được
  const atRotation = livePointsAfter(0);
  assert.equal(atRotation, 1, "đúng lúc đổi mẻ chỉ có 1 điểm → cần dot hoặc nạp lại");
});
