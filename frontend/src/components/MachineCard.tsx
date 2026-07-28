import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Power, Thermometer, Gauge, Zap, ChevronRight } from 'lucide-react';
import type { FryerStatus } from '../hooks/useAllFryers';
import { isTemperatureWarning } from '../constants';
import { useLiveElapsed } from '../hooks/useLiveElapsed';

const STAGE_LABEL: Record<number, string> = {
  1: 'Giai đoạn 1',
  2: 'Giai đoạn 2',
  3: 'Giai đoạn 3',
  4: 'Giai đoạn 4',
};

interface MachineCardProps {
  status: FryerStatus;
}

function formatElapsedClock(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const MachineCard: React.FC<MachineCardProps> = ({ status }) => {
  const {
    n,
    connected,
    running,
    stage,
    elapsedMs,
    receivedAt,
    targetMin,
    targetTemperature,
    tongThoiGian,
    sensor,
  } = status;

  // Same shared timer as the detail page — server-authoritative elapsed +
  // capped interpolation + 1 s tick, so both views agree to the second.
  const displayElapsedMs = useLiveElapsed(elapsedMs, receivedAt, running);
  const elapsedMin = displayElapsedMs / 60000;
  const isOvertime = targetMin > 0 && elapsedMin > targetMin;
  const pct = targetMin > 0 ? Math.min((elapsedMin / targetMin) * 100, 100) : 0;
  const temperatureWarning = isTemperatureWarning(sensor?.nhiet_do, targetTemperature);

  const statusLabel = !connected ? 'Mất kết nối' : running ? 'Đang chạy' : 'Dừng';
  const badgeClasses = !connected
    ? 'bg-surface-overlay text-text-muted'
    : running
      ? 'bg-val-green/15 text-val-green'
      : 'bg-surface-overlay text-text-muted';
  const dotClasses = !connected
    ? 'bg-text-muted'
    : running
      ? 'bg-val-green animate-pulse'
      : 'bg-text-muted';

  return (
    <Link
      to={`/may/${n}`}
      className="group flex min-h-[280px] flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-cardHover hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand"
    >
      {/* Header: name + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              running ? 'bg-brand text-white' : 'bg-surface-overlay text-text-muted'
            }`}
          >
            <Flame size={20} />
          </span>
          <span className="text-lg font-bold text-text-primary">Hệ Chiên {n}</span>
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
        <span className="inline-flex items-center gap-1.5 font-semibold text-text-secondary">
          <Power size={14} className={running ? 'text-val-green' : 'text-text-muted'} />
          {running && stage ? STAGE_LABEL[stage] : 'Không hoạt động'}
        </span>
        <span className="font-semibold text-text-secondary">
          Tổng: <b className="text-val-blue">{tongThoiGian}</b> phút
        </span>
      </div>

      {/* Horizontal progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Thời gian chạy</span>
          <span className="font-semibold">
            {running ? (
              <>
                <b className={isOvertime ? 'text-val-orange' : 'text-val-blue'}>
                  {formatElapsedClock(displayElapsedMs)}
                </b>
                {' / '}
                {targetMin > 0 ? Math.round(targetMin) : '--'} phút
              </>
            ) : (
              '-- / -- phút'
            )}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOvertime ? 'bg-val-orange' : 'bg-brand'
            }`}
            style={{ width: `${running ? pct : 0}%` }}
          />
        </div>
      </div>

      {/* Key sensors — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <Metric
          icon={<Thermometer size={13} />}
          label="Nhiệt độ"
          value={sensor?.nhiet_do}
          targetValue={targetTemperature}
          warning={temperatureWarning}
          unit="°C"
          color="red"
        />
        <Metric
          icon={<Gauge size={13} />}
          label="Áp CK"
          value={sensor?.ap_suat_chan_khong}
          unit="bar"
          color="teal"
        />
        <Metric
          icon={<Zap size={13} />}
          label="Dòng Root"
          value={sensor?.dong_dien_dong_co_root}
          unit="A"
          color="orange"
        />
        <Metric
          icon={<Zap size={13} />}
          label="Dòng vòng nước"
          value={sensor?.dong_dien_dong_co_vong_nuoc}
          unit="A"
          color="orange"
        />
      </div>

      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
        Xem chi tiết <ChevronRight size={14} />
      </span>
    </Link>
  );
};

/** Color maps — val.* semantic palette from tailwind.config / ui-dna */
const COLOR_CLASSES: Record<string, { icon: string; value: string }> = {
  red:    { icon: 'text-val-red',    value: 'text-val-red'    },
  teal:   { icon: 'text-val-teal',   value: 'text-val-teal'   },
  orange: { icon: 'text-val-orange', value: 'text-val-orange' },
  blue:   { icon: 'text-val-blue',   value: 'text-val-blue'   },
  green:  { icon: 'text-val-green',  value: 'text-val-green'  },
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: number;
  targetValue?: number | null;
  warning?: boolean;
  unit?: string;
  color?: keyof typeof COLOR_CLASSES;
}> = ({ icon, label, value, targetValue, warning = false, unit, color }) => {
  const cls = color ? COLOR_CLASSES[color] : null;
  const iconClass = warning ? (cls?.icon ?? 'text-text-secondary') : 'text-white';
  const valueClass = warning ? (cls?.value ?? 'text-text-primary') : 'text-white';

  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-center transition-colors ${
        warning ? 'bg-val-orange/15 border border-val-orange/30' : 'bg-brand/90'
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${iconClass}`}
      >
        {icon}
        {label}
      </span>
      <span className={`text-[15px] font-bold leading-tight ${valueClass}`}>
        {value != null ? value : '--'}
        {targetValue != null ? `/${targetValue}` : null}
        {(value != null || targetValue != null) && unit ? (
          <span className="ml-0.5 text-[10px] font-normal opacity-70">{unit}</span>
        ) : null}
      </span>
    </div>
  );
};
