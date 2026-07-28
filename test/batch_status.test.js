"use strict";

// Unit tests for batchStatus helper (time-threshold classification).
// Run: node --test

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { batchStatus, MIN_COMPLETED_MINUTES } = require(
  path.join(__dirname, "..", "backend", "controller", "home.js"),
);

const stopped = (ttc) => ({
  thoi_gian_stop: "12:00:00 24/07/2026",
  tong_thoi_gian_chay: ttc,
});

test("ngưỡng hoàn thành là 80 phút", () => {
  assert.equal(MIN_COMPLETED_MINUTES, 80);
});

test("ngay dưới ngưỡng → error", () => {
  assert.equal(batchStatus(stopped(MIN_COMPLETED_MINUTES - 1)), "error");
});

test("đúng ngưỡng → completed", () => {
  assert.equal(batchStatus(stopped(MIN_COMPLETED_MINUTES)), "completed");
});

test("trên ngưỡng → completed", () => {
  assert.equal(batchStatus(stopped(MIN_COMPLETED_MINUTES + 1)), "completed");
});

test("mẻ 80-84 phút giờ được tính hoàn thành (trước đây bị gắn lỗi)", () => {
  for (const ttc of [80, 81, 82, 83, 84]) {
    assert.equal(batchStatus(stopped(ttc)), "completed", `${ttc} phút phải là completed`);
  }
});

test("mẻ dưới 80 phút vẫn là lỗi", () => {
  for (const ttc of [0, 10, 45, 73, 79]) {
    assert.equal(batchStatus(stopped(ttc)), "error", `${ttc} phút phải là error`);
  }
});

test("stopped, ttc=0 → error", () => {
  const doc = { thoi_gian_stop: "12:00:00 24/07/2026", tong_thoi_gian_chay: 0 };
  assert.equal(batchStatus(doc), "error");
});

test("running (thoi_gian_stop empty string) with ttc=200 → running", () => {
  const doc = { thoi_gian_stop: "", tong_thoi_gian_chay: 200 };
  assert.equal(batchStatus(doc), "running");
});

test("running (thoi_gian_stop undefined) → running", () => {
  const doc = {};
  assert.equal(batchStatus(doc), "running");
});

test("stopped, tong_thoi_gian_chay undefined → error", () => {
  const doc = { thoi_gian_stop: "12:00:00 24/07/2026" };
  assert.equal(batchStatus(doc), "error");
});
