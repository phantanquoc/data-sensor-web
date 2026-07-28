"use strict";

// Tests cho cách chốt ô của bảng "Hiệu suất máy" (mốc M1 kick root / M155 nhúng hàng).
//
// Yêu cầu nghiệp vụ: mỗi ô chốt MỘT LẦN rồi cố định vĩnh viễn — xem lại mẻ sau khi
// kết thúc phải ra đúng con số lúc sự kiện xảy ra. Trước đây snapshot bị chụp lại mỗi
// cycle nên dòng điện/nhiệt độ đổi giá trị giữa lúc đang chạy và lúc xem lại.
//
// Run: node --test test/dong_dien_snapshot.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  DONG_DIEN_MAX_REASONABLE,
  DONG_DIEN_MAX_WAIT_CYCLES,
  PLC_LATCH_MAX_READS,
  dongDienHopLe,
  nenChotDongDien,
  nenChotDongDienRoot,
  nenChotLatchPlc,
  postDataPlc,
} = require("../backend/controller/post_data_plc");

test("ngưỡng dòng điện là 50A, số lần đọc latch là 5, cap chờ dòng điện là 10 cycles", () => {
  assert.strictEqual(DONG_DIEN_MAX_REASONABLE, 50);
  assert.strictEqual(PLC_LATCH_MAX_READS, 5);
  assert.strictEqual(DONG_DIEN_MAX_WAIT_CYCLES, 10);
});

// ---------------------------------------------------------------- dòng điện

test("dòng điện trong dải thật → hợp lệ", () => {
  for (const v of [5.3, 8.7, 12.8, 17.6, 25.0, 49.9, 50]) {
    assert.strictEqual(dongDienHopLe(v), true, `${v}A phải hợp lệ`);
  }
});

test("dòng điện quá độ (> 50A) → không hợp lệ", () => {
  for (const v of [50.01, 100, 6584.6, 7168.2, 13107.2, 13516]) {
    assert.strictEqual(dongDienHopLe(v), false, `${v}A phải bị loại`);
  }
});

test("0 là 'chưa đọc kịp', KHÔNG phải giá trị hợp lệ", () => {
  // Bug cũ: điều kiện chỉ kiểm <= 50 nên 0 lọt qua rồi bị chốt luôn.
  assert.strictEqual(dongDienHopLe(0), false);
});

test("số âm và giá trị không phải số → không hợp lệ", () => {
  for (const v of [-1, -8.7, NaN, Infinity, -Infinity, null, undefined, "8.7"]) {
    assert.strictEqual(dongDienHopLe(v), false, `${String(v)} phải bị loại`);
  }
});

// ------------------------------------------------- dòng điện root tại mốc M1

test("M1: đọc ngay tại sườn lên, giá trị dùng được thì chốt luôn", () => {
  // Cần thông số ĐÚNG thời điểm sự kiện → không cố tình bỏ cycle nào.
  assert.strictEqual(nenChotDongDienRoot(8.7), true);
  assert.strictEqual(nenChotDongDienRoot(12.5), true);
});

test("M1: chỉ khi giá trị không dùng được mới đọc tiếp", () => {
  // =0: chưa đọc kịp. >50: đang quá độ lúc vừa kick.
  assert.strictEqual(nenChotDongDienRoot(0), false, "0 → đọc tiếp");
  assert.strictEqual(nenChotDongDienRoot(13516), false, "quá độ → đọc tiếp");
});

test("M1: chốt ở lần đọc đầu tiên có giá trị dùng được", () => {
  const chuoi = [13516, 0, 8.8, 6.1];  // rác → chưa kịp → dùng được → (đã chốt)
  const chotTai = chuoi.findIndex((v) => nenChotDongDienRoot(v));
  assert.strictEqual(chotTai, 2, "phải chốt ở giá trị 8.8, không lấy 6.1");
});

