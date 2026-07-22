import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Power, Thermometer, Gauge, Zap, ChevronRight } from 'lucide-react';
import type { FryerStatus } from '../hooks/useAllFryers';

const STAGE_LABEL: Record<number, string> = {
  1: 'Giai đoạn 1',
  2: 'Giai đoạn 2',
  3: 'Giai đoạn 3',
  4: 'Giai đoạn 4',
};

interface MachineCardProps {
  status: FryerStatus;
}

export const MachineCard: React.FC<MachineCardProps> = ({ status }) => {
  const { n, connected, running, stage, elapsedMs, targetMin, tongThoiGian, sensor } = status;

  const elapsedMin = elapsedMs / 60000;
  const isOvertime = targetMin > 0 && elapsedMin > targetMin;
  const pct = targetMin > 0 ? Math.min((elapsedMin / targetMin) * 100, 100) : 0;

  const statusLabel = !connected ? 'Mất kết nối' : running ? 'Đang chạy' : 'Dừng';
  const badgeClasses = !connected
    ? 'bg-gray-100 text-gray-500'
    : running
      ? 'bg-green-100 text-val-green'
      : 'bg-gray-100 text-gray-500';
  const dotClasses = !connected
    ? 'bg-gray-400'
    : running
      ? 'bg-val-green animate-pulse'
      : 'bg-gray-400';

  return (
    <Link
      to={`/may/${n}`}
      className="group flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-white to-[#f2f8ff] p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-cardHover focus:outline-none focus:ring-2 focus:ring-brand"
    >
      {/* Header: name + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-9 w-9 place-items-center rounded-xl ${
              running ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Flame size={18} />
          </span>
          <span className="text-lg font-bold text-stage">Hệ Chiên {n}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}
        >
          <span className={`h-2 w-2 rounded-full ${dotClasses}`} />
          {statusLabel}
        </span>
      </div>

      {/* Current stage + total time */}
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-600">
          <Power size={14} className={running ? 'text-val-green' : 'text-gray-400'} />
          {running && stage ? STAGE_LABEL[stage] : 'Không hoạt động'}
        </span>
        <span className="font-semibold text-gray-500">
          Tổng: <b className="text-val-blue">{tongThoiGian}</b> phút
        </span>
      </div>

      {/* Horizontal progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Thời gian chạy</span>
          <span className="font-semibold">
            {running ? (
              <>
                <b className={isOvertime ? 'text-val-orange' : 'text-val-blue'}>
                  {elapsedMin.toFixed(1)}
                </b>
                {' / '}
                {targetMin > 0 ? Math.round(targetMin) : '--'} phút
              </>
            ) : (
              '-- / -- phút'
            )}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOvertime ? 'bg-val-orange' : 'bg-brand'
            }`}
            style={{ width: `${running ? pct : 0}%` }}
          />
        </div>
      </div>

      {/* Key sensors */}
      <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
        <Metric icon={<Thermometer size={14} />} label="Nhiệt độ" value={sensor?.nhiet_do} />
        <Metric icon={<Gauge size={14} />} label="Áp CK" value={sensor?.ap_suat_chan_khong} />
        <Metric icon={<Zap size={14} />} label="Dòng Root" value={sensor?.dong_dien_dong_co_root} />
      </div>

      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
        Xem chi tiết <ChevronRight size={14} />
      </span>
    </Link>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value?: number }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex flex-col items-center gap-0.5 text-center">
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
      {icon}
      {label}
    </span>
    <span className="text-base font-bold text-brand-dark">
      {value != null ? value : '--'}
    </span>
  </div>
);
