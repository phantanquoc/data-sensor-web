import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useAllFryers } from '../hooks/useAllFryers';
import { MachineCard } from '../components/MachineCard';

export const Overview: React.FC = () => {
  const statuses = useAllFryers();
  const runningCount = statuses.filter((s) => s.running).length;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">
            <LayoutDashboard size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-stage">Tổng quan hệ chiên</h1>
            <p className="text-sm text-gray-500">Giám sát 8 máy theo thời gian thực</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-val-green">
          <span className="h-2.5 w-2.5 rounded-full bg-val-green" />
          {runningCount}/8 đang chạy
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statuses.map((s) => (
          <MachineCard key={s.n} status={s} />
        ))}
      </div>
    </div>
  );
};