test("nenChotDongDien: giá trị ngoài dải → chưa chốt (pure predicate)", () => {
  // Predicate chỉ kiểm tra giá trị, không kiểm tra window/cap — đó là logic caller.
  assert.strictEqual(nenChotDongDienRoot(13516), false);
  assert.strictEqual(nenChotDongDienRoot(8.7), true);
});

// ------------------------------------- nhóm thanh ghi PLC latch (t/g + áp suất)

test("latch: đọc được ngay lần đầu → chốt luôn", () => {
  assert.strictEqual(nenChotLatchPlc(1, 91, 680), true);
});

test("latch: chỉ một trong hai khác 0 cũng tính là đọc được", () => {
  // PLC có thể ghi hai thanh ghi lệch nhau một nhịp scan.
  assert.strictEqual(nenChotLatchPlc(1, 91, 0), true, "có thời gian → chốt");
  assert.strictEqual(nenChotLatchPlc(1, 0, 680), true, "có áp suất → chốt");
});

test("latch: cả hai còn 0 thì đọc lại, tối đa 5 lần", () => {
  for (let reads = 1; reads <= 4; reads++) {
    assert.strictEqual(nenChotLatchPlc(reads, 0, 0), false, `lần ${reads} → đọc lại`);
  }
  assert.strictEqual(nenChotLatchPlc(5, 0, 0), true, "lần 5 → hết lượt, chốt (caller latch null)");
});

test("latch: đọc được ở lần 3 thì chốt ở lần 3, không chờ hết 5 lần", () => {
  assert.strictEqual(nenChotLatchPlc(1, 0, 0), false);
  assert.strictEqual(nenChotLatchPlc(2, 0, 0), false);
  assert.strictEqual(nenChotLatchPlc(3, 5, 735.94), true);
});

test("latch: áp suất âm là số đo thật, không phải 'chưa đọc được'", () => {
  // ap_suat_vong_nuoc thực tế có giá trị âm (-2.5); ngưỡng phải là "khác 0".
  assert.strictEqual(nenChotLatchPlc(1, 0, -0.45), true);
});

// ========================================================================
// Orchestration tests: drive postDataPlc with mock model, verify DB writes.
// Mỗi test dùng fryer index riêng biệt (n = 10+) để tránh collide state
// module-scope với nhau và với test lifecycle (n=1..5).
// ========================================================================

