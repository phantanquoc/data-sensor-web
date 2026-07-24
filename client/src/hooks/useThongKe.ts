import { useCallback, useEffect, useState } from 'react';
import { getThongKe } from '../api';
import type { ThongKe } from '../types';

export type Period = 'day' | 'week' | 'month' | 'custom';

export interface CustomRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

const EMPTY: ThongKe = { tong: 0, hoan_thanh: 0, loi: 0, dang_chay: 0 };
const REFRESH_MS = 15000;

/** Format a Date as YYYY-MM-DD in local time (dashboard runs in VN timezone). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** [from, to] date strings for the given period, relative to today (local time). */
export function rangeForPeriod(
  period: Period,
  custom?: CustomRange,
  now = new Date(),
): { from: string; to: string } {
  const to = ymd(now);
  if (period === 'custom') {
    // Cho phép chọn ngược; tự hoán đổi để from <= to.
    const f = custom?.from || to;
    const t = custom?.to || to;
    return f <= t ? { from: f, to: t } : { from: t, to: f };
  }
  if (period === 'day') {
    return { from: to, to };
  }
  if (period === 'week') {
    // Tuần bắt đầu Thứ Hai. getDay(): 0=CN..6=T7 → số ngày lùi về T2.
    const dow = now.getDay();
    const daysBack = dow === 0 ? 6 : dow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysBack);
    return { from: ymd(monday), to };
  }
  // month: từ ngày 1 của tháng hiện tại
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: ymd(first), to };
}

/**
 * Tổng hợp thống kê mẻ chiên toàn hệ (8 máy) theo kỳ Ngày/Tuần/Tháng.
 * Tự tính khoảng from/to, gọi /thong_ke, và auto-refresh mỗi 15s.
 */
export function useThongKe(
  period: Period,
  custom?: CustomRange,
  may?: number,
): { stats: ThongKe; loading: boolean; error: string | null } {
  const [stats, setStats] = useState<ThongKe>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const customFrom = custom?.from;
  const customTo = custom?.to;

  const load = useCallback(async () => {
    const { from, to } = rangeForPeriod(period, { from: customFrom ?? '', to: customTo ?? '' });
    try {
      const data = await getThongKe({ from, to }, may);
      // Backend cũ (chưa có route /thong_ke) rơi vào SPA fallback → trả HTML,
      // parse ra null. Chỉ nhận object hợp lệ, tránh setStats(null) gây crash.
      if (data && typeof data.tong === 'number') {
        setStats(data);
        setError(null);
      } else {
        setError('Máy chủ chưa hỗ trợ thống kê (cần build lại backend)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải thống kê');
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, may]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { stats, loading, error };
}
