/**
 * useFleetHistory — loads full batch history + live socket ticks for all running
 * machines. Returns two batch-scoped series sets (latest + previous) for the
 * FleetLineChart component on the Overview page.
 *
 * Design decisions:
 *  - Opens 8 socket connections using the same forceNew pattern as useAllFryers.
 *  - Capped at MAX_POINTS per machine with even downsampling.
 *  - Live points appended only when MIN_PHUT_GAP elapsed since last point.
 *  - X values use only backend-generated timestamps.
 *  - Initialization gate: socket data is ignored until REST load completes for
 *    each machine, preventing desync of batchStart when socket fires before REST.
 *  - Dual-batch: tracks both the latest and previous batch per machine so the
 *    Overview can toggle between the current and the preceding batch.
 */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getNoiChien, getNoiChienDetail } from '../api';
import { parseTs } from './timeUtils';
import type {
  StagePayload,
  NoiChienDataPayload,
  BienDuLieuEntry,
  BatchDocument,
} from '../types';

/** A single chart data point */
export interface ChartPoint {
  /** Minutes elapsed since batch start (X axis) */
  phut: number;
  /** Sensor value (Y axis) */
  value: number;
  /** Stage 1-4 (shown in tooltip only) */
  stage: 1 | 2 | 3 | 4;
}

/** Series for one machine */
export interface MachineSeries {
  /** Fryer number 1-8 */
  n: number;
  /** Hex color for this series */
  color: string;
  points: ChartPoint[];
}

/** Return shape of the hook */
export interface FleetHistoryState {
  latest: { tempSeries: MachineSeries[]; apSeries: MachineSeries[] };
  previous: { tempSeries: MachineSeries[]; apSeries: MachineSeries[] };
}
/**
 * Chart series palette — 8 visually distinct colors, harmonious with the brand
 * blue (#2196f3). Chosen for max perceptual distance on light background.
 */
export const FRYER_CHART_COLORS: Record<number, string> = {
  1: '#2196f3', // brand blue
  2: '#e53935', // vivid red
  3: '#43a047', // medium green
  4: '#fb8c00', // amber
  5: '#8e24aa', // purple
  6: '#00acc1', // cyan/teal
  7: '#f06292', // pink
  8: '#6d4c41', // brown
};

const MAX_POINTS = 300;
const MIN_PHUT_GAP = 0.4; // ~24 seconds minimum gap between live appended points

function capPoints(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= MAX_POINTS) return points;
  return Array.from({ length: MAX_POINTS }, (_, i) => {
    const index = Math.round((i * (points.length - 1)) / (MAX_POINTS - 1));
    return points[index];
  });
}

/** Is a bien_du_lieu entry an init/zero record (skip it)? */
function isInitEntry(entry: BienDuLieuEntry): boolean {
  return (entry.nhiet_do ?? 0) === 0 && (entry.ap_suat_chan_khong ?? 0) === 0;
}

/** Build ChartPoint[] for temperature from a giai_doan bien_du_lieu array */
function buildPointsFromStage(
  entries: BienDuLieuEntry[],
  stage: 1 | 2 | 3 | 4,
  batchStartMs: number,
): ChartPoint[] {
  const pts: ChartPoint[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (i === 0 && isInitEntry(e)) continue;
    const ts = parseTs(e.thoi_gian);
    if (!ts) continue;
    const phut = (ts.getTime() - batchStartMs) / 60000;
    if (phut < 0) continue;
    pts.push({ phut, value: e.nhiet_do ?? 0, stage });
  }
  return pts;
}

/** Build ChartPoint[] for ap_suat_chan_khong from a giai_doan bien_du_lieu array */
function buildApPointsFromStage(
  entries: BienDuLieuEntry[],
  stage: 1 | 2 | 3 | 4,
  batchStartMs: number,
): ChartPoint[] {
  const pts: ChartPoint[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (i === 0 && isInitEntry(e)) continue;
    const ts = parseTs(e.thoi_gian);
    if (!ts) continue;
    const phut = (ts.getTime() - batchStartMs) / 60000;
    if (phut < 0) continue;
    pts.push({ phut, value: e.ap_suat_chan_khong ?? 0, stage });
  }
  return pts;
}