function makeModel(opts = {}) {
  const calls = { create: 0, updateOne: [], updateMany: 0 };
  let idSeq = 100;
  const model = {
    async create() {
      calls.create++;
      idSeq++;
      return { _id: "snap_id_" + idSeq };
    },
    async updateOne(filter, update) {
      calls.updateOne.push({ filter, update });
      if (typeof opts.rejectUpdateOneAt === "function" && opts.rejectUpdateOneAt(calls.updateOne.length)) {
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

// Helper: gọi postDataPlc với values chứa M1/M155 + dòng điện cần test
function run(model, n, Start, vals = {}, gd1 = false) {
  const values = { ...vals };
  return postDataPlc(model, n, values, io_, Start, gd1, false, false, false);
}

// Helper: lọc writes liên quan đến hieu_suat_may
function hieuSuatWrites(calls) {
  return calls.updateOne.filter((c) => {
    const u = c.update;
    if (!u || !u.$set) return false;
    const keys = Object.keys(u.$set);
    return keys.some((k) => k.startsWith("hieu_suat_may"));
  });
}

// --- Test 1: Rising-edge cycle produces exactly ONE write per row ---
test("M1 rising-edge: exactly ONE updateOne for kick_root row", async () => {
  const { model, calls } = makeModel();
  const n = 10;
  // Start=1 tạo batch
  await run(model, n, 1);
  // Cycle với M1 rising edge + dòng điện hợp lệ + PLC latch có data
  await run(model, n, 2, {
    M1: true,
    D575: 0, D576: 16640,  // ~8.5A root (sẽ hợp lệ khi đọc float)
    D571: 0, D572: 16896,  // ~12A vòng nước
    D668: 1, D666: 31,     // 91s (giay_m120_m1 != 0)
    D216: 0, D217: 17152,  // áp suất != 0
  });
  // Đếm writes có "hieu_suat_may.kick_root" trong cycle M1
  const writes = hieuSuatWrites(calls);
  // Chỉ có DUY NHẤT 1 write cho kick_root (whole-object write)
  const kickRootWrites = writes.filter((w) => {
    const keys = Object.keys(w.update.$set);
    return keys.some((k) => k === "hieu_suat_may.kick_root" || k.startsWith("hieu_suat_may.kick_root."));
  });
  assert.strictEqual(kickRootWrites.length, 1, "exactly ONE write for kick_root on M1 edge cycle");
});

// --- Test 2: No write ever sets an already-latched cell back to null ---
test("đã chốt giá trị → không bao giờ bị ghi lại null", async () => {
  const { model, calls } = makeModel();
  const n = 11;
  await run(model, n, 1);
  // M1 edge: root current hợp lệ → chốt ngay
  await run(model, n, 2, { M1: true, D575: 0, D576: 16640, D571: 0, D572: 16896 });
  // Cycle sau: root current bây giờ là 0 (giả lập CT sensor fail) → KHÔNG được ghi lại
  await run(model, n, 2, { D575: 0, D576: 0, D571: 0, D572: 0 });
  await run(model, n, 2, { D575: 0, D576: 0, D571: 0, D572: 0 });
  // Kiểm tra: không write nào có dong_dien_dong_co_root = null SAU write đầu tiên
  const allWrites = hieuSuatWrites(calls);
  // Write đầu tiên là whole-object (có thể chứa null cho ô chưa chốt, nhưng root ĐÃ
  // chốt nên phải có giá trị). Writes sau không được set root = null.
  for (let i = 1; i < allWrites.length; i++) {
    const set = allWrites[i].update.$set;
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_root" in set) {
      assert.notStrictEqual(
        set["hieu_suat_may.kick_root.dong_dien_dong_co_root"],
        null,
        "write " + (i + 1) + " must not set already-latched cell back to null",
      );
    }
  }
});

// --- Test 3: Latched cell keeps value across later cycles ---
test("giá trị đã chốt không đổi dù sensor thay đổi ở cycle sau", async () => {
  const { model, calls } = makeModel();
  const n = 12;
  await run(model, n, 1);
  // M1 edge: PLC latch có data → chốt luôn giay_tu_start + ap_suat
  await run(model, n, 2, { M1: true, D668: 1, D666: 30, D216: 100, D217: 0 });
  const firstWrite = hieuSuatWrites(calls)[0];
  const firstSnap = firstWrite.update.$set["hieu_suat_may.kick_root"];
  const originalGiay = firstSnap.giay_tu_start;
  // Cycle sau với D668/D666 khác → KHÔNG được ghi lại
  await run(model, n, 2, { D668: 2, D666: 5 });
  await run(model, n, 2, { D668: 3, D666: 0 });
  // Kiểm tra: không có write nào cập nhật giay_tu_start
  const laterWrites = hieuSuatWrites(calls).slice(1);
  for (const w of laterWrites) {
    const set = w.update.$set;
    if ("hieu_suat_may.kick_root.giay_tu_start" in set) {
      assert.strictEqual(
        set["hieu_suat_may.kick_root.giay_tu_start"],
        originalGiay,
        "giay_tu_start must not change after latch",
      );
    }
  }
});

// --- Test 4: PLC-latch group exhausted after 5 all-zero reads → latches null ---
test("PLC latch hết 5 lần đọc 0 → chốt null (không phải 0)", async () => {
  const { model, calls } = makeModel();
  const n = 13;
  await run(model, n, 1);
  // M1 edge: D668=0 D666=0 D216=0 D217=0 → PLC chưa ghi
  await run(model, n, 2, { M1: true, D575: 0, D576: 16640, D571: 0, D572: 16896 });
  // 4 cycles nữa: vẫn 0
  for (let i = 0; i < 4; i++) {
    await run(model, n, 2, { D575: 0, D576: 16640, D571: 0, D572: 16896 });
  }
  // Tìm write cuối cùng có giay_tu_start
  const allWrites = hieuSuatWrites(calls);
  let lastGiayValue;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"]) {
      lastGiayValue = set["hieu_suat_may.kick_root"].giay_tu_start;
    }
    if ("hieu_suat_may.kick_root.giay_tu_start" in set) {
      lastGiayValue = set["hieu_suat_may.kick_root.giay_tu_start"];
    }
  }
  assert.strictEqual(lastGiayValue, null, "exhausted PLC latch must be null, not 0");
});

// --- Test 5: Current stays garbage for whole wait window → latches null ---
test("dòng điện rác suốt 10 cycles + M155 chưa lên → chốt null", async () => {
  const { model, calls } = makeModel();
  const n = 14;
  await run(model, n, 1);
  // M1 edge: root=garbage, vong nuoc=garbage
  await run(model, n, 2, { M1: true, D575: 13107, D576: 13107, D571: 13107, D572: 13107 });
  // 10 more cycles (all garbage, M155 not risen = gd1 stays false)
  for (let i = 0; i < 10; i++) {
    await run(model, n, 2, { D575: 13107, D576: 13107, D571: 13107, D572: 13107 });
  }
  // After window closes, the last write should have null for both currents
  const allWrites = hieuSuatWrites(calls);
  let lastRootValue, lastVNValue;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"]) {
      lastRootValue = set["hieu_suat_may.kick_root"].dong_dien_dong_co_root;
      lastVNValue = set["hieu_suat_may.kick_root"].dong_dien_dong_co_vong_nuoc;
    }
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_root" in set) {
      lastRootValue = set["hieu_suat_may.kick_root.dong_dien_dong_co_root"];
    }
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_vong_nuoc" in set) {
      lastVNValue = set["hieu_suat_may.kick_root.dong_dien_dong_co_vong_nuoc"];
    }
  }
  assert.strictEqual(lastRootValue, null, "root current must latch null after window expires");
  assert.strictEqual(lastVNValue, null, "water-ring current must latch null after window expires");
});

