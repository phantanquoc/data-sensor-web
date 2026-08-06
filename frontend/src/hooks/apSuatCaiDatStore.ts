/**
 * Nguồn sự thật dùng chung cho cấu hình áp suất cài đặt.
 *
 * Lý do tồn tại: modal cài đặt nằm ở Overview, còn đường mục tiêu được dựng
 * trong useFleetHistory (dùng ở cả Overview và trang chi tiết). Sau khi lưu, biểu
 * đồ PHẢI đổi ngay không cần F5 — người vận hành lưu xong mà thấy đường cũ thì
 * không biết lưu có thành công hay không. Một store cấp module với danh sách
 * subscriber giải quyết việc này mà không cần dựng context provider mới.
 *
 * Store cũng nhớ kết quả đã tải để nhiều màn hình cùng mount không gọi REST lặp.
 */

import { getCaiDatHeThong } from '../api';
import type { ApSuatCaiDat } from '../types';

type Listener = (value: ApSuatCaiDat | null) => void;

const listeners = new Set<Listener>();

let current: ApSuatCaiDat | null = null;
/** Request đang bay — để nhiều lần gọi song song chỉ tạo một lượt fetch. */
let inflight: Promise<ApSuatCaiDat | null> | null = null;

/** Giá trị đang có trong bộ nhớ (null = chưa tải xong hoặc tải lỗi). */
export function getApSuatCaiDatCache(): ApSuatCaiDat | null {
  return current;
}

export function subscribeApSuatCaiDat(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn(current);
}

/** Cập nhật store sau khi lưu thành công → mọi biểu đồ đang mở vẽ lại ngay. */
export function setApSuatCaiDatCache(value: ApSuatCaiDat | null): void {
  current = value;
  emit();
}

/**
 * Tải cấu hình (dùng lại kết quả đã có nếu không yêu cầu tải lại).
 * Lỗi tải KHÔNG throw ra ngoài: thiếu đường mục tiêu chỉ làm biểu đồ trống một
 * đường, không được phép làm sập luồng nạp dữ liệu đo.
 */
export function loadApSuatCaiDat(force = false): Promise<ApSuatCaiDat | null> {
  if (!force && current !== null) return Promise.resolve(current);
  if (!force && inflight) return inflight;
  inflight = getCaiDatHeThong()
    .then((res) => {
      current = res?.ap_suat_cai_dat ?? null;
      emit();
      return current;
    })
    .catch(() => current)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
