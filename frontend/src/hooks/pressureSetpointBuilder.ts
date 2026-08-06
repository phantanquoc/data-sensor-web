/**
 * Dựng ChartPoint[] cho đường áp suất chân không mục tiêu của MỘT nồi cụ thể —
 * tách khỏi useFleetHistory để test được không cần React/socket.
 *
 * Khác với nhiệt độ: PLC KHÔNG có thanh ghi áp suất cài đặt, nên giá trị mục
 * tiêu đến từ cấu hình người vận hành nhập tay, và mỗi nồi có bộ giá trị riêng.
 *
 * Quy tắc nghiệp vụ:
 *  - Cấu hình tra theo SỐ MÁY: nồi 3 không bao giờ được lấy mục tiêu của nồi 5,
 *    vì đó là một mức tham chiếu sai mà người xem không có cách nào phát hiện.
 *  - Số máy ngoài 1..8 = không có nồi đó → trả rỗng thay vì đoán.
 *  - Đủ 4 giai đoạn (nhiệt độ chỉ 1-3): post_data_plc.js có ghi
 *    ap_suat_chan_khong vào giai đoạn 4 nên GĐ4 vẫn có dữ liệu đo. Thiếu GĐ4 thì
 *    đường mục tiêu đứt giữa chừng, người xem đọc nhầm thành mất dữ liệu.
 *  - Giá trị 0 / null / undefined / NaN / Infinity = CHƯA CÀI ĐẶT → không vẽ.
 *    Riêng 0: vẽ đường 0 sẽ kéo miền trục Y xuống tận 0 và bóp cả hai đường lên
 *    đỉnh biểu đồ (cùng lý do đã ghi trong test/setpoint_builder.test.js).
 *  - Điểm mục tiêu suy ra từ CHÍNH điểm đo, không dựng lưới thời gian riêng: nhờ
 *    vậy trục X của hai đường trùng khít nhau và tự thừa hưởng giới hạn
 *    MAX_POINTS đã áp cho mảng đo. Điểm lặp lại không tốn gì vì buildMerged ghi
 *    cột setpoint bằng findExactOrLastBefore và Recharts vẽ stepAfter.
 */

/** Cấu hình áp suất mục tiêu theo giai đoạn của MỘT nồi. */
export interface ApSuatCaiDatMayConfig {
  giai_doan_1?: number | null;
  giai_doan_2?: number | null;
  giai_doan_3?: number | null;
  giai_doan_4?: number | null;
}

/** Cấu hình cả dàn, khoá là số nồi 1..8 (1-based như mọi định danh khác trong hệ). */
export type ApSuatCaiDatConfig = Record<number | string, ApSuatCaiDatMayConfig | null | undefined>;

/** Cùng hình dạng với ChartPoint của useFleetHistory (khai báo lại để module thuần). */
export interface PressureSetpointPoint {
  /** Minutes elapsed since batch start (X axis) */
  phut: number;
  /** Target pressure value (Y axis) */
  value: number;
  /** Stage 1-4 */
  stage: 1 | 2 | 3 | 4;
}

const STAGE_KEYS = [
  'giai_doan_1',
  'giai_doan_2',
  'giai_doan_3',
  'giai_doan_4',
] as const;

/** Số nồi hợp lệ — khớp noi_chien_1..8. */
export const MIN_MACHINE = 1;
export const MAX_MACHINE = 8;

export function isValidMachineNumber(may: unknown): may is number {
  return (
    typeof may === 'number' &&
    Number.isInteger(may) &&
    may >= MIN_MACHINE &&
    may <= MAX_MACHINE
  );
}

/**
 * Lấy cấu hình của đúng một nồi. Trả null khi số máy ngoài 1..8 hoặc nồi đó
 * chưa có nhánh cấu hình — không rơi về giá trị của nồi khác.
 *
 * Chấp nhận cả khoá số và khoá chuỗi vì JSON từ REST luôn trả khoá chuỗi.
 */
export function machinePressureConfig(
  config: ApSuatCaiDatConfig | null | undefined,
  may: number,
): ApSuatCaiDatMayConfig | null {
  if (!config || typeof config !== 'object') return null;
  if (!isValidMachineNumber(may)) return null;
  const raw = config[may] ?? config[String(may)];
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

/**
 * Có phải là giá trị áp suất cài đặt hợp lệ? Loại bỏ 0, null, undefined, NaN, Infinity.
 */
export function isValidPressureSetpoint(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val !== 0;
}

/**
 * Lấy áp suất mục tiêu của một giai đoạn cho một nồi, trả null nếu chưa cài đặt.
 */
export function pressureSetpointForStage(
  config: ApSuatCaiDatConfig | null | undefined,
  may: number,
  stage: number,
): number | null {
  const perMay = machinePressureConfig(config, may);
  if (!perMay) return null;
  if (!Number.isInteger(stage) || stage < 1 || stage > 4) return null;
  const val = perMay[STAGE_KEYS[stage - 1]];
  return isValidPressureSetpoint(val) ? val : null;
}

/**
 * Dựng chuỗi điểm mục tiêu của một nồi từ chuỗi điểm ĐO của CHÍNH nồi đó: mỗi
 * điểm đo sinh ra một điểm mục tiêu cùng `phut`, lấy giá trị theo giai đoạn của
 * chính điểm đo đó. Giai đoạn chưa cài đặt thì bỏ qua điểm đó, các giai đoạn
 * khác vẫn vẽ bình thường.
 */
export function buildPressureSetpointPoints(
  measured: PressureSetpointPoint[] | null | undefined,
  config: ApSuatCaiDatConfig | null | undefined,
  may: number,
): PressureSetpointPoint[] {
  if (!measured || measured.length === 0) return [];
  if (!isValidMachineNumber(may)) return [];
  const pts: PressureSetpointPoint[] = [];
  for (const p of measured) {
    if (!p) continue;
    // phut âm = mốc trước khi mẻ bắt đầu, trục X không vẽ tới đó.
    if (typeof p.phut !== 'number' || !Number.isFinite(p.phut) || p.phut < 0) continue;
    const value = pressureSetpointForStage(config, may, p.stage);
    if (value === null) continue;
    pts.push({ phut: p.phut, value, stage: p.stage });
  }
  return pts;
}

/**
 * Nồi này có ít nhất một giai đoạn được cài đặt hay không (dùng để bỏ qua tính
 * toán thừa cho những nồi chưa ai cài gì).
 */
export function hasAnyPressureSetpoint(
  config: ApSuatCaiDatConfig | null | undefined,
  may: number,
): boolean {
  const perMay = machinePressureConfig(config, may);
  if (!perMay) return false;
  return STAGE_KEYS.some((k) => isValidPressureSetpoint(perMay[k]));
}