// --- Test 6: Current becomes valid on 3rd cycle → latches that value ---
test("dòng điện hợp lệ ở cycle 3 → chốt giá trị cycle 3, không ghi đè sau", async () => {
  const { model, calls } = makeModel();
  const n = 15;
  await run(model, n, 1);
  // M1 edge: root=0 (chưa đọc kịp)
  await run(model, n, 2, { M1: true, D575: 0, D576: 0, D571: 0, D572: 0 });
  // Cycle 2: vẫn garbage
  await run(model, n, 2, { D575: 13107, D576: 13107, D571: 13107, D572: 13107 });
  // Cycle 3: root = 8.5A hợp lệ. Cần encode float 8.5 as LE uint16 pair.
  // 8.5f LE = 0x41080000 → low word = 0x0000, high word = 0x4108
  await run(model, n, 2, { D575: 0x0000, D576: 0x4108, D571: 0x0000, D572: 0x4140 });
  // Cycle 4: root = 25A (khác) → KHÔNG được ghi đè
  await run(model, n, 2, { D575: 0x0000, D576: 0x41C8, D571: 0x0000, D572: 0x41C8 });

  // Tìm giá trị cuối cùng ghi cho root current
  const allWrites = hieuSuatWrites(calls);
  let latchedRoot;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"]) {
      latchedRoot = set["hieu_suat_may.kick_root"].dong_dien_dong_co_root;
    }
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_root" in set) {
      latchedRoot = set["hieu_suat_may.kick_root.dong_dien_dong_co_root"];
    }
  }
  // 8.5A
  assert.strictEqual(latchedRoot, 8.5, "must latch the 3rd-cycle value (8.5A)");
});

