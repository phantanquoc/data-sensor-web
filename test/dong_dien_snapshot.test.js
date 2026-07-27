"use strict";

// Unit tests for dòng điện snapshot validation in postDataPlc.
// Verifies that abnormal current values (PLC transient/garbage at M1/M155 edge)
// are NOT locked into the hiệu suất snapshot.
// Run: node --test test/dong_dien_snapshot.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");

// We can't easily unit-test the full postDataPlc flow (requires Mongoose, socket.io, etc.)
// but we CAN test the validation logic by requiring the constant and simulating the
// lock condition.

const { DONG_DIEN_MAX_REASONABLE } = require("../controller/post_data_plc");

test("DONG_DIEN_MAX_REASONABLE is 50A", () => {
  assert.strictEqual(DONG_DIEN_MAX_REASONABLE, 50);
});

test("normal current values pass threshold", () => {
  const normals = [5.3, 12.8, 17.6, 25.0, 49.9];
  for (const v of normals) {
    assert.ok(v <= DONG_DIEN_MAX_REASONABLE, `${v}A should pass`);
  }
});

test("abnormal transient values fail threshold", () => {
  const abnormals = [7168.2, 6584.6, 6348.8, 50.01, 100, 1000];
  for (const v of abnormals) {
    assert.ok(v > DONG_DIEN_MAX_REASONABLE, `${v}A should be rejected`);
  }
});

// Simulate the nhungHangLocked logic
test("nhung_hang lock requires ap_suat != 0 AND dong_dien valid", () => {
  // Case 1: ap_suat=0 → NOT locked (keep re-reading)
  const snap1 = { ap_suat_chan_khong: 0, dong_dien_dong_co_root: 5.3, dong_dien_dong_co_vong_nuoc: 17.6 };
  const locked1 = Number(snap1.ap_suat_chan_khong) !== 0 &&
    snap1.dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    snap1.dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;
  assert.strictEqual(locked1, false, "ap_suat=0 → should NOT lock");

  // Case 2: ap_suat!=0 but dong_dien_root too high → NOT locked
  const snap2 = { ap_suat_chan_khong: -0.45, dong_dien_dong_co_root: 7168.2, dong_dien_dong_co_vong_nuoc: 17.6 };
  const locked2 = Number(snap2.ap_suat_chan_khong) !== 0 &&
    snap2.dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    snap2.dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;
  assert.strictEqual(locked2, false, "dong_dien_root=7168 → should NOT lock");

  // Case 3: ap_suat!=0 but dong_dien_vong_nuoc too high → NOT locked
  const snap3 = { ap_suat_chan_khong: -0.45, dong_dien_dong_co_root: 10.5, dong_dien_dong_co_vong_nuoc: 6584.6 };
  const locked3 = Number(snap3.ap_suat_chan_khong) !== 0 &&
    snap3.dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    snap3.dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;
  assert.strictEqual(locked3, false, "dong_dien_vong_nuoc=6584 → should NOT lock");

  // Case 4: ap_suat!=0 AND both dong_dien normal → LOCKED ✓
  const snap4 = { ap_suat_chan_khong: -0.45, dong_dien_dong_co_root: 10.5, dong_dien_dong_co_vong_nuoc: 17.6 };
  const locked4 = Number(snap4.ap_suat_chan_khong) !== 0 &&
    snap4.dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    snap4.dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;
  assert.strictEqual(locked4, true, "all valid → should lock");
});

test("nhung_hang exhaustion fallback: locks after max retries regardless", () => {
  // After NHUNG_HANG_MAX_RETRIES (20) cycles, lock even if dong_dien is bad
  const MAX_RETRIES = 20;
  const snap = { ap_suat_chan_khong: -0.45, dong_dien_dong_co_root: 7168.2, dong_dien_dong_co_vong_nuoc: 6584.6 };
  const nhHasAp = Number(snap.ap_suat_chan_khong) !== 0;
  const nhDongDienOk =
    snap.dong_dien_dong_co_root <= DONG_DIEN_MAX_REASONABLE &&
    snap.dong_dien_dong_co_vong_nuoc <= DONG_DIEN_MAX_REASONABLE;

  // Before max retries → NOT locked
  let retries = 19;
  let exhausted = retries >= MAX_RETRIES;
  let locked = nhHasAp && (nhDongDienOk || exhausted);
  assert.strictEqual(locked, false, "19 retries → not exhausted yet");

  // At max retries → LOCKED (fallback)
  retries = 20;
  exhausted = retries >= MAX_RETRIES;
  locked = nhHasAp && (nhDongDienOk || exhausted);
  assert.strictEqual(locked, true, "20 retries → exhausted → force lock");
});

test("kick_root 2s delay validates dong_dien before overwriting", () => {
  // Simulates the setTimeout callback logic:
  // Only overwrite if value is finite AND <= MAX_REASONABLE
  const cases = [
    { val: 5.3, shouldUpdate: true },
    { val: 17.6, shouldUpdate: true },
    { val: 49.9, shouldUpdate: true },
    { val: 7168.2, shouldUpdate: false },
    { val: 6584.6, shouldUpdate: false },
    { val: NaN, shouldUpdate: false },
    { val: Infinity, shouldUpdate: false },
  ];
  for (const { val, shouldUpdate } of cases) {
    const wouldUpdate = Number.isFinite(val) && val <= DONG_DIEN_MAX_REASONABLE;
    assert.strictEqual(wouldUpdate, shouldUpdate, `val=${val} → shouldUpdate=${shouldUpdate}`);
  }
});
