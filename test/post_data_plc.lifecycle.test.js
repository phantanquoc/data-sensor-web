"use strict";

// Lifecycle + write-robustness tests for postDataPlc (Recommendation A).
// Run: node --test
//
// These verify the batch M120 lifecycle (Start counter 0/1/2) and that the
// Mongo writes are rejection-safe:
//   - Start=1 creates exactly one document and sets id_document BEFORE any push.
//   - A full 1→2→2→0 sequence creates exactly one document.
//   - A write rejection mid-batch does not throw and later cycles still write.
//   - No unhandledRejection escapes when every write rejects.
//
// postDataPlc keeps per-fryer state module-scoped and non-resettable, so each
// test uses a DISTINCT fryer index n to stay isolated from the others.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { postDataPlc } = require(
  path.join(__dirname, "..", "controller", "post_data_plc.js"),
);

// --- Mocks ------------------------------------------------------------------
function makeModel(opts = {}) {
  const calls = { create: 0, updateOne: [], updateMany: 0 };
  let idSeq = 0;
  const model = {
    async create() {
      calls.create++;
      idSeq++;
      return { _id: "id_" + idSeq };
    },
    async updateOne(filter, update) {
      calls.updateOne.push({ filter, update });
      if (
        typeof opts.rejectUpdateOneAt === "function" &&
        opts.rejectUpdateOneAt(calls.updateOne.length)
      ) {
        throw new Error("simulated write failure");
      }
      return { acknowledged: true };
    },
    async updateMany() {
      calls.updateMany++;
      return { acknowledged: true };
    },
  };
  return { model, calls };
}

const io_ = { to() { return { emit() {} }; } };

const pushUpdates = (calls) =>
  calls.updateOne.filter((c) => c.update && c.update.$push);

// call postDataPlc for fryer n (giai_doan flags default false)
function run(model, n, Start, gd1 = false, gd2 = false, gd3 = false, gd4 = false) {
  return postDataPlc(model, n, {}, io_, Start, gd1, gd2, gd3, gd4);
}

// --- Tests ------------------------------------------------------------------
test("Start=1 creates exactly one document and produces no stage push", async () => {
  const { model, calls } = makeModel();
  await run(model, 1, 1);
  assert.equal(calls.create, 1, "create called once on Start=1");
  assert.equal(pushUpdates(calls).length, 0, "no $push before batch is running");
});

test("id_document set on Start=1 enables push on Start=2 (still one document)", async () => {
  const { model, calls } = makeModel();
  await run(model, 2, 1);          // create doc + set id_document[2]
  await run(model, 2, 2, true);    // stage 1 active → $push into giai_doan_1
  assert.equal(calls.create, 1, "still exactly one document");
  const pushes = pushUpdates(calls);
  assert.ok(pushes.length >= 1, "a $push occurred on Start=2");
  // The push must target the document created on Start=1 (id_1), proving
  // id_document[n] was assigned before the push cycle — the race this fix closes.
  assert.equal(
    pushes[0].filter._id,
    "id_1",
    "push targets the just-created document, not a stale/undefined id",
  );
});

test("sequence 1→2→2→0 creates exactly one document", async () => {
  const { model, calls } = makeModel();
  await run(model, 3, 1, true);
  await run(model, 3, 2, true);
  await run(model, 3, 2, true);
  await run(model, 3, 0, true);
  assert.equal(calls.create, 1, "exactly one document across the full lifecycle");
  assert.equal(calls.updateMany, 1, "stale-close updateMany ran once at batch open");
});

test("write rejection mid-batch does not throw; later cycles keep writing", async () => {
  const { model, calls } = makeModel({ rejectUpdateOneAt: () => true });
  await run(model, 4, 1, true);            // create ok; ma_me_chien write rejects (caught)
  const afterStart = calls.updateOne.length;
  await run(model, 4, 2, true);            // stage push rejects (caught)
  assert.equal(calls.create, 1, "document still created despite write failures");
  assert.ok(
    calls.updateOne.length > afterStart,
    "a later cycle still attempted a write after an earlier failure",
  );
  // Reaching here without an exception proves .catch swallowed the rejections.
});

test("no unhandledRejection escapes when every write rejects", async () => {
  const captured = [];
  const onUnhandled = (err) => captured.push(err);
  process.on("unhandledRejection", onUnhandled);
  try {
    const { model } = makeModel({ rejectUpdateOneAt: () => true });
    await run(model, 5, 1, true);
    await run(model, 5, 2, true);
    await run(model, 5, 0, true);
    await new Promise((r) => setTimeout(r, 20)); // let any stray rejection surface
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.equal(captured.length, 0, "no unhandled promise rejections");
});
