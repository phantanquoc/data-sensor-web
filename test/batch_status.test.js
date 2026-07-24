"use strict";

// Unit tests for batchStatus helper (time-threshold classification).
// Run: node --test

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { batchStatus } = require(
  path.join(__dirname, "..", "controller", "home.js"),
);

test("stopped, ttc=84 → error", () => {
  const doc = { thoi_gian_stop: "12:00:00 24/07/2026", tong_thoi_gian_chay: 84 };
  assert.equal(batchStatus(doc), "error");
});

test("stopped, ttc=85 → completed", () => {
  const doc = { thoi_gian_stop: "12:00:00 24/07/2026", tong_thoi_gian_chay: 85 };
  assert.equal(batchStatus(doc), "completed");
});

test("stopped, ttc=86 → completed", () => {
  const doc = { thoi_gian_stop: "12:00:00 24/07/2026", tong_thoi_gian_chay: 86 };
  assert.equal(batchStatus(doc), "completed");
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
