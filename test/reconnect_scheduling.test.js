/**
 * Mô phỏng đúng cấu trúc lịch reconnect trong app.js (runCycle + plcLoop) để
 * chứng minh: mất kết nối lâu chỉ sinh MỘT timer tại một thời điểm và MỘT
 * connect() đang bay, thay vì chồng timer như trước.
 *
 * Không import app.js (nó mở server + socket + Modbus thật).
 */
const test = require("node:test");
const assert = require("node:assert/strict");

// Bản sao logic lịch trình, tham số hoá phần I/O để đếm được.
function makeScheduler({ connectSucceedsAfter = Infinity } = {}) {
  const state = {
    isConnected: false,
    timer: null,
    reconnecting: false,
    connectCalls: 0,
    timersCreated: 0,
    pendingTimers: 0,
  };

  const setT = (fn) => {
    state.timersCreated++;
    state.pendingTimers++;
    return { fn };
  };
  const clearT = (t) => {
    if (t) state.pendingTimers--;
  };

  function plcLoop() {
    if (state.reconnecting) return;
    state.reconnecting = true;
    state.connectCalls++;
    const ok = state.connectCalls >= connectSucceedsAfter;
    if (ok) {
      state.isConnected = true;
      state.reconnecting = false;
    } else {
      state.reconnecting = false;
      clearT(state.timer);
      state.timer = setT(() => plcLoop());
    }
  }

  // Một vòng runCycle ở nhánh mất kết nối
  function runCycleDisconnected() {
    if (!state.timer && !state.reconnecting) {
      state.timer = setT(() => {
        state.timer = null;
        plcLoop();
      });
    }
  }

  function fireTimer() {
    const t = state.timer;
    if (!t) return;
    clearT(t);
    state.timer = null;
    t.fn();
  }

  return { state, runCycleDisconnected, fireTimer, plcLoop };
}

test("mất kết nối 50 cycle chỉ tồn tại 1 timer chờ tại mọi thời điểm", () => {
  const s = makeScheduler();
  for (let i = 0; i < 50; i++) {
    s.runCycleDisconnected();
    assert.ok(s.state.pendingTimers <= 1, `cycle ${i}: có ${s.state.pendingTimers} timer chờ`);
  }
  // 50 cycle nhưng chỉ tạo 1 timer, vì cycle sau thấy timer đã có thì bỏ qua
  assert.equal(s.state.timersCreated, 1);
  assert.equal(s.state.connectCalls, 0, "chưa timer nào nổ nên chưa connect");
});

test("timer nổ → đúng 1 connect(), không nhân bản", () => {
  const s = makeScheduler();
  for (let i = 0; i < 10; i++) s.runCycleDisconnected();
  s.fireTimer();
  assert.equal(s.state.connectCalls, 1);
  // connect thất bại → hẹn lại đúng 1 timer
  assert.ok(s.state.pendingTimers <= 1);
});

test("30 vòng cycle+timer xen kẽ: số connect bằng số lần timer nổ", () => {
  const s = makeScheduler();
  let fired = 0;
  for (let i = 0; i < 30; i++) {
    s.runCycleDisconnected();
    s.runCycleDisconnected(); // cycle thứ hai không được tạo thêm timer
    s.fireTimer();
    fired++;
    assert.ok(s.state.pendingTimers <= 1, `vòng ${i}: ${s.state.pendingTimers} timer chờ`);
  }
  assert.equal(s.state.connectCalls, fired);
});

test("connect thành công thì dừng hẹn timer mới", () => {
  const s = makeScheduler({ connectSucceedsAfter: 1 });
  s.runCycleDisconnected();
  s.fireTimer();
  assert.equal(s.state.isConnected, true);
  assert.equal(s.state.connectCalls, 1);
  assert.equal(s.state.pendingTimers, 0, "không còn timer treo sau khi nối được");
});

test("cờ reconnecting chặn connect() song song", () => {
  const s = makeScheduler();
  s.state.reconnecting = true;
  s.plcLoop();
  s.plcLoop();
  assert.equal(s.state.connectCalls, 0, "đang connect dở thì không gọi thêm");
});
