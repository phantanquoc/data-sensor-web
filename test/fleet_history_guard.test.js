/**
 * Mô phỏng guard revision trong useFleetHistory: sự kiện stop của một máy chen
 * vào giữa lúc REST load còn bay thì máy đó có bị mất chuỗi hay không.
 *
 * Không import hook thật (cần React + socket). Dựng lại đúng cấu trúc guard.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

/** Mô hình tối giản của hook, tham số hoá theo hành vi onStop. */
function makeHook({ stopBumpsRevision, staleGoesToPrevious }) {
  const revision = {};
  const latestPts = {};
  const prevPts = {};
  const running = {};
  const initialized = {};

  const onStop = (n) => {
    running[n] = false;
    if (stopBumpsRevision) revision[n] = (revision[n] ?? 0) + 1;
  };

  /** Bắt đầu load: ghi lại revision tại thời điểm phát request. */
  const beginLoad = () => Array.from({ length: 8 }, (_, i) => revision[i + 1] ?? 0);

  /** Kết thúc load: áp payload theo guard. */
  const finishLoad = (revisionsAtLoad, payloads) => {
    for (let n = 1; n <= 8; n++) {
      const stale = (revision[n] ?? 0) !== revisionsAtLoad[n - 1];
      const payload = payloads[n];
      if (payload) {
        if (stale) {
          if (staleGoesToPrevious) {
            if ((prevPts[n]?.length ?? 0) === 0) prevPts[n] = payload.points;
          }
          // cách cũ: bỏ hẳn, không nạp đi đâu
        } else {
          latestPts[n] = payload.points;
          running[n] = payload.running;
        }
      }
      initialized[n] = true;
    }
  };

  const seriesCount = () => {
    let c = 0;
    for (let n = 1; n <= 8; n++) if ((latestPts[n]?.length ?? 0) > 0) c++;
    return c;
  };
  const prevCount = () => {
    let c = 0;
    for (let n = 1; n <= 8; n++) if ((prevPts[n]?.length ?? 0) > 0) c++;
    return c;
  };

  return { onStop, beginLoad, finishLoad, seriesCount, prevCount, latestPts, prevPts };
}

const payloadsForAll = () => {
  const p = {};
  for (let n = 1; n <= 8; n++) p[n] = { points: [{ phut: 0, value: 90, stage: 1 }], running: true };
  return p;
};

test("HÀNH VI CŨ: stop giữa REST load làm mất chuỗi của máy đó", () => {
  const h = makeHook({ stopBumpsRevision: true, staleGoesToPrevious: false });
  const rev = h.beginLoad();
  // 3 máy dừng trong lúc request còn bay — đúng ca ảnh chụp: legend 8, tooltip 5
  h.onStop(1);
  h.onStop(2);
  h.onStop(8);
  h.finishLoad(rev, payloadsForAll());
  assert.equal(h.seriesCount(), 5, "cách cũ mất đúng 3 hệ");
});

test("HÀNH VI MỚI: stop không tăng revision → giữ đủ 8 hệ", () => {
  const h = makeHook({ stopBumpsRevision: false, staleGoesToPrevious: true });
  const rev = h.beginLoad();
  h.onStop(1);
  h.onStop(2);
  h.onStop(8);
  h.finishLoad(rev, payloadsForAll());
  assert.equal(h.seriesCount(), 8, "mẻ vừa dừng vẫn là mẻ cần vẽ");
});

test("stop toàn bộ 8 máy vẫn giữ đủ 8 chuỗi", () => {
  const h = makeHook({ stopBumpsRevision: false, staleGoesToPrevious: true });
  const rev = h.beginLoad();
  for (let n = 1; n <= 8; n++) h.onStop(n);
  h.finishLoad(rev, payloadsForAll());
  assert.equal(h.seriesCount(), 8);
});

test("mẻ MỚI bắt đầu giữa REST load → payload cũ xuống Mẻ trước, không mất", () => {
  const h = makeHook({ stopBumpsRevision: false, staleGoesToPrevious: true });
  const rev = h.beginLoad();

  // Tick live dựng mẻ MỚI cho máy 3 và tăng revision (nhánh startsNewBatch).
  h.latestPts[3] = [{ phut: 0, value: 88, stage: 1 }];
  const revBumped = rev.slice();
  revBumped[2] = rev[2] + 1;

  // Payload REST về sau, mang dữ liệu mẻ CŨ với giá trị nhận biết được.
  const payloads = payloadsForAll();
  payloads[3] = { points: [{ phut: 0, value: 55, stage: 1 }], running: true };
  h.finishLoad(revBumped, payloads);

  // Mẻ mới giữ nguyên trên latest, mẻ cũ nằm ở previous — không cái nào mất.
  assert.equal(h.latestPts[3][0].value, 88, "latest phải là mẻ mới từ tick live");
  assert.equal(h.prevPts[3][0].value, 55, "mẻ cũ phải xuống Mẻ trước");
  assert.equal(h.seriesCount(), 8, "vẫn đủ 8 hệ trên biểu đồ");
});

test("payload REST của mẻ cũ không ghi đè Mẻ trước đã có sẵn", () => {
  const h = makeHook({ stopBumpsRevision: false, staleGoesToPrevious: true });
  h.prevPts[4] = [{ phut: 0, value: 77, stage: 1 }]; // tick live đã đẩy mẻ cũ xuống
  const rev = h.beginLoad();
  h.onStop(4);
  const revBumped = rev.slice();
  revBumped[3] = rev[3] + 1; // giả lập mẻ mới đã bắt đầu -> stale
  h.finishLoad(revBumped, payloadsForAll());
  assert.equal(h.prevPts[4][0].value, 77, "không được ghi đè Mẻ trước do tick live dựng");
});
