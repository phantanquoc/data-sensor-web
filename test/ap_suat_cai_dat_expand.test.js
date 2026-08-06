/**
 * Kiểm chứng hàm bung cấu hình áp suất cài đặt từ dạng PHẲNG CŨ sang dạng CÓ
 * CHIỀU MÁY (backend/utils/ap_suat_cai_dat.js).
 *
 * Lý do tồn tại: đây là điểm DUY NHẤT trong hệ mà một lỗi lập trình âm thầm huỷ
 * cấu hình đang chạy thật của người vận hành. Bản trước lưu 4 giá trị dùng chung
 * cả dàn; hệ thật đã có dữ liệu nhập ở dạng đó (700/680/660/640). Nếu hàm này
 * đọc sai dạng cũ thì:
 *  - Giao diện báo "chưa cài đặt" cho cả 8 máy, KHÔNG có lỗi nào hiện ra —
 *    người vận hành chỉ thấy ô trống rồi nhập đè lên, và lần lưu đầu tiên xoá
 *    sạch cấu hình cũ (write handler $set đè cả nhánh ap_suat_cai_dat).
 *  - Hoặc null cũ bị biến thành 0 → biểu đồ vẽ đường mục tiêu ở mức 0, kéo tụt
 *    miền trục Y và bóp cả đường đo lẫn đường mục tiêu lên đỉnh.
 *  - Hoặc document ĐÃ ở dạng mới bị "bung" lần nữa → giá trị của máy 1 tràn sang
 *    cả 8 máy, mất cấu hình riêng của từng nồi.
 *
 * Hàm được require TRỰC TIẾP (không copy logic vào test) — nếu test tự dựng lại
 * logic thì nó sẽ luôn xanh kể cả khi hàm thật đã hỏng.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MOD = path.join(
  __dirname, "..", "backend", "utils", "ap_suat_cai_dat.js",
);
const {
  MACHINE_NUMBERS,
  GIAI_DOAN_AP_SUAT,
  expandApSuatCaiDat,
} = require(MOD);

/** Bộ 4 giai đoạn toàn null — hình dạng của một máy chưa cài đặt gì. */
const RONG = {
  giai_doan_1: null,
  giai_doan_2: null,
  giai_doan_3: null,
  giai_doan_4: null,
};

