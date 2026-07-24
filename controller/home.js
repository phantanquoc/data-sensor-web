const mongoose = require("mongoose");
const plcModels = require("../model/plc_schema");
const { formatVietnamTimestamp, formatVietnamDateCode } = require("../utils/time");

const MIN_MACHINE = 1;
const MAX_MACHINE = 8;

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
 * completed = stopped AND tong_thoi_gian_chay >= 85
 * error    = stopped AND tong_thoi_gian_chay < 85
 */
function batchStatus(doc) {
  if (!doc.thoi_gian_stop) return 'running';
  return (Number(doc.tong_thoi_gian_chay) || 0) >= 85 ? 'completed' : 'error';
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
    const docs = await plcModels[n]
      .find()
      .select('ma_me_chien ghi_chu thoi_gian_start thoi_gian_stop thoi_gian_start_at thoi_gian_stop_at tong_thoi_gian_chay dong_ep_khoi_dong')
      .lean();

    const filtered = docs
      .filter((doc) => {
        const date = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
        if (from && (!date || date < from)) return false;
        if (to && (!date || date > to)) return false;
        return true;
      })
      .sort((a, b) => {
        const aDate = getBatchDate(a, 'thoi_gian_start_at', 'thoi_gian_start')?.getTime() ?? 0;
        const bDate = getBatchDate(b, 'thoi_gian_start_at', 'thoi_gian_start')?.getTime() ?? 0;
        return bDate - aDate || String(b._id).localeCompare(String(a._id));
      })
      .map((doc) => toListItem(doc, n));

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
    const perMachine = await Promise.all(
      machineNums.map((n) =>
        plcModels[n]
          .find()
          .select('thoi_gian_start thoi_gian_stop thoi_gian_start_at tong_thoi_gian_chay dong_ep_khoi_dong')
          .lean(),
      ),
    );

    const stats = { tong: 0, hoan_thanh: 0, loi: 0, dang_chay: 0 };
    for (const docs of perMachine) {
      for (const doc of docs) {
        const date = getBatchDate(doc, 'thoi_gian_start_at', 'thoi_gian_start');
        if (from && (!date || date < from)) continue;
        if (to && (!date || date > to)) continue;

        stats.tong += 1;
        const status = batchStatus(doc);
        if (status === 'running') {
          stats.dang_chay += 1;
        } else if (status === 'error') {
          stats.loi += 1;
        } else {
          stats.hoan_thanh += 1;
        }
      }
    }

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