// --- Test 7: updateOne rejects → later cycle writes again, cell not marked done ---
test("updateOne reject → retry cycle sau, cell chưa done", async () => {
  let rejected = false;
  const { model, calls } = makeModel({
    rejectUpdateOneAt: (callNum) => {
      // Reject the first kick_root persist write (detect by content)
      const call = calls.updateOne[callNum - 1];
      if (rejected) return false;
      const keys = Object.keys(call.update.$set || {});
      if (keys.some((k) => k.startsWith("hieu_suat_may"))) {
        rejected = true;
        return true;
      }
      return false;
    },
  });
  const n = 16;
  await run(model, n, 1);
  // M1 edge: dòng điện hợp lệ + PLC latch có data → bình thường sẽ chốt ngay
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x4108,   // 8.5A root
    D571: 0x0000, D572: 0x4140,   // 12A vong nuoc
    D668: 1, D666: 31,            // 91s
    D216: 100, D217: 0,           // áp suất
  });
  // Write thất bại → cycle tiếp phải ghi lại
  const writesBeforeRetry = hieuSuatWrites(calls).length;
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x4108,
    D571: 0x0000, D572: 0x4140,
  });
  const writesAfterRetry = hieuSuatWrites(calls).length;
  assert.ok(
    writesAfterRetry > writesBeforeRetry,
    "must retry write on next cycle after rejection",
  );
});

// --- Test 8: New batch (Start=1) resets state and captures from scratch ---
test("Start=1 mới reset state → mẻ mới chụp lại từ đầu", async () => {
  const { model, calls } = makeModel();
  const n = 17;
  // Mẻ 1: chụp kick_root
  await run(model, n, 1);
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x4108,
    D571: 0x0000, D572: 0x4140,
    D668: 1, D666: 30,
    D216: 100, D217: 0,
  });
  const writesAfterBatch1 = hieuSuatWrites(calls).length;
  // Mẻ 2: Start=1 lại
  await run(model, n, 1);
  // M1 edge mẻ mới → phải chụp lại
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x41A0,  // 20A (khác mẻ 1)
    D571: 0x0000, D572: 0x41C8,
    D668: 2, D666: 0,
    D216: 200, D217: 0,
  });
  const writesAfterBatch2 = hieuSuatWrites(calls).length;
  assert.ok(
    writesAfterBatch2 > writesAfterBatch1,
    "new batch must produce new kick_root write (state was reset)",
  );
  // Giá trị phải là của mẻ 2, không phải mẻ 1
  const lastWrite = hieuSuatWrites(calls).at(-1);
  const snap = lastWrite.update.$set["hieu_suat_may.kick_root"];
  assert.ok(snap, "last write should be whole-object kick_root");
  assert.strictEqual(snap.giay_tu_start, 120, "giay_tu_start from batch 2 = 2*60+0 = 120");
});

// ========================================================================
// REGRESSION TESTS: write-rejection must NOT destroy settled RAM values
// Mỗi test dùng fryer index riêng (n = 20+) — tránh collide state module-scope.
// ========================================================================

