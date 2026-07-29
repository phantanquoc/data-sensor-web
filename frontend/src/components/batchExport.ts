/**
 * Xuất dữ liệu một mẻ chiên ra file bảng tính, không cần thư viện ngoài.
 *
 * Hai định dạng, cùng đuôi `.csv`:
 *   `excel` — cho Excel trên Windows tiếng Việt: có BOM, dòng `sep=;` và dấu
 *             phẩy thập phân, nên mở lên là tách cột và đọc số đúng ngay.
 *   `csv`   — CSV chuẩn: phẩy phân tách, dấu chấm thập phân, không BOM. Dùng
 *             cho Google Sheets, Python/R hoặc công cụ BI.
 */
import type {
  BatchDocument,
  BatchListItem,
  BienDuLieuEntry,
  HieuSuatMaySnapshot,
  SensorData,
} from '../types';
import { parseTs } from '../hooks/timeUtils';

export type ExportFormat = 'excel' | 'csv';

export interface BatchExportMeta {
  soNoiChien: number;
  trangThai?: BatchListItem['trang_thai'];
}

type Cell = string | number | null;
type Row = Cell[];

interface Dialect {
  delimiter: string;
  decimalComma: boolean;
  bom: boolean;
  sepHint: boolean;
  /** Chặn Excel diễn giải ô mở đầu bằng `= + - @` thành công thức */
  escapeFormula: boolean;
}

/** Excel trên Windows cần BOM để nhận UTF-8, nếu không tiếng Việt ra ký tự lạ. */
const BOM = '\ufeff';

const DIALECTS: Record<ExportFormat, Dialect> = {
  excel: { delimiter: ';', decimalComma: true, bom: true, sepHint: true, escapeFormula: true },
  csv: { delimiter: ',', decimalComma: false, bom: false, sepHint: false, escapeFormula: false },
};

const STATUS_LABELS: Record<string, string> = {
  running: 'Đang chạy',
  completed: 'Hoàn thành',
  error: 'Lỗi',
};

const STAGE_LABELS = ['Giai đoạn 1', 'Giai đoạn 2', 'Giai đoạn 3', 'Giai đoạn 4'];

/** 10 cảm biến, nhãn khớp với SensorGrid/BatchDetail để người đọc file nhận ra ngay. */
const SENSOR_COLUMNS: Array<{ key: keyof SensorData; label: string }> = [
  { key: 'nhiet_do', label: 'Nhiệt độ chiên' },
  { key: 'nhiet_do_vao_binh_sinh_han', label: 'Nhiệt độ vào bình sinh hàn' },
  { key: 'nhiet_do_ra_binh_sinh_han', label: 'Nhiệt độ ra bình sinh hàn' },
  { key: 'nhiet_do_vao_bom_vong_nuoc', label: 'Nhiệt độ vào động cơ vòng nước' },
  { key: 'nhiet_do_ra_bom_vong_nuoc', label: 'Nhiệt độ ra động cơ vòng nước' },
  { key: 'ap_suat_vo_hoi', label: 'Áp suất vỏ hơi' },
  { key: 'ap_suat_chan_khong', label: 'Áp suất chân không' },
  { key: 'ap_suat_vong_nuoc', label: 'Áp suất vòng nước' },
  { key: 'dong_dien_dong_co_root', label: 'Dòng điện động cơ Root' },
  { key: 'dong_dien_dong_co_vong_nuoc', label: 'Dòng điện động cơ vòng nước' },
];

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Chỉ giữ mẫu có thời gian đọc được — cùng quy tắc với BatchDetail. */
function validSamples(entries: BienDuLieuEntry[] | undefined): BienDuLieuEntry[] {
  return (Array.isArray(entries) ? entries : []).filter((entry) => parseTs(entry.thoi_gian) !== null);
}

