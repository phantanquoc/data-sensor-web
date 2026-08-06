import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, Flame, ChevronRight, Sun, Moon, LogOut, Gauge } from 'lucide-react';
import { logout } from '../api';
import { useAllFryers } from '../hooks/useAllFryers';
import { useTheme } from '../hooks/useTheme';
import { useFleetHistory } from '../hooks/useFleetHistory';
import { MachineCard } from '../components/MachineCard';
import { FleetLineChart } from '../components/FleetLineChart';
import { StatsBar } from '../components/StatsBar';
import { CaiDatHeThongModal } from '../components/CaiDatHeThongModal';
import { Toast } from '../components/Toast';
import type { Period } from '../hooks/useThongKe';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'custom', label: 'Tùy chỉnh' },
];

/** Hôm nay dạng YYYY-MM-DD theo giờ máy (múi giờ VN). */
function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const Overview: React.FC = () => {
  const statuses = useAllFryers();
  const { latest, previous } = useFleetHistory();
  const { theme, toggleTheme } = useTheme();
  const runningCount = statuses.filter((s) => s.running).length;
  const [period, setPeriod] = useState<Period>('day');
  const [customFrom, setCustomFrom] = useState<string>(todayYmd());
  const [customTo, setCustomTo] = useState<string>(todayYmd());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [caiDatOpen, setCaiDatOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const clearToast = useCallback(() => setToastMsg(null), []);

  const handleLogout = async () => {
    await logout();
    // Reload để App kiểm tra lại phiên (getMe → 401) và hiện trang login.
    window.location.assign('/login');
  };

  // Trả focus về nút mở menu sau khi đóng modal. Không dựa vào cơ chế tự khôi
  // phục của modal được: nút "Cài đặt hệ thống" nằm trong dropdown và đã bị gỡ
  // khỏi DOM ngay khi modal mở, nên nút bánh răng là điểm quay về hợp lý duy nhất.
  // Đặt ở effect của trang cha để chạy SAU cleanup của modal, tránh bị ghi đè.
  const caiDatWasOpen = useRef(false);
  useEffect(() => {
    if (caiDatOpen) {
      caiDatWasOpen.current = true;
      return;
    }
    if (!caiDatWasOpen.current) return;
    caiDatWasOpen.current = false;
    pickerBtnRef.current?.focus();
  }, [caiDatOpen]);

  // Đóng menu chọn máy khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header + bộ lọc + thống kê (gộp chung 1 card) ───────────────── */}
      <header className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                ref={pickerBtnRef}
                aria-label="Chọn máy để xem chi tiết"
                aria-haspopup="menu"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((open) => !open)}
                className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white shadow-pill transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <LayoutDashboard size={22} />
              </button>

              {pickerOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-cardHover"
                >
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Chọn máy để xem
                  </p>
                  {statuses.map((s) => (
                    <button
                      key={s.n}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPickerOpen(false);
                        navigate(`/may/${s.n}`);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-overlay"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                          s.running ? 'bg-brand text-white' : 'bg-surface-overlay text-text-muted'
                        }`}
                      >
                        <Flame size={15} />
                      </span>
                      <span className="flex-1 font-semibold">Hệ Chiên {s.n}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          !s.connected ? 'bg-text-muted' : s.running ? 'bg-val-green animate-pulse' : 'bg-text-muted'
                        }`}
                      />
                      <ChevronRight size={14} className="text-text-muted" />
                    </button>
                  ))}

                  {/* Cài đặt dùng chung cả dàn — tách khỏi danh sách máy bằng
                      đường kẻ để không bị đọc nhầm là "máy thứ 9". */}
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPickerOpen(false);
                      setCaiDatOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-overlay"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-overlay text-text-muted">
                      <Gauge size={15} />
                    </span>
                    <span className="flex-1 font-semibold">Cài đặt hệ thống</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Tổng quan hệ chiên</h1>
              <p className="text-sm text-text-secondary">Giám sát 8 máy theo thời gian thực</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-border bg-surface-raised p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    period === p.key ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                runningCount > 0 ? 'bg-val-green/10 text-val-green' : 'bg-surface-overlay text-text-muted'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  runningCount > 0 ? 'bg-val-green animate-pulse' : 'bg-text-muted'
                }`}
              />
              {runningCount}/8 đang chạy
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Chuyển chế độ sáng/tối"
              aria-pressed={theme === 'light'}
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-raised text-text-secondary transition hover:text-brand hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-raised text-text-secondary transition hover:text-val-red hover:border-val-red/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Chọn khoảng ngày tùy chỉnh */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              Từ ngày
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              Đến ngày
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayYmd()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
          </div>
        )}

        {/* 3 box thống kê lồng trong card */}
        <StatsBar period={period} custom={{ from: customFrom, to: customTo }} />

        {/* Biểu đồ xu hướng lồng chung card */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Xu hướng theo mẻ hiện tại</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FleetLineChart
              title="Nhiệt độ"
              unit="°C"
              latestSeries={latest.tempSeries}
              previousSeries={previous.tempSeries}
            />
            {/* Không truyền đường cài đặt ở trang tổng quan: mỗi nồi giờ có mục
                tiêu riêng, vẽ tới 8 đường nét đứt chồng lên 8 đường đo sẽ rối
                không đọc được. Đường mục tiêu nằm ở trang chi tiết từng nồi,
                giống cách biểu đồ nhiệt độ bên cạnh đang làm. */}
            <FleetLineChart
              title="Áp chân không"
              unit="bar"
              latestSeries={latest.apSeries}
              previousSeries={previous.apSeries}
            />
          </div>
        </div>
      </header>

      {/* ── Machine card grid ───────────────────────────────────────────── */}
      <section aria-label="Danh sách máy chiên">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statuses.map((s) => (
            <MachineCard key={s.n} status={s} />
          ))}
        </div>
      </section>

      {caiDatOpen && (
        <CaiDatHeThongModal
          onClose={() => setCaiDatOpen(false)}
          onSaved={(msg) => setToastMsg(msg)}
        />
      )}

      <Toast message={toastMsg} onDone={clearToast} />
    </div>
  );
};