/** Dữ liệu THẬT người vận hành đã nhập ở dạng phẳng cũ trên hệ đang chạy. */
const PHANG_THAT = {
  giai_doan_1: 700,
  giai_doan_2: 680,
  giai_doan_3: 660,
  giai_doan_4: 640,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Bất biến chung của kết quả trả về
// ═══════════════════════════════════════════════════════════════════════════════

test("luôn trả đúng 8 máy 1..8, mỗi máy đủ 4 giai đoạn, không thừa khoá", () => {
  // Guard: read handler trả nguyên kết quả này ra REST. Thiếu một máy là giao
  // diện của nồi đó vỡ (đọc undefined.giai_doan_1), thừa khoá là client nhận
  // shape khác hợp đồng.
  for (const doc of [null, {}, { ap_suat_cai_dat: PHANG_THAT }]) {
    const out = expandApSuatCaiDat(doc);
    assert.deepEqual(
      Object.keys(out).map(Number).sort((a, b) => a - b),
      MACHINE_NUMBERS,
    );
    for (const n of MACHINE_NUMBERS) {
      assert.deepEqual(Object.keys(out[n]).sort(), [...GIAI_DOAN_AP_SUAT].sort());
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Dạng phẳng cũ CÓ GIÁ TRỊ → nở ra cả 8 máy
// ═══════════════════════════════════════════════════════════════════════════════

test("dạng phẳng cũ 700/680/660/640 → cả 8 máy đều nhận đúng 4 giá trị đó", () => {
  // Guard hồi quy quan trọng nhất của cả thay đổi: đây chính là dữ liệu thật
  // đang nằm trong database production.
  const out = expandApSuatCaiDat({ key: "cai_dat_he_thong", ap_suat_cai_dat: PHANG_THAT });
  for (const n of MACHINE_NUMBERS) {
    assert.deepEqual(out[n], PHANG_THAT, `máy ${n} phải nhận đủ cấu hình cũ`);
  }
});

test("mỗi máy nhận một OBJECT RIÊNG, không dùng chung tham chiếu", () => {
  // Guard: nếu 8 máy trỏ vào cùng một object, người dùng sửa nồi 1 trong modal
  // sẽ vô tình sửa cả 7 nồi còn lại mà không thấy gì cảnh báo.
  const out = expandApSuatCaiDat({ ap_suat_cai_dat: PHANG_THAT });
  out[1].giai_doan_1 = 999;
  assert.equal(out[2].giai_doan_1, 700, "sửa máy 1 không được ảnh hưởng máy 2");
  assert.equal(out[8].giai_doan_1, 700, "sửa máy 1 không được ảnh hưởng máy 8");
});

test("dạng phẳng cũ chỉ cài MỘT PHẦN → phần đã cài nở ra, phần trống vẫn null", () => {
  // Cài một phần là trạng thái hợp lệ: không được vì thiếu GĐ2/GĐ4 mà bỏ luôn
  // GĐ1/GĐ3 đã có giá trị.
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: { giai_doan_1: 700, giai_doan_3: 660 },
  });
  for (const n of MACHINE_NUMBERS) {
    assert.deepEqual(out[n], {
      giai_doan_1: 700,
      giai_doan_2: null,
      giai_doan_3: 660,
      giai_doan_4: null,
    });
  }
});

test("giá trị thập phân dạng phẳng cũ giữ nguyên, không làm tròn", () => {
  const out = expandApSuatCaiDat({ ap_suat_cai_dat: { ...PHANG_THAT, giai_doan_2: 680.5 } });
  for (const n of MACHINE_NUMBERS) {
    assert.equal(out[n].giai_doan_2, 680.5);
  }
});

test("0 ở dạng phẳng cũ giữ nguyên là 0, không bị hiểu thành null", () => {
  // Tầng lưu trữ coi 0 là số hợp lệ; chỉ tầng biểu đồ mới coi 0 là "không vẽ".
  // Hai tầng cố ý tách nhau nên hàm này KHÔNG được tự ý biến 0 thành null.
  const out = expandApSuatCaiDat({ ap_suat_cai_dat: { ...PHANG_THAT, giai_doan_4: 0 } });
  for (const n of MACHINE_NUMBERS) {
    assert.equal(out[n].giai_doan_4, 0, `máy ${n}: 0 phải được giữ nguyên`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. null cũ VẪN là null — tuyệt đối không thành 0
// ═══════════════════════════════════════════════════════════════════════════════

test("null ở dạng phẳng cũ nở ra vẫn là null, KHÔNG thành 0", () => {
  // Guard: đây là ranh giới sinh ra cả thay đổi này. null = "chưa cài đặt" →
  // không vẽ gì. 0 = mục tiêu 0 → vẽ đường sát đáy, kéo trục Y về 0 và bóp toàn
  // bộ dữ liệu đo lên đỉnh biểu đồ.
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: {
      giai_doan_1: null,
      giai_doan_2: null,
      giai_doan_3: null,
      giai_doan_4: null,
    },
  });
  for (const n of MACHINE_NUMBERS) {
    for (const gd of GIAI_DOAN_AP_SUAT) {
      assert.equal(out[n][gd], null, `máy ${n} ${gd} phải là null`);
      assert.notEqual(out[n][gd], 0, `máy ${n} ${gd} KHÔNG được thành 0`);
    }
  }
});

test("kiểu rác ở dạng phẳng cũ (chuỗi/NaN/Infinity/boolean/object) → null, không throw", () => {
  // Document cũ có thể lẫn kiểu lạ nếu từng bị ghi bằng tay hoặc script khác.
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: {
      giai_doan_1: "700",
      giai_doan_2: NaN,
      giai_doan_3: Infinity,
      giai_doan_4: true,
    },
  });
  for (const n of MACHINE_NUMBERS) {
    assert.deepEqual(out[n], RONG, `máy ${n}: kiểu rác phải về null hết`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Document ĐÃ ở dạng mới → trả nguyên vẹn, không đụng
// ═══════════════════════════════════════════════════════════════════════════════

test("dạng theo máy đã đủ 8 máy → trả nguyên vẹn từng giá trị riêng", () => {
  // Guard: nếu hàm "bung" lần nữa thì cấu hình riêng của từng nồi biến thành
  // giá trị của một nồi duy nhất — mất dữ liệu mà không có lỗi nào hiện ra.
  const apSuat = {};
  for (const n of MACHINE_NUMBERS) {
    apSuat[n] = {
      giai_doan_1: 700 + n,
      giai_doan_2: 680 + n,
      giai_doan_3: 660 + n,
      giai_doan_4: 640 + n,
    };
  }
  const out = expandApSuatCaiDat({ ap_suat_cai_dat: apSuat });
  for (const n of MACHINE_NUMBERS) {
    assert.deepEqual(out[n], apSuat[n], `máy ${n} phải giữ đúng cấu hình của chính nó`);
  }
});

test("khoá số máy dạng CHUỖI (Mongo trả về) được đọc như khoá số", () => {
  // Guard: Mongo/JSON luôn cho khoá chuỗi "1".."8". Nếu chỉ tra bằng khoá số
  // thì toàn bộ cấu hình đã lưu im lặng biến thành "chưa cài đặt".
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: {
      "3": { giai_doan_1: 700, giai_doan_2: 680, giai_doan_3: 660, giai_doan_4: 640 },
      "5": { giai_doan_1: 640, giai_doan_2: 620, giai_doan_3: 600, giai_doan_4: 580 },
    },
  });
  assert.equal(out[3].giai_doan_1, 700);
  assert.equal(out[5].giai_doan_1, 640, "nồi 5 không được lấy giá trị của nồi 3");
  assert.deepEqual(out[1], RONG, "máy chưa có khoá phải là 4 null");
});

test("dạng theo máy thiếu máy → chỉ bù máy thiếu bằng null, máy có giữ nguyên", () => {
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: { 2: { ...PHANG_THAT } },
  });
  assert.deepEqual(out[2], PHANG_THAT, "máy đã cài phải giữ nguyên");
  for (const n of MACHINE_NUMBERS.filter((n) => n !== 2)) {
    assert.deepEqual(out[n], RONG, `máy ${n} chưa cài phải là 4 null`);
  }
});

test("KHÔNG làm biến đổi document đầu vào (hàm thuần)", () => {
  // Guard: read handler dùng .lean() nên object đến từ Mongo; sửa tại chỗ sẽ
  // gây tác dụng phụ khó truy ở nơi khác.
  const doc = { key: "cai_dat_he_thong", ap_suat_cai_dat: { ...PHANG_THAT } };
  const truoc = JSON.stringify(doc);
  expandApSuatCaiDat(doc);
  assert.equal(JSON.stringify(doc), truoc, "đầu vào phải không đổi");
});

test("chạy lại nhiều lần cho cùng kết quả (idempotent) — bung rồi bung lại", () => {
  // Guard: read handler chạy hàm này ở MỌI lượt GET, và document dạng mới sẽ
  // được đưa vào lại chính nó. Lần hai không được khác lần một.
  const lan1 = expandApSuatCaiDat({ ap_suat_cai_dat: PHANG_THAT });
  const lan2 = expandApSuatCaiDat({ ap_suat_cai_dat: lan1 });
  assert.deepEqual(lan2, lan1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Document thiếu / rỗng → 8 máy toàn null
// ═══════════════════════════════════════════════════════════════════════════════

test("document thiếu hoặc rỗng → 8 máy toàn null, không throw", () => {
  // Guard: trạng thái "chưa ai cấu hình gì" là hợp lệ và phải trả HTTP 200 với
  // toàn null, không phải 404 và không được làm sập handler.
  const truongHop = [
    null,
    undefined,
    {},
    { key: "cai_dat_he_thong" },
    { ap_suat_cai_dat: null },
    { ap_suat_cai_dat: undefined },
    { ap_suat_cai_dat: {} },
  ];
  for (const doc of truongHop) {
    const out = expandApSuatCaiDat(doc);
    for (const n of MACHINE_NUMBERS) {
      assert.deepEqual(out[n], RONG, `${JSON.stringify(doc)} → máy ${n} phải là 4 null`);
    }
  }
});

test("đầu vào sai kiểu hoàn toàn (mảng/chuỗi/số) → 8 máy toàn null, không throw", () => {
  for (const doc of [[], [1, 2], "cai_dat", 42, true]) {
    const out = expandApSuatCaiDat(doc);
    for (const n of MACHINE_NUMBERS) {
      assert.deepEqual(out[n], RONG, `${JSON.stringify(doc)} → máy ${n} phải là 4 null`);
    }
  }
});

test("nhánh ap_suat_cai_dat là mảng hoặc giá trị vô hướng → 8 máy toàn null", () => {
  for (const apSuat of [[], [PHANG_THAT], "700", 700, true]) {
    const out = expandApSuatCaiDat({ ap_suat_cai_dat: apSuat });
    for (const n of MACHINE_NUMBERS) {
      assert.deepEqual(out[n], RONG, `ap_suat_cai_dat=${JSON.stringify(apSuat)} → máy ${n} null`);
    }
  }
});

test("một máy có giá trị rác thay vì object → máy đó về 4 null, máy khác không ảnh hưởng", () => {
  const out = expandApSuatCaiDat({
    ap_suat_cai_dat: { 1: { ...PHANG_THAT }, 2: "rác", 3: [], 4: 42 },
  });
  assert.deepEqual(out[1], PHANG_THAT);
  for (const n of [2, 3, 4]) {
    assert.deepEqual(out[n], RONG, `máy ${n} có giá trị rác phải về 4 null`);
  }
});