function durationText(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)} phút ${totalSeconds % 60} giây`;
}

function stageSpanMs(samples: BienDuLieuEntry[]): number | null {
  if (samples.length < 2) return null;
  const first = parseTs(samples[0].thoi_gian)?.getTime();
  const last = parseTs(samples[samples.length - 1].thoi_gian)?.getTime();
  return first != null && last != null ? last - first : null;
}

/** Thống kê một cảm biến trên cả giai đoạn: đầu / thấp nhất / cao nhất / trung bình. */
function stats(samples: BienDuLieuEntry[], key: keyof SensorData) {
  const values = samples
    .map((entry) => num(entry[key as string]))
    .filter((value): value is number => value !== null);
  if (!values.length) return { start: null, min: null, max: null, avg: null };
  return {
    start: values[0],
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

/** Số giây từ lúc mẻ bắt đầu tới mốc `stamp` — để vẽ lại đường nhiệt độ theo trục thời gian. */
function secondsFromStart(startMs: number | null, stamp: string | undefined): number | null {
  if (startMs === null) return null;
  const at = parseTs(stamp)?.getTime();
  return at == null ? null : Math.round((at - startMs) / 1000);
}

function buildRows(batch: BatchDocument, meta: BatchExportMeta): Row[] {
  const stages = [batch.giai_doan_1, batch.giai_doan_2, batch.giai_doan_3, batch.giai_doan_4];
  const perStageSamples = stages.map((stage) => validSamples(stage?.bien_du_lieu));
  const startMs = parseTs(batch.thoi_gian_start)?.getTime() ?? null;
  const rows: Row[] = [];

  // ---- 1. Thông tin mẻ ----
  rows.push(['THÔNG TIN MẺ CHIÊN']);
  rows.push(['Mã mẻ', batch.ma_me_chien || '']);
  rows.push(['Hệ chiên', `Hệ chiên ${meta.soNoiChien}`]);
  rows.push(['Bắt đầu', batch.thoi_gian_start || '']);
  rows.push(['Kết thúc', batch.thoi_gian_stop || 'Đang chạy']);
  rows.push(['Thời gian hoàn thành (phút)', num(batch.tong_thoi_gian_chay) ?? 0]);
  rows.push(['Trạng thái', STATUS_LABELS[meta.trangThai ?? 'completed'] ?? '']);
  rows.push(['Ghi chú', batch.ghi_chu || '']);
  rows.push(['Xuất lúc', new Date().toLocaleString('vi-VN')]);
  rows.push([]);

  // ---- 2. Hiệu suất máy (2 mốc chụp, nếu có) ----
  const perfRows: Array<{ label: string; snap: HieuSuatMaySnapshot | null | undefined }> = [
    { label: 'Bắt đầu kick root (M1)', snap: batch.hieu_suat_may?.kick_root },
    { label: 'Bắt đầu nhúng hàng (M155)', snap: batch.hieu_suat_may?.nhung_hang },
  ];
  if (perfRows.some((row) => !!row.snap)) {
    rows.push(['HIỆU SUẤT MÁY']);
    rows.push(['Mốc', 'Thời điểm', 'Giây từ lúc bắt đầu mẻ', ...SENSOR_COLUMNS.map((c) => c.label)]);
    for (const { label, snap } of perfRows) {
      if (!snap) continue;
      rows.push([
        label,
        snap.thoi_gian || '',
        num(snap.giay_tu_start),
        ...SENSOR_COLUMNS.map((column) => num(snap[column.key])),
      ]);
    }
    rows.push([]);
  }

  // ---- 3. Thông số cài đặt từng giai đoạn ----
  rows.push(['THÔNG SỐ CÀI ĐẶT THEO GIAI ĐOẠN']);
  rows.push([
    'Giai đoạn',
    'Thời gian chạy (phút)',
    'Số lần nhúng (lần)',
    'Thời gian nhúng (S)',
    'Thời gian lặp lại (phút)',
    'Nhiệt độ cài đặt (độ C)',
    'Vị trí dừng',
  ]);
  stages.forEach((stage, index) => {
    const raw = (stage || {}) as Record<string, unknown>;
    const runMinutes = index === 3
      ? num(raw.thoi_gian_treo_long_gd_4 ?? raw.thoi_gian_treo_long)
      : num(raw.thoi_gian_chay);
    rows.push([
      STAGE_LABELS[index],
      runMinutes,
      index === 3 ? null : num(raw.so_lan_nhung),
      index === 3 ? null : num(raw.thoi_gian_nhung),
      index === 3 ? null : num(raw.thoi_gian_lap_lai),
      index === 3 ? null : num(raw.nhiet_do_cai_dat),
      index === 3 ? null : (raw.vi_tri_dung == null ? null : String(raw.vi_tri_dung)),
    ]);
  });
  rows.push([]);

  // ---- 4. Tổng hợp cảm biến: đầu / thấp nhất / cao nhất / trung bình ----
  rows.push(['TỔNG HỢP CẢM BIẾN THEO GIAI ĐOẠN']);
  rows.push(['Giai đoạn', 'Số mẫu', 'Thời gian chạy thực tế', 'Thông số', 'Bắt đầu', 'Thấp nhất', 'Cao nhất', 'Trung bình']);
  perStageSamples.forEach((samples, index) => {
    const span = durationText(stageSpanMs(samples));
    SENSOR_COLUMNS.forEach((column, columnIndex) => {
      const { start, min, max, avg } = stats(samples, column.key);
      rows.push([
        columnIndex === 0 ? STAGE_LABELS[index] : '',
        columnIndex === 0 ? samples.length : '',
        columnIndex === 0 ? span : '',
        column.label,
        start,
        min,
        max,
        avg === null ? null : Number(avg.toFixed(2)),
      ]);
    });
  });
  rows.push([]);

  // ---- 5. Dữ liệu chi tiết: một dòng cho mỗi mẫu đo ----
  rows.push(['DỮ LIỆU CHI TIẾT THEO MẪU ĐO']);
  rows.push([
    'Giai đoạn',
    'Thời gian',
    'Giây từ lúc bắt đầu mẻ',
    ...SENSOR_COLUMNS.map((column) => column.label),
    'Nhiệt độ cài đặt (độ C)',
    'Số lần nhúng (lần)',
    'Thời gian nhúng (S)',
    'Thời gian lặp lại (phút)',
    'Vị trí dừng',
  ]);
  perStageSamples.forEach((samples, index) => {
    for (const entry of samples) {
      rows.push([
        STAGE_LABELS[index],
        entry.thoi_gian || '',
        secondsFromStart(startMs, entry.thoi_gian),
        ...SENSOR_COLUMNS.map((column) => num(entry[column.key as string])),
        num(entry.nhiet_do_cai_dat),
        num(entry.so_lan_nhung),
        num(entry.thoi_gian_nhung),
        num(entry.thoi_gian_lap_lai),
        entry.vi_tri_dung == null ? null : String(entry.vi_tri_dung),
      ]);
    }
  });

  return rows;
}

function formatCell(value: Cell, dialect: Dialect): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const text = String(value);
    return dialect.decimalComma ? text.replace('.', ',') : text;
  }

  let text = value;
  // Ô mở đầu bằng = + - @ bị Excel coi là công thức → thêm ' để buộc dạng văn bản.
  if (dialect.escapeFormula && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return text.includes(dialect.delimiter) || /["\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function serialize(rows: Row[], format: ExportFormat): string {
  const dialect = DIALECTS[format];
  const body = rows
    .map((row) => row.map((cell) => formatCell(cell, dialect)).join(dialect.delimiter))
    .join('\r\n');
  // `sep=;` phải là dòng đầu tiên để Excel đọc được, đứng sau BOM.
  const head = `${dialect.bom ? BOM : ''}${dialect.sepHint ? `sep=${dialect.delimiter}\r\n` : ''}`;
  return `${head}${body}\r\n`;
}

/** Bỏ ký tự Windows không cho phép trong tên file, giữ nguyên tiếng Việt. */
function safeFileName(code: string, soNoiChien: number, format: ExportFormat): string {
  const base = (code || `he-chien-${soNoiChien}`)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80) || `he-chien-${soNoiChien}`;
  return format === 'excel' ? `${base}_excel.csv` : `${base}.csv`;
}

/** Dựng file cho một mẻ rồi kích hoạt tải về trên trình duyệt. */
export function downloadBatchSheet(
  batch: BatchDocument,
  meta: BatchExportMeta,
  format: ExportFormat,
): void {
  const content = serialize(buildRows(batch, meta), format);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName(batch.ma_me_chien, meta.soNoiChien, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Thu hồi ở tick sau để Firefox/Safari kịp bắt đầu tải.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const __testables = { buildRows, serialize, safeFileName };
