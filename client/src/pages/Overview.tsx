import React from 'react';
import { LayoutDashboard, Activity } from 'lucide-react';
import { useAllFryers } from '../hooks/useAllFryers';
import { useFleetHistory } from '../hooks/useFleetHistory';
import { MachineCard } from '../components/MachineCard';
import { FleetLineChart } from '../components/FleetLineChart';

export const Overview: React.FC = () => {
  const statuses = useAllFryers();
  const { tempSeries, apSeries } = useFleetHistory();
  const runningCount = statuses.filter((s) => s.running).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white shadow-pill">
            <LayoutDashboard size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-stage">Tổng quan hệ chiên</h1>
            <p className="text-sm text-gray-500">Giám sát 8 máy theo thời gian thực</p>
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            runningCount > 0 ? 'bg-green-50 text-val-green' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              runningCount > 0 ? 'bg-val-green animate-pulse' : 'bg-gray-400'
            }`}
          />
          {runningCount}/8 đang chạy
        </div>
      </header>

      {/* ── Line charts ─────────────────────────────────────────────────── */}
      <section aria-label="Biểu đồ xu hướng">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-stage">Xu hướng theo mẻ hiện tại</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <FleetLineChart
            title="Nhiệt độ"
            unit="°C"
            series={tempSeries}
          />
          <FleetLineChart
            title="Áp chân không"
            unit="bar"
            series={apSeries}
          />
        </div>
      </section>

      {/* ── Machine card grid ───────────────────────────────────────────── */}
      <section aria-label="Danh sách máy chiên">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statuses.map((s) => (
            <MachineCard key={s.n} status={s} />
          ))}
        </div>
      </section>
    </div>
  );
};