// --- Test 9: CRITICAL — write reject + sensor invalid + window close → valid value survives ---
test("CRITICAL: write reject → sensor invalid → window close → giá trị hợp lệ ban đầu vẫn sống", async () => {
  // Kịch bản chính xác từ finding:
  // Cycle M1 edge: root current 8.5A hợp lệ → latch vào RAM + write reject
  // Cycles tiếp: sensor fail (0A) + TẤT CẢ writes tiếp tục reject
  // Window đóng (cap 10 cycles) → PHẢI giữ 8.5A, KHÔNG bị null
  // Sau window close: write thành công → persist 8.5A
  let rejectUntilCycle = 12; // reject tất cả hieu_suat writes cho 12 cycles đầu
  let hieuSuatWriteCount = 0;
  const { model, calls } = makeModel({
    rejectUpdateOneAt: (callNum) => {
      const call = calls.updateOne[callNum - 1];
      const keys = Object.keys(call.update.$set || {});
      if (keys.some((k) => k.startsWith("hieu_suat_may"))) {
        hieuSuatWriteCount++;
        if (hieuSuatWriteCount <= rejectUntilCycle) return true;
      }
      return false;
    },
  });
  const n = 20;
  await run(model, n, 1);
  // Cycle 1 (M1 edge): root = 8.5A hợp lệ → latch + write REJECT
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x4108,   // 8.5A root
    D571: 0x0000, D572: 0x4140,   // 12A vong nuoc
    D668: 1, D666: 31,
    D216: 100, D217: 0,
  });
  // Cycles 2-11: sensor fail (0A), writes reject. Window đóng ở cycle 10.
  for (let i = 0; i < 10; i++) {
    await run(model, n, 2, { D575: 0, D576: 0, D571: 0, D572: 0 });
  }
  // Cycle 12+: allow writes to succeed. Run a few more cycles.
  rejectUntilCycle = 0; // stop rejecting
  await run(model, n, 2, { D575: 0, D576: 0, D571: 0, D572: 0 });
  await run(model, n, 2, { D575: 0, D576: 0, D571: 0, D572: 0 });

  // Kiểm tra: giá trị persisted phải là 8.5A, KHÔNG phải null
  const allWrites = hieuSuatWrites(calls);
  let lastRootValue = undefined;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"] && set["hieu_suat_may.kick_root"].dong_dien_dong_co_root !== undefined) {
      lastRootValue = set["hieu_suat_may.kick_root"].dong_dien_dong_co_root;
    }
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_root" in set) {
      lastRootValue = set["hieu_suat_may.kick_root.dong_dien_dong_co_root"];
    }
  }
  assert.strictEqual(lastRootValue, 8.5,
    "valid 8.5A was measured at event time — write rejection + window close must NOT destroy it");
});

// --- Test 10: Write reject + retry must persist ORIGINAL value, not later cycle's ---
test("write reject → retry persists giá trị cycle ĐẦU TIÊN, không phải cycle retry", async () => {
  let rejectCount = 0;
  const { model, calls } = makeModel({
    rejectUpdateOneAt: (callNum) => {
      const call = calls.updateOne[callNum - 1];
      if (rejectCount > 0) return false;
      const keys = Object.keys(call.update.$set || {});
      if (keys.some((k) => k.startsWith("hieu_suat_may"))) {
        rejectCount++;
        return true;
      }
      return false;
    },
  });
  const n = 21;
  await run(model, n, 1);
  // M1 edge: root = 8.5A → latch + write REJECT
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x4108,   // 8.5A
    D571: 0x0000, D572: 0x4140,   // 12A
    D668: 1, D666: 31,
    D216: 100, D217: 0,
  });
  // Retry cycle: root bây giờ là 25A (khác!) — nhưng phải persist 8.5 (giá trị ban đầu)
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x41C8,   // 25A
    D571: 0x0000, D572: 0x41C8,   // 25A
  });
  // Tìm giá trị cuối cùng được persist
  const allWrites = hieuSuatWrites(calls);
  let lastRootValue = undefined;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"]) {
      lastRootValue = set["hieu_suat_may.kick_root"].dong_dien_dong_co_root;
    }
    if ("hieu_suat_may.kick_root.dong_dien_dong_co_root" in set) {
      lastRootValue = set["hieu_suat_may.kick_root.dong_dien_dong_co_root"];
    }
  }
  assert.strictEqual(lastRootValue, 8.5,
    "must persist 8.5A from cycle 1, not 25A from retry cycle — latch exactly once");
});

