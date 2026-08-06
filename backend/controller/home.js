const mongoose = require("mongoose");
const plcModels = require("../model/plc_schema");
const CaiDatHeThong = require("../model/cai_dat_he_thong_schema");
const { formatVietnamTimestamp, formatVietnamDateCode } = require("../utils/time");

const MIN_MACHINE = 1;
const MAX_MACHINE = 8;

// Mẻ chiên chân không tối đa ~4h thực tế. 8h là ngưỡng rộng rãi để phân biệt zombie.
const MAX_BATCH_DURATION_MS = 8 * 60 * 60 * 1000;

// Số phút tối thiểu để một mẻ đã dừng được coi là hoàn thành.
const MIN_COMPLETED_MINUTES = 80;

function getMachineNumber(req) {
  const n = Number.parseInt(req.query.so_noiChien, 10);
  return Number.isInteger(n) && n >= MIN_MACHINE && n <= MAX_MACHINE ? n : null;
}

function parseLegacyTimestamp(value) {
  if (!value || typeof value !== "string") return null;
  const [time, date] = value.trim().split(/\s+/);
  if (!time || !date) return null;
  const [hour, minute, second] = time.split(':').map(Number);
  const [day, month, year] = date.split('/').map(Number);
  if ([hour, minute, second, day, month, year].some(Number.isNaN)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBatchDate(doc, atField, legacyField) {
  const normalized = doc[atField] instanceof Date
    ? doc[atField]
    : doc[atField]
      ? new Date(doc[atField])
      : null;
  if (normalized && !Number.isNaN(normalized.getTime())) return normalized;
  return parseLegacyTimestamp(doc[legacyField]);
}

function parseDateFilter(value, endOfDay = false) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function displayTimestamp(doc, atField, legacyField) {
  const normalized = doc[atField] instanceof Date
    ? doc[atField]
    : doc[atField]
      ? new Date(doc[atField])
      : null;
  if (normalized && !Number.isNaN(normalized.getTime())) {
    return formatVietnamTimestamp(normalized);
  }
  return doc[legacyField] || '';
}

function temporaryBatchCode(n, doc) {
  if (typeof doc.ma_me_chien === 'string' && doc.ma_me_chien.trim()) {
    return doc.ma_me_chien.trim();
  }
  const start = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
  const datePart = start ? formatVietnamDateCode(start) : 'unknown';
  return `NC${n}-${datePart}-${String(doc._id).slice(-6).toUpperCase()}`;
}

/**
 * Compute batch status from document fields (read-time, not stored).
 * running  = batch has no stop time yet
 * completed = stopped AND tong_thoi_gian_chay >= MIN_COMPLETED_MINUTES
 * error    = stopped AND tong_thoi_gian_chay < MIN_COMPLETED_MINUTES
 */
function batchStatus(doc) {
  if (!doc.thoi_gian_stop) {
    // Zombie detection: if batch started > 8h ago and still no stop → treat as error
    const startDate = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
    if (startDate && (Date.now() - startDate.getTime() > MAX_BATCH_DURATION_MS)) {
      return 'error';
    }
    return 'running';
  }
  return (Number(doc.tong_thoi_gian_chay) || 0) >= MIN_COMPLETED_MINUTES ? 'completed' : 'error';
}

/**
 * Đếm mẻ theo trạng thái trong khoảng [from, to].
 *
 * Mẻ ĐANG CHẠY luôn được tính bất kể ngày bắt đầu: một mẻ khởi động hôm qua
 * và còn chạy sang hôm nay vẫn phải hiện ở kỳ "Ngày", nếu không dashboard báo 0
 * trong khi máy đang chạy thật. Mẻ đã kết thúc mới lọc theo ngày bắt đầu.
 *
 * @param {Array<Array<object>>} perMachine - mảng docs theo từng máy
 * @param {Date|null} from
 * @param {Date|null} to
 */
function countBatchStats(perMachine, from, to) {
  const stats = { tong: 0, hoan_thanh: 0, loi: 0, dang_chay: 0 };
  for (const docs of perMachine) {
    for (const doc of docs) {
      const status = batchStatus(doc);

      if (status !== 'running') {
        const date = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
        if (from && (!date || date < from)) continue;
        if (to && (!date || date > to)) continue;
      }

      stats.tong += 1;
      if (status === 'running') {
        stats.dang_chay += 1;
      } else if (status === 'error') {
        stats.loi += 1;
      } else {
        stats.hoan_thanh += 1;
      }
    }
  }
  return stats;
}

function toListItem(doc, n) {
  const startAt = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
  const stopAt = getBatchDate(doc, 'thoi_gian_stop_at', 'thoi_gian_stop');
  const running = !doc.thoi_gian_stop;
  return {
    _id: String(doc._id),
    ma_me_chien: temporaryBatchCode(n, doc),
    ghi_chu: doc.ghi_chu || '',
    thoi_gian_start: displayTimestamp(doc, 'thoi_gian_start_at', 'thoi_gian_start'),
    thoi_gian_stop: displayTimestamp(doc, 'thoi_gian_stop_at', 'thoi_gian_stop'),
    thoi_gian_start_at: startAt,
    thoi_gian_stop_at: stopAt,
    tong_thoi_gian_chay: Number(doc.tong_thoi_gian_chay) || 0,
    dong_ep_khoi_dong: Boolean(doc.dong_ep_khoi_dong),
    trang_thai: batchStatus(doc),
  };
}

function validateObjectId(id) {
  return typeof id === 'string' && mongoose.isValidObjectId(id);
}

exports.noi_chien = async (req, res) => {
  const n = getMachineNumber(req);
  if (!n) return res.status(400).json({ error: 'so_noiChien must be between 1 and 8' });

  const from = parseDateFilter(req.query.from);
  const to = parseDateFilter(req.query.to, true);
  if (from === undefined || to === undefined) {
    return res.status(400).json({ error: 'from/to must use YYYY-MM-DD' });
  }

  try {
    // Build Mongo query: date range filter + always include running batches
    const conditions = [];
    if (from || to) {
      const rangeFilter = {};
      if (from) rangeFilter.$gte = from;
      if (to) rangeFilter.$lte = to;
      conditions.push({ thoi_gian_start_at: rangeFilter });
      // Running batches (no stop time) always included regardless of date
      conditions.push({ thoi_gian_stop: "" });
      // Legacy docs without thoi_gian_start_at field — include and let JS filter handle them
      conditions.push({ thoi_gian_start_at: { $exists: false } });
    }

    const query = conditions.length > 0 ? { $or: conditions } : {};

    const docs = await plcModels[n]
      .find(query)
      .select('ma_me_chien ghi_chu thoi_gian_start thoi_gian_stop thoi_gian_start_at thoi_gian_stop_at tong_thoi_gian_chay dong_ep_khoi_dong')
      .sort({ thoi_gian_start_at: -1, _id: -1 })
      .lean();

    const filtered = docs.map((doc) => toListItem(doc, n));

    return res.json(filtered);
  } catch (err) {
    console.error('get_noi_chien error:', err);
    return res.status(500).json({ error: 'Không thể tải danh sách mẻ chiên' });
  }
};

// Tổng hợp thống kê mẻ chiên qua CẢ 8 máy trong khoảng [from, to].
// Chỉ select field nhẹ (không kéo bien_du_lieu) để không tải nặng Mongo.
exports.thong_ke = async (req, res) => {
  const from = parseDateFilter(req.query.from);
  const to = parseDateFilter(req.query.to, true);
  if (from === undefined || to === undefined) {
    return res.status(400).json({ error: 'from/to must use YYYY-MM-DD' });
  }

  // Tùy chọn: lọc theo 1 máy (?may=1..8). Bỏ trống = gộp cả 8 máy.
  let machineNums = Array.from({ length: MAX_MACHINE }, (_, i) => i + 1);
  if (req.query.may != null && req.query.may !== '') {
    const may = Number(req.query.may);
    if (!Number.isInteger(may) || may < MIN_MACHINE || may > MAX_MACHINE) {
      return res.status(400).json({ error: `may must be ${MIN_MACHINE}..${MAX_MACHINE}` });
    }
    machineNums = [may];
  }

  try {
    // Build Mongo query: date range + always include running batches
    const conditions = [];
    if (from || to) {
      const rangeFilter = {};
      if (from) rangeFilter.$gte = from;
      if (to) rangeFilter.$lte = to;
      conditions.push({ thoi_gian_start_at: rangeFilter });
      conditions.push({ thoi_gian_stop: "" });
      // Legacy docs without thoi_gian_start_at field — include and let JS filter handle them
      conditions.push({ thoi_gian_start_at: { $exists: false } });
    }

    const query = conditions.length > 0 ? { $or: conditions } : {};

    const perMachine = await Promise.all(
      machineNums.map((n) =>
        plcModels[n]
          .find(query)
          .select('thoi_gian_start thoi_gian_stop thoi_gian_start_at tong_thoi_gian_chay dong_ep_khoi_dong')
          .lean(),
      ),
    );

    const stats = countBatchStats(perMachine, from, to);
    return res.json(stats);
  } catch (err) {
    console.error('thong_ke error:', err);
    return res.status(500).json({ error: 'Không thể tải thống kê mẻ chiên' });
  }
};

exports.get_noi_chien_detail = async (req, res) => {
  const n = getMachineNumber(req);
  const id = req.query.id;
  if (!n) return res.status(400).json({ error: 'so_noiChien must be between 1 and 8' });
  if (!validateObjectId(id)) return res.status(400).json({ error: 'id không hợp lệ' });

  try {
    const doc = await plcModels[n].findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy mẻ chiên' });
    return res.json({
      ...doc,
      ma_me_chien: temporaryBatchCode(n, doc),
      ghi_chu: doc.ghi_chu || '',
      thoi_gian_start: displayTimestamp(doc, 'thoi_gian_start_at', 'thoi_gian_start'),
      thoi_gian_stop: displayTimestamp(doc, 'thoi_gian_stop_at', 'thoi_gian_stop'),
    });
  } catch (err) {
    console.error('get_noi_chien_detail error:', err);
    return res.status(500).json({ error: 'Không thể tải chi tiết mẻ chiên' });
  }
};

exports.sua_noi_chien_detail = async (req, res) => {
  const n = getMachineNumber(req);
  const id = req.query.id;
  if (!n) return res.status(400).json({ error: 'so_noiChien must be between 1 and 8' });
  if (!validateObjectId(id)) return res.status(400).json({ error: 'id không hợp lệ' });

  const maMeChien = typeof req.body?.ma_me_chien === 'string' ? req.body.ma_me_chien.trim() : null;
  const ghiChu = typeof req.body?.ghi_chu === 'string' ? req.body.ghi_chu.trim() : null;
  if (maMeChien === null || ghiChu === null || !maMeChien.length || maMeChien.length > 100 || ghiChu.length > 500) {
    return res.status(400).json({ error: 'Mã mẻ và ghi chú không hợp lệ' });
  }

  try {
    const duplicate = await plcModels[n].exists({ ma_me_chien: maMeChien, _id: { $ne: id } });
    if (duplicate) return res.status(409).json({ error: 'Mã mẻ đã tồn tại trên máy này' });

    const updated = await plcModels[n].findByIdAndUpdate(
      id,
      { $set: { ma_me_chien: maMeChien, ghi_chu: ghiChu } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy mẻ chiên' });
    return res.json(toListItem(updated, n));
  } catch (err) {
    console.error('sua_noi_chien_detail error:', err);
    return res.status(500).json({ error: 'Không thể sửa mẻ chiên' });
  }
};

exports.xoa_noi_chien_detail = async (req, res) => {
  const n = getMachineNumber(req);
  const id = req.query.id;
  if (!n) return res.status(400).json({ error: 'so_noiChien must be between 1 and 8' });
  if (!validateObjectId(id)) return res.status(400).json({ error: 'id không hợp lệ' });

  try {
    const doc = await plcModels[n].findById(id).select('thoi_gian_stop').lean();
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy mẻ chiên' });
    if (!doc.thoi_gian_stop) return res.status(409).json({ error: 'Không thể xóa mẻ đang chạy' });

    await plcModels[n].deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    console.error('xoa_noi_chien_detail error:', err);
    return res.status(500).json({ error: 'Không thể xóa mẻ chiên' });
  }
};

exports.batchStatus = batchStatus;
exports.countBatchStats = countBatchStats;
exports.MIN_COMPLETED_MINUTES = MIN_COMPLETED_MINUTES;

/**
 * Lightweight chart endpoint: returns only timestamp + temperature + pressure
 * per stage for a single batch document. Reduces payload size for fleet chart.
 */
exports.get_noi_chien_chart = async (req, res) => {
  const n = getMachineNumber(req);
  const id = req.query.id;
  if (!n) return res.status(400).json({ error: 'so_noiChien must be between 1 and 8' });
  if (!validateObjectId(id)) return res.status(400).json({ error: 'id không hợp lệ' });

  try {
    const doc = await plcModels[n]
      .findById(id)
      .select('thoi_gian_start thoi_gian_start_at giai_doan_1.bien_du_lieu.thoi_gian giai_doan_1.bien_du_lieu.nhiet_do giai_doan_1.bien_du_lieu.ap_suat_chan_khong giai_doan_2.bien_du_lieu.thoi_gian giai_doan_2.bien_du_lieu.nhiet_do giai_doan_2.bien_du_lieu.ap_suat_chan_khong giai_doan_3.bien_du_lieu.thoi_gian giai_doan_3.bien_du_lieu.nhiet_do giai_doan_3.bien_du_lieu.ap_suat_chan_khong giai_doan_4.bien_du_lieu.thoi_gian giai_doan_4.bien_du_lieu.nhiet_do giai_doan_4.bien_du_lieu.ap_suat_chan_khong')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy mẻ chiên' });
    return res.json({
      thoi_gian_start: doc.thoi_gian_start,
      thoi_gian_start_at: doc.thoi_gian_start_at,
      giai_doan_1: { bien_du_lieu: doc.giai_doan_1?.bien_du_lieu ?? [] },
      giai_doan_2: { bien_du_lieu: doc.giai_doan_2?.bien_du_lieu ?? [] },
      giai_doan_3: { bien_du_lieu: doc.giai_doan_3?.bien_du_lieu ?? [] },
      giai_doan_4: { bien_du_lieu: doc.giai_doan_4?.bien_du_lieu ?? [] },
    });
  } catch (err) {
    console.error('get_noi_chien_chart error:', err);
    return res.status(500).json({ error: 'Không thể tải dữ liệu biểu đồ' });
  }
};

// Khoá cố định của document cấu hình singleton — mọi truy vấn đọc/ghi đều lọc
// theo key này nên chỉ tồn tại đúng một bản cấu hình cho cả dàn.
const CAU_HINH_KEY = 'cai_dat_he_thong';

// Dùng lại hằng số và hàm bung dạng cũ từ utils: expandApSuatCaiDat là HÀM THUẦN
// nên test được độc lập, và đây là điểm duy nhất hiểu được document dạng phẳng cũ.
const {
  MACHINE_NUMBERS,
  GIAI_DOAN_AP_SUAT,
  expandApSuatCaiDat,
} = require('../utils/ap_suat_cai_dat');

/**
 * Chuẩn hoá một giá trị áp suất cài đặt do client gửi lên.
 *
 * Chấp nhận: null/undefined/chuỗi rỗng (nghĩa là "chưa cài đặt") và số hữu hạn >= 0.
 * Chấp nhận 0 vì 0 là một con số hợp lệ về mặt dữ liệu — việc 0 không vẽ đường
 * là quyết định của tầng biểu đồ, chặn ở API sẽ thành lỗi khó hiểu cho người dùng.
 * Từ chối: số âm, NaN, Infinity, chuỗi không phải số, boolean, object.
 *
 * @returns {{ ok: true, value: number|null } | { ok: false }}
 */
function parseApSuatCaiDat(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  // Chặn boolean/array/object trước vì Number(true) = 1 và Number([]) = 0 sẽ lọt lưới.
  if (typeof raw !== 'number' && typeof raw !== 'string') return { ok: false };
  if (typeof raw === 'string' && raw.trim() === '') return { ok: true, value: null };
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return { ok: false };
  return { ok: true, value: num };
}

/**
 * Đảm bảo response luôn có đủ 8 máy × 4 giai đoạn, và bung document dạng phẳng
 * cũ (4 giá trị dùng chung cả dàn) ra cho cả 8 máy.
 */
function toApSuatCaiDat(doc) {
  return expandApSuatCaiDat(doc);
}

exports.get_cai_dat_he_thong = async (req, res) => {
  try {
    const doc = await CaiDatHeThong.findOne({ key: CAU_HINH_KEY }).lean();
    // Trả 200 với toàn bộ giá trị null thay vì 404: "chưa cấu hình" là trạng thái
    // hợp lệ mà UI phải hiển thị thành ô trống, không phải lỗi.
    return res.json({ ap_suat_cai_dat: toApSuatCaiDat(doc) });
  } catch (err) {
    console.error('get_cai_dat_he_thong error:', err);
    return res.status(500).json({ error: 'Không thể tải cài đặt hệ thống' });
  }
};

/** Nhãn tiếng Việt của giai đoạn để thông báo lỗi chỉ đúng ô người dùng nhập sai. */
function nhanGiaiDoan(gd) {
  return `giai đoạn ${gd.replace('giai_doan_', '')}`;
}

exports.sua_cai_dat_he_thong = async (req, res) => {
  const body = req.body?.ap_suat_cai_dat;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Thiếu dữ liệu áp suất cài đặt' });
  }

  // Chặn số máy ngoài 1..8 trước khi xét giá trị: một khoá lạ nghĩa là client
  // đang gửi shape khác, ghi tiếp sẽ tạo dữ liệu không ai đọc được.
  for (const key of Object.keys(body)) {
    const n = Number(key);
    if (!Number.isInteger(n) || !MACHINE_NUMBERS.includes(n)) {
      return res.status(400).json({ error: `Số máy ${key} không hợp lệ (chỉ nhận 1 đến 8)` });
    }
  }

  // Validate TRỌN VẸN cả 32 giá trị trước khi ghi: chỉ cần một giá trị sai là
  // không ghi gì cả, tránh lưu nửa dàn khiến người dùng tưởng đã lưu xong.
  const values = {};
  for (const n of MACHINE_NUMBERS) {
    const raw = body[n] ?? body[String(n)];
    if (raw !== null && raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) {
      return res.status(400).json({ error: `Dữ liệu áp suất cài đặt của máy ${n} không hợp lệ` });
    }
    const perMay = {};
    for (const gd of GIAI_DOAN_AP_SUAT) {
      const parsed = parseApSuatCaiDat(raw ? raw[gd] : null);
      if (!parsed.ok) {
        return res.status(400).json({
          error: `Áp suất cài đặt máy ${n} ${nhanGiaiDoan(gd)} phải là số không âm hoặc để trống`,
        });
      }
      perMay[gd] = parsed.value;
    }
    values[n] = perMay;
  }

  try {
    const updated = await CaiDatHeThong.findOneAndUpdate(
      { key: CAU_HINH_KEY },
      // Ghi đè cả nhánh ap_suat_cai_dat để document dạng phẳng cũ biến mất hẳn
      // sau lần lưu đầu tiên, không còn lẫn hai shape trong cùng một document.
      { $set: { ap_suat_cai_dat: values } },
      // upsert: lần lưu đầu tiên tự tạo document nên không cần bước seed/migration.
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ap_suat_cai_dat: toApSuatCaiDat(updated) });
  } catch (err) {
    console.error('sua_cai_dat_he_thong error:', err);
    return res.status(500).json({ error: 'Không thể lưu cài đặt hệ thống' });
  }
};
