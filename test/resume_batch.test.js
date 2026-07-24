"use strict";

// Unit tests for shouldResumeAsNewBatch helper (D60-backwards guard).
// Run: node --test

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { shouldResumeAsNewBatch } = require(
  path.join(__dirname, "..", "controller", "post_data_plc.js"),
);

test("D60 reset to 0 from 90 → true (new batch)", () => {
  assert.equal(shouldResumeAsNewBatch(0, 90), true);
});

test("D60=5 from 90 → true (new batch early)", () => {
  assert.equal(shouldResumeAsNewBatch(5, 90), true);
});

test("D60=90 from 90 → false (same batch continuing)", () => {
  assert.equal(shouldResumeAsNewBatch(90, 90), false);
});

test("D60=91 from 90 → false (advanced further)", () => {
  assert.equal(shouldResumeAsNewBatch(91, 90), false);
});

test("D60=89 from 90 → false (within eps tolerance)", () => {
  assert.equal(shouldResumeAsNewBatch(89, 90), false);
});

test("D60=88 from 90 → false (exactly at eps boundary: 88+2=90, not < 90)", () => {
  assert.equal(shouldResumeAsNewBatch(88, 90), false);
});

test("D60=87 from 90 → true (just past eps: 87+2=89 < 90)", () => {
  assert.equal(shouldResumeAsNewBatch(87, 90), true);
});

test("D60=0 from 0 → false (fresh / nothing stored)", () => {
  assert.equal(shouldResumeAsNewBatch(0, 0), false);
});

test("D60=undefined from 90 → true (missing live reads as 0)", () => {
  assert.equal(shouldResumeAsNewBatch(undefined, 90), true);
});

test("D60=50 from undefined → false (missing prev reads as 0)", () => {
  assert.equal(shouldResumeAsNewBatch(50, undefined), false);
});
