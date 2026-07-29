/**
 * Test bộ xuất file mẻ chiên. Node chạy TS trực tiếp qua
 * --experimental-strip-types (đã bật trong npm script test).
 *
 * Trọng tâm: đúng số liệu (không lệch mẫu, không mất mẻ) và đúng phương ngữ CSV
 * để Excel tiếng Việt mở lên không vỡ cột / vỡ số.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { register } = require("node:module");

// batchExport.ts import '../hooks/timeUtils' (không có extension) — Node
// --experimental-strip-types yêu cầu extension tường minh. Cùng hook resolve
// như setpoint_builder.test.js: chỉ thêm .ts cho relative path không extension
// và chỉ khi file tồn tại.
register("data:text/javascript," + encodeURIComponent(`
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : '';
    const dir = path.dirname(parentPath);
    const candidate = path.join(dir, specifier + '.ts');
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`));

const MOD = path.join(__dirname, "..", "frontend", "src", "components", "batchExport.ts");
const { __testables } = require(MOD);
const { buildRows, serialize, safeFileName } = __testables;

/** Một mẫu đo đầy đủ 10 cảm biến. */
function mkEntry(time, over = {}) {
  return {
    thoi_gian: time,
    ap_suat_vo_hoi: 1,
    ap_suat_chan_khong: 2,
    ap_suat_vong_nuoc: 3,
    nhiet_do: 90,
    dong_dien_dong_co_root: 5,
    dong_dien_dong_co_vong_nuoc: 6,
    nhiet_do_vao_binh_sinh_han: 7,
    nhiet_do_ra_binh_sinh_han: 8,
    nhiet_do_vao_bom_vong_nuoc: 9,
    nhiet_do_ra_bom_vong_nuoc: 10,
    so_lan_nhung: 2,
    thoi_gian_nhung: 30,
    thoi_gian_lap_lai: 4,
    nhiet_do_cai_dat: 95,
    vi_tri_dung: "12",
    ...over,
  };
}

function mkStage(entries, over = {}) {
  return {
    thoi_gian_chay: 30,
    so_lan_nhung: 2,
    thoi_gian_nhung: 30,
    thoi_gian_lap_lai: 4,
    nhiet_do_cai_dat: 95,
    vi_tri_dung: "12",
    bien_du_lieu: entries,
    ...over,
  };
}

function mkBatch(over = {}) {
  return {
    _id: "abc123456789",
    ma_me_chien: "NC1-20260729-E41701",
    ghi_chu: "",
    thoi_gian_start: "06:14:11 29/7/2026",
    thoi_gian_stop: "07:51:07 29/7/2026",
    tong_thoi_gian_chay: 95,
    giai_doan_1: mkStage([mkEntry("06:14:11 29/7/2026"), mkEntry("06:15:11 29/7/2026", { nhiet_do: 100 })]),
    giai_doan_2: mkStage([mkEntry("06:20:11 29/7/2026")]),
    giai_doan_3: mkStage([]),
    giai_doan_4: mkStage([mkEntry("07:00:11 29/7/2026")], { thoi_gian_treo_long: 12 }),
    ...over,
  };
}

const META = { soNoiChien: 1, trangThai: "completed" };

/** Tìm chỉ số dòng tiêu đề của một khối. */
function sectionIndex(rows, title) {
  return rows.findIndex((row) => row[0] === title);
}

test("giữ đủ mọi mẫu đo của mọi giai đoạn, không mất dòng", () => {
  const rows = buildRows(mkBatch(), META);
  const start = sectionIndex(rows, "DỮ LIỆU CHI TIẾT THEO MẪU ĐO");
  assert.ok(start > 0, "phải có khối dữ liệu chi tiết");
  // +1 tiêu đề khối, +1 dòng header cột
  const dataRows = rows.slice(start + 2);
  // 2 mẫu GĐ1 + 1 GĐ2 + 0 GĐ3 + 1 GĐ4 = 4
  assert.equal(dataRows.length, 4);
  assert.deepEqual(
    dataRows.map((row) => row[0]),
    ["Giai đoạn 1", "Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 4"],
  );
});

test("bỏ mẫu có thời gian không đọc được, giống BatchDetail", () => {
  const batch = mkBatch({
    giai_doan_1: mkStage([mkEntry("06:14:11 29/7/2026"), mkEntry("rác"), mkEntry("")]),
  });
  const rows = buildRows(batch, META);
  const start = sectionIndex(rows, "DỮ LIỆU CHI TIẾT THEO MẪU ĐO");
  const gd1 = rows.slice(start + 2).filter((row) => row[0] === "Giai đoạn 1");
  assert.equal(gd1.length, 1);
});

test("giây từ lúc bắt đầu mẻ tính theo mốc start của mẻ", () => {
  const rows = buildRows(mkBatch(), META);
  const start = sectionIndex(rows, "DỮ LIỆU CHI TIẾT THEO MẪU ĐO");
  const first = rows[start + 2];
  const second = rows[start + 3];
  assert.equal(first[2], 0, "mẫu đầu trùng mốc start → 0 giây");
  assert.equal(second[2], 60, "mẫu sau 1 phút → 60 giây");
});

