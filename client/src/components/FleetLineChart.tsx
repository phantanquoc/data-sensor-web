/**
 * FleetLineChart — Recharts multi-line chart for up to 8 fryer machines.
 *
 * - XAxis type="number" (minutes elapsed from batch start) so series with
 *   different start times all align on the same 0-based phut scale.
 * - Each machine gets one Line in its assigned chart-series color.
 * - Custom tooltip shows: machine name, stage, elapsed minutes, value + unit.
 * - Segmented toggle switches between latest batch and previous batch view.
 */
import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../hooks/useTheme';

interface FleetLineChartProps {
  /** Chart title displayed above the chart */
  title: string;
  /** Unit label for Y axis and tooltip (e.g. "°C", "bar") */
  unit: string;
  /** Latest batch series data */
  latestSeries: MachineSeries[];
  /** Previous batch series data */
  previousSeries: MachineSeries[];
}

/* --- Custom Tooltip -------------------------------------------------------- */

interface TooltipPayloadItem {
  name: string;
  color: string;
  value: number | null;
  dataKey: string;
  payload: Record<string, number | null | undefined>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, unit }) => {
  if (!active || !payload || payload.length === 0) return null;

  const visible = payload.filter((item) => item.value != null);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-card text-sm">
      <p className="mb-2 font-semibold text-text-primary">
        Phút: <span className="text-val-blue">{typeof label === 'number' ? label.toFixed(1) : '--'}</span>
      </p>
      {visible.map((item) => {
        const stage = item.payload?.[`${item.dataKey}_stage`] ?? '?';
        const displayVal = typeof item.value === 'number' ? item.value.toFixed(1) : '--';
        return (
          <div key={item.name} className="flex items-center gap-2 py-0.5">
            <span
              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-text-secondary">{item.name}</span>
            <span className="mx-1 text-text-muted">·</span>
            <span className="text-text-muted text-xs">
              GĐ {stage}
            </span>
            <span className="mx-1 text-text-muted">·</span>
            <span className="font-bold text-text-primary">
              {displayVal}
              <span className="ml-0.5 text-xs font-normal text-text-secondary">{unit}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* --- Toggle types ---------------------------------------------------------- */

type ViewMode = 'latest' | 'previous';

/* --- Y-axis scaling helpers ------------------------------------------------ */

/** "Nice" step (1/2/5 × 10ⁿ) aiming for ~targetTicks intervals over `range`. */
const niceStep = (range: number, targetTicks = 5): number => {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
};

/**
 * Compute a padded, snapped Y-axis domain + evenly spaced ticks from the
 * observed value range. Deliberately does NOT anchor at 0 so the plotted
 * lines fill the vertical space instead of getting squashed near the top.
 */
const buildYScale = (
  vMin: number,
  vMax: number,
): { domain: [number, number]; ticks: number[] } => {
  if (!Number.isFinite(vMin) || !Number.isFinite(vMax)) {
    return { domain: [0, 1], ticks: [0, 1] };
  }
  // Degenerate range (all values equal): open up a small window around it.
  const rawRange = vMax - vMin;
  const pad = rawRange === 0 ? Math.max(1, Math.abs(vMax) * 0.05) : rawRange * 0.15;

  let lo = vMin - pad;
  let hi = vMax + pad;
  // Non-negative physical quantities shouldn't render a negative axis.
  if (lo < 0 && vMin >= 0) lo = 0;

  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi <= lo) hi = lo + step;

  const ticks: number[] = [];
  for (let t = lo; t <= hi + step * 1e-6; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  return { domain: [lo, hi], ticks };
};

/* --- Chart chrome colors by theme ----------------------------------------- */

const CHART_CHROME = {
  dark: { grid: '#2a3f52', tick: '#94a3b8', label: '#64748b', gridOpacity: 0.25 },
  light: { grid: '#e2e8f0', tick: '#475569', label: '#64748b', gridOpacity: 1 },
} as const;

/* --- Main chart ------------------------------------------------------------ */

export const FleetLineChart: React.FC<FleetLineChartProps> = ({
  title,
  unit,
  latestSeries,
  previousSeries,
}) => {
  const [view, setView] = useState<ViewMode>('latest');
  const { theme } = useTheme();
  const chrome = CHART_CHROME[theme];
  const activeSeries = view === 'latest' ? latestSeries : previousSeries;
  const hasPrevious = previousSeries.length > 0;

  // Build merged chart-level data array with per-machine columns.
  // NOTE: this hook must run unconditionally on every render (Rules of Hooks),
  // so it is placed BEFORE the empty-state early return and short-circuits
  // internally when there is no active series.
  const { merged, xMax, presentMachines, yScale } = useMemo(() => {
    const emptyScale = { domain: [0, 1] as [number, number], ticks: [0, 1] };
    if (activeSeries.length === 0) {
      return { merged: [], xMax: 0, presentMachines: [] as { n: number; color: string }[], yScale: emptyScale };
    }
    // Derive present machines, compute xMax (phut) and value min/max (for Y scale)
    const machines = activeSeries.map((s) => ({ n: s.n, color: s.color }));
    let max = 0;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const s of activeSeries) {
      for (const p of s.points) {
        if (p.phut > max) max = p.phut;
        if (p.value < vMin) vMin = p.value;
        if (p.value > vMax) vMax = p.value;
      }
    }
    const yScale = buildYScale(vMin, vMax);

    if (max <= 0) {
      return { merged: [{ phut: 0 }], xMax: 0, presentMachines: machines, yScale };
    }

    // Build even grid
    const STEP = Math.max(0.5, max / 600);
    const grid: number[] = [];
    for (let t = 0; t <= max; t += STEP) {
      grid.push(t);
    }
    // Guarantee final value equals xMax
    if (grid.length === 0 || grid[grid.length - 1] < max) {
      grid.push(max);
    } else if (grid[grid.length - 1] > max) {
      grid[grid.length - 1] = max;
    }

    // Build rows with interpolated per-machine values
    const rows: Record<string, number | null | undefined>[] = grid.map((t) => {
      const row: Record<string, number | null | undefined> = { phut: t };

      for (const s of activeSeries) {
        const key = `m${s.n}`;
        const stageKey = `${key}_stage`;
        const pts = s.points;

        if (pts.length === 0 || t < pts[0].phut || t > pts[pts.length - 1].phut) {
          row[key] = null;
          continue;
        }

        // Find bracketing pair via linear scan
        let left = pts[0];
        let right = pts[0];
        for (let i = 0; i < pts.length - 1; i++) {
          if (pts[i].phut <= t && pts[i + 1].phut >= t) {
            left = pts[i];
            right = pts[i + 1];
            break;
          }
        }
        // Edge: t exactly equals last point
        if (t >= pts[pts.length - 1].phut) {
          left = pts[pts.length - 1];
          right = left;
        }

        // Linear interpolation
        const denom = right.phut - left.phut;
        const val = denom === 0
          ? left.value
          : left.value + (right.value - left.value) * (t - left.phut) / denom;
        row[key] = val;
        row[stageKey] = left.stage;
      }

      return row;
    });

    return { merged: rows, xMax: max, presentMachines: machines, yScale };
  }, [activeSeries]);

  // Empty state (rendered AFTER all hooks have run)
  if (activeSeries.length === 0) {
    const emptyMsg = view === 'latest'
      ? 'Chưa có mẻ nào đang chạy'
      : 'Chưa có mẻ trước';

    return (
      <div className="flex flex-col rounded-2xl border border-border bg-surface-raised p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <SegmentedToggle
            view={view}
            onChangeView={setView}
            previousDisabled={!hasPrevious}
          />
        </div>
        <div className="flex h-36 items-center justify-center text-sm text-text-muted">
          {emptyMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-raised p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        <SegmentedToggle
          view={view}
          onChangeView={setView}
          previousDisabled={!hasPrevious}
        />
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={merged} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} strokeOpacity={chrome.gridOpacity} />
          <XAxis
            dataKey="phut"
            type="number"
            domain={[0, Math.ceil(xMax + 2)]}
            tickCount={8}
            tickFormatter={(v: number) => v.toFixed(0)}
            label={{ value: 'Phút', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: chrome.label }}
            tick={{ fontSize: 11, fill: chrome.tick }}
            stroke={chrome.grid}
          />
          <YAxis
            type="number"
            domain={yScale.domain}
            ticks={yScale.ticks}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: chrome.tick }}
            stroke={chrome.grid}
            tickFormatter={(v: number) => v.toFixed(0)}
            width={40}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-text-secondary">{value}</span>
            )}
          />
          {presentMachines.map((s) => (
            <Line
              key={s.n}
              name={`Hệ Chiên ${s.n}`}
              dataKey={`m${s.n}`}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              type="monotone"
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/* --- Segmented Toggle ------------------------------------------------------ */

interface SegmentedToggleProps {
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
  previousDisabled: boolean;
}

const SegmentedToggle: React.FC<SegmentedToggleProps> = ({
  view,
  onChangeView,
  previousDisabled,
}) => {
  const baseBtn = 'px-3 py-1 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';
  const activeBtn = 'bg-brand text-white shadow-pill';
  const inactiveBtn = 'text-text-secondary hover:text-text-primary';
  const disabledBtn = 'text-text-muted cursor-not-allowed';

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-surface-overlay p-0.5">
      <button
        type="button"
        aria-pressed={view === 'latest'}
        className={`${baseBtn} ${view === 'latest' ? activeBtn : inactiveBtn}`}
        onClick={() => onChangeView('latest')}
      >
        Mẻ mới nhất
      </button>
      <button
        type="button"
        aria-pressed={view === 'previous'}
        disabled={previousDisabled}
        className={`${baseBtn} ${view === 'previous' ? activeBtn : previousDisabled ? disabledBtn : inactiveBtn}`}
        onClick={() => { if (!previousDisabled) onChangeView('previous'); }}
      >
        Mẻ trước
      </button>
    </div>
  );
};
