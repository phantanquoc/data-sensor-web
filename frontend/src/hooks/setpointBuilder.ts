/**
 * Dựng ChartPoint[] cho đường setpoint (nhiệt độ cài đặt) — tách khỏi
 * useFleetHistory để test được không cần React/socket.
 *
 * Quy tắc nghiệp vụ:
 *  - Chỉ stages 1-3. Stage 4 không có setpoint (PLC không điều khiển nhiệt độ ở
 *    giai đoạn treo lòng).
 *  - Giá trị 0 hoặc undefined/null = KHÔNG CÓ DỮ LIỆU → bỏ qua, không vẽ 0 °C.
 *  - Dùng per-sample `nhiet_do_cai_dat` (bien_du_lieu[i].nhiet_do_cai_dat), KHÔNG
 *    dùng stage-level nhiet_do_cai_dat (chỉ giữ giá trị cuối, mất lịch sử).
 */

import type { BienDuLieuEntry } from '../types';
import { parseTs } from './timeUtils';

export interface SetpointPoint {
  /** Minutes elapsed since batch start (X axis) */
  phut: number;
  /** Setpoint temperature value (Y axis) */
  value: number;
  /** Stage 1-3 */
  stage: 1 | 2 | 3;
}

/**
 * Có phải là giá trị setpoint hợp lệ? Loại bỏ 0, null, undefined, NaN.
 */
function isValidSetpoint(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val !== 0;
}

/**
 * Build setpoint points from a single stage's bien_du_lieu array.
 * Only stages 1-3 should call this — stage 4 has no setpoint data.
 */
export function buildSetpointFromStage(
  entries: BienDuLieuEntry[],
  stage: 1 | 2 | 3,
  batchStartMs: number,
): SetpointPoint[] {
  const pts: SetpointPoint[] = [];
  for (const e of entries) {
    const sp = e.nhiet_do_cai_dat;
    if (!isValidSetpoint(sp)) continue;
    const ts = parseTs(e.thoi_gian);
    if (!ts) continue;
    const phut = (ts.getTime() - batchStartMs) / 60000;
    if (phut < 0) continue;
    pts.push({ phut, value: sp, stage });
  }
  return pts;
}

/**
 * Build complete setpoint series from all stages of a batch document.
 * Returns an array of SetpointPoint covering stages 1-3 only.
 */
export function buildBatchSetpointPoints(
  stages: Array<{ entries: BienDuLieuEntry[]; stage: 1 | 2 | 3 }>,
  batchStartMs: number,
): SetpointPoint[] {
  const pts: SetpointPoint[] = [];
  for (const { entries, stage } of stages) {
    pts.push(...buildSetpointFromStage(entries, stage, batchStartMs));
  }
  return pts;
}

/**
 * Check whether a live socket setpoint value is valid for appending.
 * Stage must be 1-3 and value must be a positive finite number.
 */
export function isLiveSetpointValid(
  stageNum: number,
  setpointValue: unknown,
): setpointValue is number {
  return stageNum >= 1 && stageNum <= 3 && isValidSetpoint(setpointValue);
}