// --- Test 11: PLC latch counter not coupled to write outcomes ---
test("PLC latch counter: write reject không tăng bộ đếm thêm (budget 5 = 5 cycles thật)", async () => {
  // Kịch bản: PLC latch = 0 cho 4 cycles (latchReads=4), write reject ở cycle 1.
  // Rồi cycle 5 PLC latch có data → phải latch giá trị thật (chưa hết budget).
  // Nếu write reject gây double-count thì budget sẽ hết sớm hơn.
  let rejectCount = 0;
  const { model, calls } = makeModel({
    rejectUpdateOneAt: (callNum) => {
      const call = calls.updateOne[callNum - 1];
      if (rejectCount >= 1) return false;
      const keys = Object.keys(call.update.$set || {});
      if (keys.some((k) => k.startsWith("hieu_suat_may"))) {
        rejectCount++;
        return true;
      }
      return false;
    },
  });
  const n = 22;
  await run(model, n, 1);
  // M1 edge: PLC latch = 0, root current hợp lệ
  await run(model, n, 2, {
    M1: true,
    D575: 0x0000, D576: 0x4108,   // 8.5A root
    D571: 0x0000, D572: 0x4140,   // 12A vong nuoc
    D668: 0, D666: 0,             // PLC latch = 0
    D216: 0, D217: 0,             // áp suất = 0
  });
  // Cycle 2-4: PLC latch vẫn 0 (write thành công sau cycle 1 reject)
  for (let i = 0; i < 3; i++) {
    await run(model, n, 2, {
      D575: 0x0000, D576: 0x4108,
      D571: 0x0000, D572: 0x4140,
      D668: 0, D666: 0,
      D216: 0, D217: 0,
    });
  }
  // Cycle 5 (budget = 5): PLC latch có data → nếu budget chưa bị double-count thì latchReads=5
  // và nenChotLatchPlc(5, 91, 100) → true (coData=true) → latch giá trị thật
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x4108,
    D571: 0x0000, D572: 0x4140,
    D668: 1, D666: 31,            // 91s
    D216: 100, D217: 0,           // áp suất
  });
  // Kiểm tra: giay_tu_start = 91, KHÔNG null
  const allWrites = hieuSuatWrites(calls);
  let lastGiay = undefined;
  for (const w of allWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.kick_root"] && set["hieu_suat_may.kick_root"].giay_tu_start !== undefined) {
      lastGiay = set["hieu_suat_may.kick_root"].giay_tu_start;
    }
    if ("hieu_suat_may.kick_root.giay_tu_start" in set) {
      lastGiay = set["hieu_suat_may.kick_root.giay_tu_start"];
    }
  }
  assert.strictEqual(lastGiay, 91,
    "PLC latch data arriving at cycle 5 must be latched as real value — write reject at cycle 1 didn't double-count budget");
});

// --- Test 12-14: M155/nhung_hang orchestration coverage ---
test("M155 rising-edge: exactly ONE updateOne for nhung_hang row", async () => {
  const { model, calls } = makeModel();
  const n = 23;
  await run(model, n, 1);
  // M1 edge trước (bắt buộc để có hieuSuatKickRoot trước khi M155)
  await run(model, n, 2, { M1: true, D575: 0x0000, D576: 0x4108, D571: 0x0000, D572: 0x4140 });
  // M155 rising edge (giai_doan_1 = true) + dòng điện hợp lệ + PLC latch có data
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x4108,   // 8.5A root
    D571: 0x0000, D572: 0x4140,   // 12A vong nuoc
    D676: 1, D674: 30,            // 90s (giay_m1_m155)
    D672: 100, D673: 0,           // áp suất nhúng hàng
  }, true);  // gd1 = true → M155 rising edge
  // Đếm writes cho nhung_hang
  const nhWrites = calls.updateOne.filter((c) => {
    const keys = Object.keys(c.update.$set || {});
    return keys.some((k) => k === "hieu_suat_may.nhung_hang" || k.startsWith("hieu_suat_may.nhung_hang."));
  });
  assert.strictEqual(nhWrites.length, 1, "exactly ONE write for nhung_hang on M155 edge cycle");
});