test("tổng hợp cảm biến: đầu/thấp/cao/trung bình đúng trên nhiều mẫu", () => {
  const rows = buildRows(mkBatch(), META);
  const start = sectionIndex(rows, "TỔNG HỢP CẢM BIẾN THEO GIAI ĐOẠN");
  // Dòng đầu của GĐ1 là cảm biến "Nhiệt độ chiên": 90 rồi 100
  const row = rows[start + 2];
  assert.equal(row[0], "Giai đoạn 1");
  assert.equal(row[1], 2, "số mẫu");
  assert.equal(row[3], "Nhiệt độ chiên");
  assert.equal(row[4], 90, "bắt đầu");
  assert.equal(row[5], 90, "thấp nhất");
  assert.equal(row[6], 100, "cao nhất");
  assert.equal(row[7], 95, "trung bình");
});

test("giai đoạn rỗng vẫn có dòng tổng hợp nhưng giá trị trống", () => {
  const rows = buildRows(mkBatch(), META);
  const start = sectionIndex(rows, "TỔNG HỢP CẢM BIẾN THEO GIAI ĐOẠN");
  const gd3 = rows.slice(start + 2).find((row) => row[0] === "Giai đoạn 3");
  assert.ok(gd3, "GĐ3 rỗng vẫn phải xuất hiện");
  assert.equal(gd3[1], 0, "0 mẫu");
  assert.equal(gd3[4], null, "không có giá trị bắt đầu");
});

test("giai đoạn 4 dùng thời gian treo lòng, không có thông số nhúng", () => {
  const rows = buildRows(mkBatch(), META);
  const start = sectionIndex(rows, "THÔNG SỐ CÀI ĐẶT THEO GIAI ĐOẠN");
  const gd4 = rows.slice(start + 2).find((row) => row[0] === "Giai đoạn 4");
  assert.equal(gd4[1], 12, "thời gian treo lòng");
  assert.equal(gd4[2], null, "GĐ4 không có số lần nhúng");
});

test("mẻ đang chạy ghi 'Đang chạy' thay cho ô kết thúc trống", () => {
  const rows = buildRows(mkBatch({ thoi_gian_stop: "" }), { soNoiChien: 1, trangThai: "running" });
  const stop = rows.find((row) => row[0] === "Kết thúc");
  const status = rows.find((row) => row[0] === "Trạng thái");
  assert.equal(stop[1], "Đang chạy");
  assert.equal(status[1], "Đang chạy");
});

test("hiệu suất máy chỉ xuất hiện khi có mốc chụp", () => {
  const without = buildRows(mkBatch(), META);
  assert.equal(sectionIndex(without, "HIỆU SUẤT MÁY"), -1);

  const withPerf = buildRows(
    mkBatch({ hieu_suat_may: { kick_root: { thoi_gian: "06:14:20 29/7/2026", giay_tu_start: 9, nhiet_do: 88 } } }),
    META,
  );
  const start = sectionIndex(withPerf, "HIỆU SUẤT MÁY");
  assert.ok(start > 0);
  const row = withPerf[start + 2];
  assert.equal(row[0], "Bắt đầu kick root (M1)");
  assert.equal(row[2], 9, "giây từ lúc bắt đầu mẻ");
});

test("phương ngữ excel: có BOM, sep=; và phẩy thập phân", () => {
  const text = serialize([["Nhiệt độ", 12.5]], "excel");
  assert.ok(text.startsWith("﻿"), "phải có BOM cho Excel đọc UTF-8");
  assert.ok(text.includes("sep=;\r\n"), "phải khai báo dấu phân tách");
  assert.ok(text.includes("12,5"), "Excel VN dùng phẩy thập phân");
});

test("phương ngữ csv: không BOM, phẩy phân tách, chấm thập phân", () => {
  const text = serialize([["Nhiệt độ", 12.5]], "csv");
  assert.ok(!text.startsWith("﻿"));
  assert.ok(!text.includes("sep="));
  assert.ok(text.includes("12.5"));
  assert.ok(text.includes("Nhiệt độ,12.5"));
});

test("ô chứa dấu phân tách hoặc nháy được bọc đúng", () => {
  assert.ok(serialize([["a;b"]], "excel").includes('"a;b"'));
  assert.ok(serialize([['nói "xin chào"']], "csv").includes('"nói ""xin chào"""'));
  // Dấu ; không phải delimiter của csv chuẩn nên không cần bọc
  assert.ok(serialize([["a;b"]], "csv").includes("a;b\r\n"));
});

test("chặn injection công thức khi mở bằng Excel", () => {
  const text = serialize([["=CMD()"]], "excel");
  assert.ok(text.includes("'=CMD()"), "ô công thức phải bị vô hiệu");
  // CSV chuẩn dùng cho máy đọc, giữ nguyên giá trị gốc
  assert.ok(serialize([["=CMD()"]], "csv").includes("=CMD()"));
});

test("ô trống và số không hợp lệ ghi rỗng, không ghi null/NaN", () => {
  const text = serialize([[null, Number.NaN, ""]], "csv");
  const line = text.trim();
  assert.equal(line, ",,");
});

test("tên file bỏ ký tự Windows cấm và phân biệt hai định dạng", () => {
  assert.equal(safeFileName("NC1-20260729-E41701", 1, "csv"), "NC1-20260729-E41701.csv");
  assert.equal(safeFileName("NC1-20260729-E41701", 1, "excel"), "NC1-20260729-E41701_excel.csv");
  assert.equal(safeFileName("a/b:c*d?", 2, "csv"), "a-b-c-d-.csv");
  assert.equal(safeFileName("", 3, "csv"), "he-chien-3.csv", "mẻ chưa có mã vẫn ra tên hợp lệ");
});
