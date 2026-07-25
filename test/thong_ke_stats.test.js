"use strict";

// Unit tests for countBatchStats — trọng tâm: mẻ ĐANG CHẠY phải được tính
// dù ngày bắt đầu nằm ngoài khoảng lọc (bug: máy 8 chạy qua đêm → hiện 0).
// Run: node --test test/thong_ke_stats.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { countBatchStats } = require(
  path.join(__dirname, "..", "controller", "home.js"),
);

// Khoảng "hôm nay" = 25/07/2026 theo giờ VN (+07:00)
const FROM = new Date("2026-07-25T00:00:00.000+07:00");
const TO = new Date("2026-07-25T23:59:59.999+07:00");

/**
 * Helper: tạo chuỗi timestamp DD/MM/YYYY HH:mm:ss cho `minutesAgo` phút trước (giờ VN).
 * Dùng cho mẻ đang chạy — đảm bảo không bị zombie detection (>8h) đánh rụng.
 */
function recentVNTimestamp(minutesAgo = 5) {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  // Convert to VN timezone (UTC+7)
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(vn.getUTCHours()).padStart(2, "0");
  const mm = String(vn.getUTCMinutes()).padStart(2, "0");
  const ss = String(vn.getUTCSeconds()).padStart(2, "0");
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const mo = String(vn.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = vn.getUTCFullYear();
  return `${hh}:${mm}:${ss} ${dd}/${mo}/${yyyy}`;
}

/** Mẻ đang chạy (chưa có thoi_gian_stop) với thoi_gian_start_at (Date object). */
function running(startAt) {
  return { thoi_gian_start_at: startAt, thoi_gian_stop: "" };
}

/** Mẻ đang chạy (chưa có thoi_gian_stop) với thoi_gian_start legacy string. */
function runningLegacy(start) {
  return { thoi_gian_start: start, thoi_gian_stop: "" };
}

/** Mẻ đã xong (>=85 phút) bắt đầu lúc `start`. */
function completed(start) {
  return {
    thoi_gian_start: start,
    thoi_gian_stop: "23:00:00 " + start.split(" ")[1],
    tong_thoi_gian_chay: 90,
  };
}

/** Mẻ lỗi (<85 phút) bắt đầu lúc `start`. */
function errored(start) {
  return {
    thoi_gian_start: start,
    thoi_gian_stop: "23:00:00 " + start.split(" ")[1],
    tong_thoi_gian_chay: 40,
  };
}

// ====================================================================
// Test: mẻ đang chạy (bắt đầu gần đây) phải xuất hiện trong thống kê
// ====================================================================
test("running batch started recently is counted when filter=today", () => {
  // Use thoi_gian_start_at (Date) — recent enough to avoid zombie detection
  const recentStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
  const docs = [[running(recentStart)]];
  const stats = countBatchStats(docs, FROM, TO);
  assert.equal(stats.dang_chay, 1, "dang_chay phải = 1");
  assert.equal(stats.tong, 1, "tong phải = 1");
});

test("running batch started 6h ago (within zombie threshold) is still running", () => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const docs = [[running(sixHoursAgo)]];
  const stats = countBatchStats(docs, null, null);
  assert.equal(stats.dang_chay, 1);
  assert.equal(stats.tong, 1);
});

test("zombie: running batch started >8h ago classified as error", () => {
  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const docs = [[running(tenHoursAgo)]];
  const stats = countBatchStats(docs, null, null);
  assert.equal(stats.dang_chay, 0, "zombie should not count as running");
  assert.equal(stats.loi, 1, "zombie should count as error");
  assert.equal(stats.tong, 1);
});

test("running batch with legacy timestamp (recent) is counted", () => {
  const docs = [[runningLegacy(recentVNTimestamp(30))]]; // 30 min ago
  const stats = countBatchStats(docs, null, null);
  assert.equal(stats.dang_chay, 1);
  assert.equal(stats.tong, 1);
});

test("completed batch started YESTERDAY is excluded from today filter", () => {
  const docs = [[completed("04:01:00 24/07/2026")]];
  const stats = countBatchStats(docs, FROM, TO);
  assert.equal(stats.tong, 0);
  assert.equal(stats.hoan_thanh, 0);
});

test("completed batch started TODAY is included", () => {
  const docs = [[completed("06:00:00 25/07/2026")]];
  const stats = countBatchStats(docs, FROM, TO);
  assert.equal(stats.hoan_thanh, 1);
  assert.equal(stats.tong, 1);
});

test("error batch started yesterday excluded from today", () => {
  const docs = [[errored("22:00:00 24/07/2026")]];
  const stats = countBatchStats(docs, FROM, TO);
  assert.equal(stats.tong, 0);
});

test("mix: 1 running (recent), 2 completed (today), 1 error (yesterday)", () => {
  const recentStart = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
  const docs = [[
    running(recentStart),
    completed("07:00:00 25/07/2026"),
    completed("10:00:00 25/07/2026"),
    errored("20:00:00 24/07/2026"),
  ]];
  const stats = countBatchStats(docs, FROM, TO);
  assert.equal(stats.dang_chay, 1, "running always counted");
  assert.equal(stats.hoan_thanh, 2);
  assert.equal(stats.loi, 0, "error from yesterday excluded");
  assert.equal(stats.tong, 3, "1 running + 2 completed");
});

test("no date filter (from=null, to=null) → count all", () => {
  const recentStart = new Date(Date.now() - 30 * 60 * 1000); // 30min ago
  const docs = [[
    running(recentStart),
    completed("07:00:00 20/07/2026"),
    errored("20:00:00 18/07/2026"),
  ]];
  const stats = countBatchStats(docs, null, null);
  assert.equal(stats.tong, 3);
  assert.equal(stats.dang_chay, 1);
  assert.equal(stats.hoan_thanh, 1);
  assert.equal(stats.loi, 1);
});

test("multiple machines: running on machine 8, completed on machine 1", () => {
  const recentStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
  const machine1 = [completed("09:00:00 25/07/2026")];
  const machine8 = [running(recentStart)];
  const stats = countBatchStats([machine1, machine8], FROM, TO);
  assert.equal(stats.tong, 2);
  assert.equal(stats.hoan_thanh, 1);
  assert.equal(stats.dang_chay, 1);
});