test("M155: latch once then fixed — cycle sau không ghi đè", async () => {
  const { model, calls } = makeModel();
  const n = 24;
  await run(model, n, 1);
  // M1 edge
  await run(model, n, 2, { M1: true, D575: 0x0000, D576: 0x4108, D571: 0x0000, D572: 0x4140 });
  // M155 edge: root = 8.5A
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x4108,
    D571: 0x0000, D572: 0x4140,
    D676: 1, D674: 30,
    D672: 100, D673: 0,
  }, true);
  // Cycle sau (M155 vẫn true): current đổi thành 25A → KHÔNG ghi đè
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x41C8,   // 25A
    D571: 0x0000, D572: 0x41C8,
  }, true);
  await run(model, n, 2, {
    D575: 0x0000, D576: 0x41C8,
    D571: 0x0000, D572: 0x41C8,
  }, true);
  // Kiểm tra: giá trị persist cuối cùng phải là 8.5, không phải 25
  const nhWrites = calls.updateOne.filter((c) => {
    const keys = Object.keys(c.update.$set || {});
    return keys.some((k) => k === "hieu_suat_may.nhung_hang" || k.startsWith("hieu_suat_may.nhung_hang."));
  });
  let lastRoot = undefined;
  for (const w of nhWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.nhung_hang"]) {
      lastRoot = set["hieu_suat_may.nhung_hang"].dong_dien_dong_co_root;
    }
    if ("hieu_suat_may.nhung_hang.dong_dien_dong_co_root" in set) {
      lastRoot = set["hieu_suat_may.nhung_hang.dong_dien_dong_co_root"];
    }
  }
  assert.strictEqual(lastRoot, 8.5, "nhung_hang root current must stay 8.5A after latch");
});

test("M155: window close latches null khi dòng điện rác suốt cap", async () => {
  const { model, calls } = makeModel();
  const n = 25;
  await run(model, n, 1);
  // M1 edge
  await run(model, n, 2, { M1: true, D575: 13107, D576: 13107, D571: 13107, D572: 13107 });
  // M155 edge: root = garbage
  await run(model, n, 2, {
    D575: 13107, D576: 13107,
    D571: 13107, D572: 13107,
    D676: 0, D674: 0,
    D672: 0, D673: 0,
  }, true);
  // 10+ cycles (garbage, still in Stage 1 = gd1 true)
  for (let i = 0; i < 10; i++) {
    await run(model, n, 2, {
      D575: 13107, D576: 13107,
      D571: 13107, D572: 13107,
    }, true);
  }
  // Window closes → must latch null
  const nhWrites = calls.updateOne.filter((c) => {
    const keys = Object.keys(c.update.$set || {});
    return keys.some((k) => k === "hieu_suat_may.nhung_hang" || k.startsWith("hieu_suat_may.nhung_hang."));
  });
  let lastRoot = undefined;
  let lastVN = undefined;
  for (const w of nhWrites) {
    const set = w.update.$set;
    if (set["hieu_suat_may.nhung_hang"]) {
      lastRoot = set["hieu_suat_may.nhung_hang"].dong_dien_dong_co_root;
      lastVN = set["hieu_suat_may.nhung_hang"].dong_dien_dong_co_vong_nuoc;
    }
    if ("hieu_suat_may.nhung_hang.dong_dien_dong_co_root" in set) {
      lastRoot = set["hieu_suat_may.nhung_hang.dong_dien_dong_co_root"];
    }
    if ("hieu_suat_may.nhung_hang.dong_dien_dong_co_vong_nuoc" in set) {
      lastVN = set["hieu_suat_may.nhung_hang.dong_dien_dong_co_vong_nuoc"];
    }
  }
  assert.strictEqual(lastRoot, null, "nhung_hang: garbage for 10 cycles → root latches null");
  assert.strictEqual(lastVN, null, "nhung_hang: garbage for 10 cycles → vong nuoc latches null");
});