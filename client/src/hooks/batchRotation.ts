/**
 * Quyết định "máy này vừa sang mẻ mới chưa?" — tách khỏi useFleetHistory để test
 * được không cần React/socket.
 *
 * Quy tắc nghiệp vụ: chỉ cần MỘT máy bắt đầu mẻ mới là máy đó tạo biểu đồ mẻ
 * mới, còn biểu đồ đang có của nó tụt xuống tab "Mẻ trước". Các máy khác không
 * bị ảnh hưởng — vì vậy hai mẻ chạy song song trên hai tab là bình thường.
 */

export interface RotationInput {
  /** Giai đoạn đang active theo payload socket (1..4) */
  stageNum: 1 | 2 | 3 | 4;
  /** stage_elapsed_ms từ server, null nếu payload cũ dạng mảng */
  elapsedMs: number | null;
  /** Mốc thời gian của mẫu cảm biến trong payload (ms) */
  sensorTsMs: number;
  /** Mốc bắt đầu mẻ đang vẽ của máy này (ms), null nếu chưa có */
  currentMark: number | null;
  /** Máy này có đang được coi là chạy không */
  running: boolean;
  /** Giai đoạn ghi nhận ở tick trước, null nếu chưa có tick nào */
  previousStage: 1 | 2 | 3 | 4 | null;
  /** stage_elapsed_ms ở tick trước */
  prevElapsed: number | null;
}

export interface RotationDecision {
  startsNewBatch: boolean;
  /** Mốc bắt đầu mẻ mới suy từ server, null nếu không suy được */
  serverBatchStart: number | null;
  /** Lý do — chỉ để log/gỡ lỗi */
  reason: string | null;
}

/**
 * Sai số cho phép giữa mốc đang giữ và mốc server suy ra. Lớn hơn ngưỡng này
 * thì coi như đang vẽ sai mẻ.
 */
export const REANCHOR_TOL_MS = 2 * 60 * 1000;

export function decideRotation(input: RotationInput): RotationDecision {
  const { stageNum, elapsedMs, sensorTsMs, currentMark, running, previousStage, prevElapsed } = input;

  const serverBatchStart =
    stageNum === 1 && elapsedMs != null ? sensorTsMs - elapsedMs : null;

  // Mẻ mới chỉ khởi đầu ở giai đoạn 1. Ở giai đoạn 2-4 mà thấy dấu hiệu lạ thì
  // đó là nhiễu, không phải mẻ mới.
  if (stageNum !== 1) {
    return { startsNewBatch: false, serverBatchStart, reason: null };
  }

  // Mốc bắt đầu mà server suy ra lệch xa mốc đang vẽ → đang vẽ mẻ khác.
  const markDrifted =
    serverBatchStart != null &&
    (currentMark == null || Math.abs(currentMark - serverBatchStart) > REANCHOR_TOL_MS);

  // Đồng hồ giai đoạn tụt lùi → máy đã reset sang mẻ mới.
  const elapsedReset =
    elapsedMs != null && prevElapsed != null && elapsedMs < prevElapsed;

  // Về giai đoạn 1 sau khi đã sang giai đoạn sau → vòng mẻ mới.
  const wrappedFromLaterStage = previousStage != null && previousStage > 1;

  let reason: string | null = null;
  if (!running) reason = "máy đã dừng, nay chạy lại";
  else if (markDrifted) reason = "mốc bắt đầu lệch quá ngưỡng";
  else if (wrappedFromLaterStage) reason = "quay về giai đoạn 1";
  else if (elapsedReset) reason = "đồng hồ giai đoạn tụt lùi";

  return { startsNewBatch: reason != null, serverBatchStart, reason };
}
