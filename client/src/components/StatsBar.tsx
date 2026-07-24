import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useThongKe, type Period, type CustomRange } from '../hooks/useThongKe';

interface StatBox {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconWrap: string;
  valueColor: string;
}

interface StatsBarProps {
  period: Period;
  custom?: CustomRange;
  /** Lọc theo 1 máy (1..8). Bỏ trống = gộp cả 8 máy. */
  may?: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({ period, custom, may }) => {
  const { stats, loading, error } = useThongKe(period, custom, may);
  const safe = stats ?? { tong: 0, hoan_thanh: 0, loi: 0, dang_chay: 0 };

  const boxes: StatBox[] = [
    {
      label: 'Tổng số mẻ',
      value: safe.tong,
      icon: <Layers size={22} />,
      iconWrap: 'bg-brand text-white',
      valueColor: 'text-text-primary',
    },
    {
      label: 'Mẻ hoàn thành',
      value: safe.hoan_thanh,
      icon: <CheckCircle2 size={22} />,
      iconWrap: 'bg-val-green/15 text-val-green',
      valueColor: 'text-val-green',
    },
    {
      label: 'Mẻ lỗi',
      value: safe.loi,
      icon: <AlertTriangle size={22} />,
      iconWrap: 'bg-val-red/15 text-val-red',
      valueColor: 'text-val-red',
    },
    {
      label: 'Mẻ đang chạy',
      value: safe.dang_chay,
      icon: <Loader2 size={22} />,
      iconWrap: 'bg-brand/15 text-brand',
      valueColor: 'text-brand',
    },
  ];

  return (
    <div aria-label="Thống kê mẻ chiên" className="space-y-3">
      {error && <p className="text-sm text-val-red">{error}</p>}

      {/* 4 box */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {boxes.map((box) => (
          <div
            key={box.label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface-raised p-5"
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${box.iconWrap}`}>
              {box.icon}
            </span>
            <div>
              <p className="text-sm text-text-secondary">{box.label}</p>
              <p className={`text-3xl font-bold ${box.valueColor}`}>
                {loading ? '—' : box.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
