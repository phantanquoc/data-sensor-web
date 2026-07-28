/**
 * Hàm sanitize danh sách máy + tạo stable key — tách khỏi useFleetHistory để
 * test được không cần React/socket.
 *
 * Lý do tách: sanitizeMachineList và machineListKey là hai hàm thuần tuý chặn
 * vòng lặp vô hạn khi caller truyền fresh array literal mỗi render. Nếu hàm
 * sanitizer bị thay đổi mà test không phát hiện thì effect sẽ re-run liên tục
 * — tức lỗi vô hạn REST call giống bug cũ. Tách ra file riêng để test import
 * hàm THẬT, không cần mô phỏng lại — đảm bảo test luôn đồng bộ với production.
 */

const ALL_MACHINES = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Sanitize machine list: keep only unique integers 1..8, sorted ascending.
 * Returns ALL_MACHINES when input is undefined/empty.
 */
export function sanitizeMachineList(machines?: number[]): number[] {
  if (!machines || machines.length === 0) return ALL_MACHINES;
  const set = new Set<number>();
  for (const m of machines) {
    if (Number.isInteger(m) && m >= 1 && m <= 8) set.add(m);
  }
  if (set.size === 0) return ALL_MACHINES;
  return [...set].sort((a, b) => a - b);
}

/** Derive a stable primitive key string from a sanitized machine list. */
export function machineListKey(sanitized: number[]): string {
  return sanitized.join(',');
}