/** The chart starts at the first recorded sample of stage 1. */
function findBatchStartMs(doc: BatchDocument): number | null {
  const entries = doc.giai_doan_1?.bien_du_lieu ?? [];
  for (const entry of entries) {
    const ts = parseTs(entry.thoi_gian);
    if (ts) return ts.getTime();
  }
  return null;
}

function findLastRecordedStage(doc: BatchDocument): 1 | 2 | 3 | 4 | null {
  for (let g = 4 as 1 | 2 | 3 | 4; g >= 1; g--) {
    const gdKey = `giai_doan_${g}` as keyof BatchDocument;
    const gd = doc[gdKey] as { bien_du_lieu?: BienDuLieuEntry[] } | undefined;
    if (gd?.bien_du_lieu?.some((entry) => parseTs(entry.thoi_gian) !== null)) return g;
  }
  return null;
}

function buildBatchPoints(doc: BatchDocument, batchStartMs: number) {
  const tPts: ChartPoint[] = [];
  const aPts: ChartPoint[] = [];
  for (let g = 1 as 1 | 2 | 3 | 4; g <= 4; g++) {
    const gdKey = `giai_doan_${g}` as keyof BatchDocument;
    const gd = doc[gdKey] as { bien_du_lieu?: BienDuLieuEntry[] } | undefined;
    const entries = gd?.bien_du_lieu ?? [];
    tPts.push(...buildPointsFromStage(entries, g, batchStartMs));
    aPts.push(...buildApPointsFromStage(entries, g, batchStartMs));
  }
  return { tPts: capPoints(tPts), aPts: capPoints(aPts) };
}

interface LoadedBatch {
  doc: BatchDocument;
  batchStartMs: number;
  running: boolean;
  lastStage: 1 | 2 | 3 | 4 | null;
}

interface LoadResult {
  latest: LoadedBatch | null;
  previous: { doc: BatchDocument; batchStartMs: number } | null;
}

/** Load latest (running or newest) + previous batch for a machine. */
async function loadBatchHistoryDual(n: number): Promise<LoadResult> {
  try {
    const list = await getNoiChien(n);
    if (!Array.isArray(list) || list.length === 0) return { latest: null, previous: null };

    // Newest-first: scan for running batch, else use index 0
    let selectedIdx = 0;
    let running = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].thoi_gian_stop === '' || list[i].thoi_gian_stop == null) {
        selectedIdx = i;
        running = true;
        break;
      }
    }

    const selected = list[selectedIdx];
    const doc = await getNoiChienDetail(selected._id, n);
    const fallbackStart = parseTs(selected.thoi_gian_start)?.getTime() ?? null;
    const batchStartMs = findBatchStartMs(doc) ?? fallbackStart;
    if (batchStartMs == null) return { latest: null, previous: null };

    const latest: LoadedBatch = { doc, batchStartMs, running, lastStage: findLastRecordedStage(doc) };

    // Previous = next item in the newest-first list after the selected one
    let previous: LoadResult['previous'] = null;
    const prevIdx = selectedIdx + 1;
    if (prevIdx < list.length) {
      try {
        const prevItem = list[prevIdx];
        const prevDoc = await getNoiChienDetail(prevItem._id, n);
        const prevFallback = parseTs(prevItem.thoi_gian_start)?.getTime() ?? null;
        const prevStart = findBatchStartMs(prevDoc) ?? prevFallback;
        if (prevStart != null) {
          previous = { doc: prevDoc, batchStartMs: prevStart };
        }
      } catch {
        // Previous batch load failure is non-critical
      }
    }

    return { latest, previous };
  } catch {
    return { latest: null, previous: null };
  }
}

