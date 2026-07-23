/**
 * FleetLineChart — Recharts multi-line chart for up to 8 fryer machines.
 *
 * - XAxis type="number" (minutes elapsed from batch start) so series with
 *   different start times all align on the same 0-based phút scale.
 * - Each machine gets one Line in its assigned chart-series color.
 * - Custom tooltip shows: machine name, stage, elapsed minutes, value + unit.
 * - Giai đoạn is shown in tooltip ONLY (not by line color), per spec.
 */
import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { MachineSeries } from '../hooks/useFleetHistory';

interface FleetLineChartProps {
  /** Chart title displayed above the chart */
  title: string;
  /** Unit label for Y axis and tooltip (e.g. "°C", "bar") */
  unit: string;
  /** Series data from useFleetHistory */
  series: MachineSeries[];
}

/* ─── Custom Tooltip ──────────────────────────────────────────────────── */

interface TooltipPayloadItem {
  name: string;
  color: string;
  value: number;
  payload: { phut: number; value: number; stage: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, unit }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-card text-sm">
      <p className="mb-2 font-semibold text-stage">
        Phút: <span className="text-val-blue">{typeof label === 'number' ? label.toFixed(1) : '--'}</span>
      </p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-gray-600">{item.name}</span>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-gray-500 text-xs">
            GĐ {item.payload?.stage ?? '?'}
          </span>
          <span className="mx-1 text-gray-400">·</span>
          <span className="font-bold text-stage">
            {item.value}
            <span className="ml-0.5 text-xs font-normal text-gray-500">{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── Main chart ──────────────────────────────────────────────────────── */

export const FleetLineChart: React.FC<FleetLineChartProps> = ({ title, unit, series }) => {
  if (series.length === 0) {
    return (
      <div className="flex flex-col rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-base font-bold text-stage">{title}</h2>
        <div className="flex h-36 items-center justify-center text-sm text-gray-400">
          Chưa có mẻ nào đang chạy
        </div>
      </div>
    );
  }

  /**
   * Recharts LineChart expects a unified data array on the chart level, but here
   * each series has its OWN x-axis points (machines started at different times).
   * Solution: pass each series as its OWN <Line data={...}> prop — Recharts
   * supports per-line data arrays since v2.1. The XAxis domain auto-expands to
   * cover all series' phut ranges.
   */

  // Compute global X domain across all series
  let xMax = 0;
  for (const s of series) {
    for (const p of s.points) {
      if (p.phut > xMax) xMax = p.phut;
    }
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white p-6 shadow-card">
      <h2 className="mb-4 text-base font-bold text-stage">{title}</h2>
      <ResponsiveContainer width="100%" height={280}>
        {/* Pass an empty top-level data array; each Line has its own data prop */}
        <LineChart data={[]} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="phut"
            type="number"
            domain={[0, Math.ceil(xMax + 2)]}
            tickCount={8}
            tickFormatter={(v: number) => v.toFixed(0)}
            label={{ value: 'Phút', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#9ca3af' }}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            stroke="#d1d5db"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            stroke="#d1d5db"
            tickFormatter={(v: number) => v.toFixed(0)}
            width={40}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
          {series.map((s) => (
            <Line
              key={s.n}
              name={`Hệ Chiên ${s.n}`}
              data={s.points}
              dataKey="value"
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