export function useFleetHistory(): FleetHistoryState {
  const [state, setState] = useState<FleetHistoryState>({
    latest: { tempSeries: [], apSeries: [] },
    previous: { tempSeries: [], apSeries: [] },
  });

  // --- Per-machine refs (latest batch) ---
  const latestBatchStartRef = useRef<Record<number, number>>({});
  const latestRunningRef = useRef<Record<number, boolean>>({});
  const lastStageRef = useRef<Record<number, 1 | 2 | 3 | 4 | null>>({});
  const revisionRef = useRef<Record<number, number>>({});
  const latestTempPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const latestApPtsRef = useRef<Record<number, ChartPoint[]>>({});

  // --- Per-machine refs (previous batch — frozen after load or promotion) ---
  const prevBatchStartRef = useRef<Record<number, number>>({});
  const prevTempPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const prevApPtsRef = useRef<Record<number, ChartPoint[]>>({});

  // --- Initialization gate ---
  const initializedRef = useRef<Record<number, boolean>>({});

  /** Rebuild React state from refs */
  const pushState = () => {
    const latestTemp: MachineSeries[] = [];
    const latestAp: MachineSeries[] = [];
    const prevTemp: MachineSeries[] = [];
    const prevAp: MachineSeries[] = [];

    for (let n = 1; n <= 8; n++) {
      const lt = latestTempPtsRef.current[n];
      const la = latestApPtsRef.current[n];
      const pt = prevTempPtsRef.current[n];
      const pa = prevApPtsRef.current[n];

      if (lt && lt.length > 0) {
        latestTemp.push({ n, color: FRYER_CHART_COLORS[n], points: [...lt] });
      }
      if (la && la.length > 0) {
        latestAp.push({ n, color: FRYER_CHART_COLORS[n], points: [...la] });
      }
      if (pt && pt.length > 0) {
        prevTemp.push({ n, color: FRYER_CHART_COLORS[n], points: [...pt] });
      }
      if (pa && pa.length > 0) {
        prevAp.push({ n, color: FRYER_CHART_COLORS[n], points: [...pa] });
      }
    }

    setState({
      latest: { tempSeries: latestTemp, apSeries: latestAp },
      previous: { tempSeries: prevTemp, apSeries: prevAp },
    });
  };

  useEffect(() => {
    const sockets: Socket[] = [];
    let cancelled = false;

    // Initial batch load for all 8 machines (parallel)
    const loadAll = async () => {
      const revisionsAtLoad = Array.from(
        { length: 8 },
        (_, i) => revisionRef.current[i + 1] ?? 0,
      );
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) => loadBatchHistoryDual(i + 1)),
      );

      if (cancelled) return;

      results.forEach((res, i) => {
        const n = i + 1;

        // Revision guard: if socket already bumped revision, discard REST result
        if ((revisionRef.current[n] ?? 0) !== revisionsAtLoad[i]) {
          // Still mark initialized so live data flows
          initializedRef.current[n] = true;
          return;
        }

        if (res.status === 'fulfilled' && res.value.latest) {
          const { latest, previous } = res.value;
          const { doc, batchStartMs, running, lastStage } = latest;

          latestBatchStartRef.current[n] = batchStartMs;
          latestRunningRef.current[n] = running;
          lastStageRef.current[n] = lastStage;

          const { tPts, aPts } = buildBatchPoints(doc, batchStartMs);
          latestTempPtsRef.current[n] = tPts;
          latestApPtsRef.current[n] = aPts;

          // Load previous batch points
          if (previous) {
            prevBatchStartRef.current[n] = previous.batchStartMs;
            const prev = buildBatchPoints(previous.doc, previous.batchStartMs);
            prevTempPtsRef.current[n] = prev.tPts;
            prevApPtsRef.current[n] = prev.aPts;
          }
        }

        // Mark initialized regardless of success/null
        initializedRef.current[n] = true;
      });

      if (!cancelled) pushState();
    };

    loadAll();

    // Open 8 sockets for live appending
    for (let n = 1; n <= 8; n++) {
      const socket = io({ forceNew: true });
      sockets.push(socket);

      socket.on('connect', () => {
        socket.emit('join_noi', String(n));
      });

      const machineN = n; // capture

      const onData = (payload: StagePayload[] | NoiChienDataPayload) => {
        if (cancelled) return;

        // TASK 1: Initialization gate — ignore socket data until REST completes
        if (!initializedRef.current[machineN]) return;

        let stages: StagePayload[];
        if (Array.isArray(payload)) {
          stages = payload;
        } else {
          stages = payload.stages;
        }
        if (!Array.isArray(stages) || stages.length === 0) return;

        const activeIdx = stages.findIndex((s) => s.active);
        if (activeIdx < 0) return;
        const stageNum = (activeIdx + 1) as 1 | 2 | 3 | 4;
        const activeStage = stages[activeIdx];
        const sensor = activeStage.data;
        const sensorTs = parseTs(sensor.thoi_gian);
        if (!sensorTs) return;

        const previousStage = lastStageRef.current[machineN];
        const startsNewBatch = stageNum === 1 && (
          !latestRunningRef.current[machineN]
          || (previousStage != null && previousStage > 1)
        );

        if (startsNewBatch) {
          // TASK 2: Move current latest → previous before resetting
          const curLatestTemp = latestTempPtsRef.current[machineN];
          const curLatestAp = latestApPtsRef.current[machineN];
          const curLatestStart = latestBatchStartRef.current[machineN];
          if (curLatestStart != null && ((curLatestTemp && curLatestTemp.length > 0) || (curLatestAp && curLatestAp.length > 0))) {
            prevBatchStartRef.current[machineN] = curLatestStart;
            prevTempPtsRef.current[machineN] = curLatestTemp ?? [];
            prevApPtsRef.current[machineN] = curLatestAp ?? [];
          }

          // Reset latest to new batch
          revisionRef.current[machineN] = (revisionRef.current[machineN] ?? 0) + 1;
          latestBatchStartRef.current[machineN] = sensorTs.getTime();
          latestRunningRef.current[machineN] = true;
          latestTempPtsRef.current[machineN] = [];
          latestApPtsRef.current[machineN] = [];
        }

        if (!latestRunningRef.current[machineN]) return;

        const batchStart = latestBatchStartRef.current[machineN];
        if (batchStart == null) return;

        const nowPhut = (sensorTs.getTime() - batchStart) / 60000;
        if (nowPhut < 0) return;
        lastStageRef.current[machineN] = stageNum;

        // --- Temperature ---
        const tPts = latestTempPtsRef.current[machineN] ?? [];
        const lastTPt = tPts[tPts.length - 1];
        if (!lastTPt || nowPhut - lastTPt.phut >= MIN_PHUT_GAP) {
          const newTPt: ChartPoint = { phut: nowPhut, value: sensor.nhiet_do ?? 0, stage: stageNum };
          latestTempPtsRef.current[machineN] = capPoints([...tPts, newTPt]);
        }

        // --- Vacuum pressure ---
        const aPts = latestApPtsRef.current[machineN] ?? [];
        const lastAPt = aPts[aPts.length - 1];
        if (!lastAPt || nowPhut - lastAPt.phut >= MIN_PHUT_GAP) {
          const newAPt: ChartPoint = { phut: nowPhut, value: sensor.ap_suat_chan_khong ?? 0, stage: stageNum };
          latestApPtsRef.current[machineN] = capPoints([...aPts, newAPt]);
        }

        pushState();
      };

      const onStop = () => {
        if (cancelled) return;
        latestRunningRef.current[machineN] = false;
        revisionRef.current[machineN] = (revisionRef.current[machineN] ?? 0) + 1;
      };

      socket.on(`noi_chien_${n}_data`, onData as (...args: unknown[]) => void);
      socket.on(`noi_chien_${n}_stop`, onStop);
    }

    return () => {
      cancelled = true;
      for (const s of sockets) s.disconnect();
    };
  }, []);

  return state;
}
