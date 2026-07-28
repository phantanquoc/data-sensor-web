/**
 * useFleetHistory — loads full batch history + live socket ticks for a
 * configurable list of machines (default: all 8). Returns two batch-scoped
 * series sets (latest + previous) for the FleetLineChart component.
 *
 * Used by:
 *  - Overview page (all 8 machines)
 *  - Per-machine detail page (single machine, e.g. `useFleetHistory([3])`)
 *
 * Design decisions:
 *  - Uses shared socket manager instead of opening its own 8 connections.
 *  - Uses /get_noi_chien_chart endpoint for initial REST load (lighter payload).
 *  - Capped at MAX_POINTS per machine with even downsampling.
 *  - Live points appended only when MIN_PHUT_GAP elapsed since last point.
 *  - X values use only backend-generated timestamps.
 *  - Initialization gate: socket data is ignored until REST load completes for
 *    each machine, preventing desync of batchStart when socket fires before REST.
 *  - Dual-batch: tracks both the latest and previous batch per machine so the
 *    Overview can toggle between the current and the preceding batch.
 *  - Stable key derivation: the tracked machine list is sanitized and turned
 *    into a primitive string key for the effect dependency array, preventing
 *    infinite re-runs when the caller passes a fresh array literal each render.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribe, unsubscribe } from './sharedSockets';
import { getNoiChien, getNoiChienDetail } from '../api';
import { parseTs } from './timeUtils';
import { decideRotation, REANCHOR_TOL_MS } from './batchRotation';
import { sanitizeMachineList, machineListKey } from './machineList';

export { sanitizeMachineList, machineListKey } from './machineList';
import type {
  StagePayload,
  NoiChienDataPayload,
  BienDuLieuEntry,
  BatchDocument,
  SetGiaiDoanStages123,
} from '../types';
import { buildBatchSetpointPoints, isLiveSetpointValid } from './setpointBuilder';

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
  latest: { tempSeries: MachineSeries[]; apSeries: MachineSeries[]; setpointSeries: MachineSeries[] };
  previous: { tempSeries: MachineSeries[]; apSeries: MachineSeries[]; setpointSeries: MachineSeries[] };
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

/**
 * Nạp lại mẻ mới: backend chỉ $push 1 điểm mỗi 5 cycle, nên điểm gd1 đầu tiên
 * xuất hiện muộn — đo trên 23 mẻ gần nhất: min 3s, trung vị 49s, max 129s.
 * Cửa sổ 8 lượt × 20s = 0..160s phủ hết khoảng đó.
 */
const REFETCH_ATTEMPTS = 8;
const REFETCH_DELAY_MS = 20_000;

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
  // Setpoint: chỉ stages 1-3 (stage 4 không có setpoint)
  const spStages: Array<{ entries: BienDuLieuEntry[]; stage: 1 | 2 | 3 }> = [];
  for (let g = 1 as 1 | 2 | 3; g <= 3; g++) {
    const gdKey = `giai_doan_${g}` as keyof BatchDocument;
    const gd = doc[gdKey] as { bien_du_lieu?: BienDuLieuEntry[] } | undefined;
    spStages.push({ entries: gd?.bien_du_lieu ?? [], stage: g });
  }
  const spPts = buildBatchSetpointPoints(spStages, batchStartMs);
  return { tPts: capPoints(tPts), aPts: capPoints(aPts), spPts: capPoints(spPts as ChartPoint[]) };
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


export function useFleetHistory(machines?: number[]): FleetHistoryState {
  // Sanitize + derive stable key so effect deps are a primitive string
  const trackedMachines = useMemo(() => sanitizeMachineList(machines), [machines]);
  const stableKey = useMemo(() => machineListKey(trackedMachines), [trackedMachines]);

  const [state, setState] = useState<FleetHistoryState>({
    latest: { tempSeries: [], apSeries: [], setpointSeries: [] },
    previous: { tempSeries: [], apSeries: [], setpointSeries: [] },
  });

  // --- Per-machine refs (latest batch) ---
  const latestBatchStartRef = useRef<Record<number, number>>({});
  const latestRunningRef = useRef<Record<number, boolean>>({});
  const lastStageRef = useRef<Record<number, 1 | 2 | 3 | 4 | null>>({});
  const lastElapsedRef = useRef<Record<number, number | null>>({});
  const revisionRef = useRef<Record<number, number>>({});
  const latestTempPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const latestApPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const latestSpPtsRef = useRef<Record<number, ChartPoint[]>>({});

  // --- Per-machine refs (previous batch) ---
  const prevBatchStartRef = useRef<Record<number, number>>({});
  const prevTempPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const prevApPtsRef = useRef<Record<number, ChartPoint[]>>({});
  const prevSpPtsRef = useRef<Record<number, ChartPoint[]>>({});

  // --- Initialization gate ---
  const initializedRef = useRef<Record<number, boolean>>({});

  /** Rebuild React state from refs — only emits series for tracked machines. */
  const pushState = (tracked: number[]) => {
    const latestTemp: MachineSeries[] = [];
    const latestAp: MachineSeries[] = [];
    const latestSp: MachineSeries[] = [];
    const prevTemp: MachineSeries[] = [];
    const prevAp: MachineSeries[] = [];
    const prevSp: MachineSeries[] = [];

    for (const n of tracked) {
      const lt = latestTempPtsRef.current[n];
      const la = latestApPtsRef.current[n];
      const lsp = latestSpPtsRef.current[n];
      const pt = prevTempPtsRef.current[n];
      const pa = prevApPtsRef.current[n];
      const psp = prevSpPtsRef.current[n];

      if (lt && lt.length > 0) {
        latestTemp.push({ n, color: FRYER_CHART_COLORS[n], points: [...lt] });
      }
      if (la && la.length > 0) {
        latestAp.push({ n, color: FRYER_CHART_COLORS[n], points: [...la] });
      }
      if (lsp && lsp.length > 0) {
        latestSp.push({ n, color: FRYER_CHART_COLORS[n], points: [...lsp] });
      }
      if (pt && pt.length > 0) {
        prevTemp.push({ n, color: FRYER_CHART_COLORS[n], points: [...pt] });
      }
      if (pa && pa.length > 0) {
        prevAp.push({ n, color: FRYER_CHART_COLORS[n], points: [...pa] });
      }
      if (psp && psp.length > 0) {
        prevSp.push({ n, color: FRYER_CHART_COLORS[n], points: [...psp] });
      }
    }

    setState({
      latest: { tempSeries: latestTemp, apSeries: latestAp, setpointSeries: latestSp },
      previous: { tempSeries: prevTemp, apSeries: prevAp, setpointSeries: prevSp },
    });
  };

  useEffect(() => {
    // Danh sách máy theo dõi hiện tại — parse lại từ stableKey vì effect
    // chỉ thấy key primitive, không thấy trackedMachines (closure tham chiếu cũ).
    const tracked = stableKey.split(',').map(Number);

    // --- Reset refs cho các máy đang theo dõi khi key đổi (chuyển máy trên
    // trang chi tiết hoặc mount lần đầu). Việc này đảm bảo dữ liệu cũ của máy
    // trước không lọt vào series mới. Đối với Overview (key cố định "1,2,...,8")
    // effect chỉ chạy 1 lần nên reset này không ảnh hưởng. ---
    for (const n of tracked) {
      delete latestBatchStartRef.current[n];
      delete latestRunningRef.current[n];
      delete lastStageRef.current[n];
      delete lastElapsedRef.current[n];
      delete latestTempPtsRef.current[n];
      delete latestApPtsRef.current[n];
      delete latestSpPtsRef.current[n];
      delete prevBatchStartRef.current[n];
      delete prevTempPtsRef.current[n];
      delete prevApPtsRef.current[n];
      delete prevSpPtsRef.current[n];
      delete initializedRef.current[n];
      revisionRef.current[n] = 0;
    }
    // Xoá state React ngay để UI không hiện dữ liệu máy cũ trong lúc REST load.
    setState({
      latest: { tempSeries: [], apSeries: [], setpointSeries: [] },
      previous: { tempSeries: [], apSeries: [], setpointSeries: [] },
    });

    const subKeys: Array<{ n: number; key: symbol }> = [];
    let cancelled = false;
    /** Máy đang có một lượt nạp lại mẻ mới đang bay → không gọi thêm. */
    const refetching: Record<number, boolean> = {};

    /**
     * Nạp lại mẻ đang chạy của MỘT máy sau khi nó sang mẻ mới.
     *
     * Backend đã ghi sẵn các điểm đầu mẻ, nên đọc lại cho ra đường liền ngay
     * thay vì chờ tick live tích đủ. Bỏ kết quả nếu trong lúc request bay máy
     * lại sang mẻ khác nữa (revision đổi) — lúc đó payload đã lỗi thời.
     */
    const refetchLatest = async (n: number, expectedMark: number) => {
      if (refetching[n]) return;
      refetching[n] = true;
      const revAtLoad = revisionRef.current[n] ?? 0;
      try {
        // Backend phát socket TRƯỚC khi tạo document mẻ mới, nên lần đọc đầu có
        // thể còn thấy mẻ cũ. Thử vài lượt cách nhau, nhận lượt nào trả về mẻ
        // có mốc khớp mốc đang vẽ.
        for (let attempt = 0; attempt < REFETCH_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, REFETCH_DELAY_MS));
          }
          if (cancelled) return;
          // Máy lại sang mẻ khác nữa → lượt nạp này đã lỗi thời.
          if ((revisionRef.current[n] ?? 0) !== revAtLoad) return;

          const res = await loadBatchHistoryDual(n);
          if (cancelled) return;
          if ((revisionRef.current[n] ?? 0) !== revAtLoad) return;
          if (!res.latest) continue;

          const { doc, batchStartMs, lastStage } = res.latest;
          // Mốc phải khớp mẻ đang vẽ, nếu không đây vẫn là mẻ cũ.
          if (Math.abs(batchStartMs - expectedMark) > REANCHOR_TOL_MS) continue;

          const built = buildBatchPoints(doc, batchStartMs);
          // Chỉ nhận khi REST cho nhiều điểm hơn tick live đã tích được, để
          // không làm mất điểm mới hơn mà REST chưa kịp thấy. Chưa đủ thì thử
          // lượt sau, vì backend còn đang ghi dần điểm đầu mẻ.
          if (built.tPts.length <= (latestTempPtsRef.current[n]?.length ?? 0)) continue;

          latestBatchStartRef.current[n] = batchStartMs;
          lastStageRef.current[n] = lastStage;
          latestTempPtsRef.current[n] = built.tPts;
          latestApPtsRef.current[n] = built.aPts;
          latestSpPtsRef.current[n] = built.spPts;
          pushState(tracked);
          return;
        }
      } catch {
        // Nạp lại thất bại thì tick live vẫn tự tích điểm như trước.
      } finally {
        refetching[n] = false;
      }
    };

    // Initial batch load for tracked machines (parallel)
    const loadAll = async () => {
      // Ghi lại revision tại thời điểm gọi, key theo số máy (không dùng index
      // positional) để stale-load guard so đúng revision của MÁY đó, không bị lệch
      // khi danh sách tracked < 8 máy.
      const revisionsAtLoad: Record<number, number> = {};
      for (const n of tracked) {
        revisionsAtLoad[n] = revisionRef.current[n] ?? 0;
      }
      const results = await Promise.allSettled(
        tracked.map((n) => loadBatchHistoryDual(n)),
      );

      if (cancelled) return;

      results.forEach((res, i) => {
        const n = tracked[i];

        // Mẻ MỚI đã bắt đầu trong lúc request còn bay (revision đổi) → payload
        // REST thuộc mẻ CŨ. Nạp vào `latest` sẽ trộn hai mẻ và làm lệch mốc
        // batchStart mà tick live đã đặt cho mẻ mới. Nhưng cũng không nên bỏ
        // đi: mẻ cũ chính là "Mẻ trước" của hệ này. Đưa xuống slot previous,
        // để `latest` cho tick live dựng.
        const staleLoad = (revisionRef.current[n] ?? 0) !== revisionsAtLoad[n];

        if (res.status === 'fulfilled' && res.value.latest) {
          const { latest, previous } = res.value;
          const { doc, batchStartMs, running, lastStage } = latest;
          const built = buildBatchPoints(doc, batchStartMs);

          if (staleLoad) {
            // Chỉ điền previous nếu tick live chưa tự đẩy mẻ cũ xuống đó.
            if ((prevTempPtsRef.current[n]?.length ?? 0) === 0
              && (prevApPtsRef.current[n]?.length ?? 0) === 0) {
              prevBatchStartRef.current[n] = batchStartMs;
              prevTempPtsRef.current[n] = built.tPts;
              prevApPtsRef.current[n] = built.aPts;
              prevSpPtsRef.current[n] = built.spPts;
            }
          } else {
            latestBatchStartRef.current[n] = batchStartMs;
            latestRunningRef.current[n] = running;
            lastStageRef.current[n] = lastStage;
            latestTempPtsRef.current[n] = built.tPts;
            latestApPtsRef.current[n] = built.aPts;
            latestSpPtsRef.current[n] = built.spPts;

            if (previous) {
              prevBatchStartRef.current[n] = previous.batchStartMs;
              const prev = buildBatchPoints(previous.doc, previous.batchStartMs);
              prevTempPtsRef.current[n] = prev.tPts;
              prevApPtsRef.current[n] = prev.aPts;
              prevSpPtsRef.current[n] = prev.spPts;
            }
          }
        }

        initializedRef.current[n] = true;
      });

      if (!cancelled) pushState(tracked);
    };

    loadAll();

    // Subscribe to shared sockets for live appending — only tracked machines
    for (const machineN of tracked) {

      const onData = (payload: StagePayload[] | NoiChienDataPayload) => {
        if (cancelled) return;
        if (!initializedRef.current[machineN]) return;

        let stages: StagePayload[];
        let elapsedMs: number | null;
        if (Array.isArray(payload)) {
          stages = payload;
          elapsedMs = null;
        } else {
          stages = payload.stages;
          elapsedMs = payload.stage_elapsed_ms ?? null;
        }
        if (!Array.isArray(stages) || stages.length === 0) return;

        const activeIdx = stages.findIndex((s) => s.active);
        if (activeIdx < 0) return;
        const stageNum = (activeIdx + 1) as 1 | 2 | 3 | 4;
        const activeStage = stages[activeIdx];
        const sensor = activeStage.data;
        const sensorTs = parseTs(sensor.thoi_gian);
        if (!sensorTs) return;

        const { startsNewBatch, serverBatchStart } = decideRotation({
          stageNum,
          elapsedMs,
          sensorTsMs: sensorTs.getTime(),
          currentMark: latestBatchStartRef.current[machineN] ?? null,
          running: latestRunningRef.current[machineN] ?? false,
          previousStage: lastStageRef.current[machineN] ?? null,
          prevElapsed: lastElapsedRef.current[machineN] ?? null,
        });

        if (startsNewBatch) {
          // Một máy sang mẻ mới → mẻ hiện tại CỦA MÁY ĐÓ tụt xuống "Mẻ trước",
          // các máy khác không bị ảnh hưởng. Hai mẻ do đó chạy song song trên
          // hai tab của biểu đồ.
          //
          // Trước đây bước này bị chặn bởi !firstTick, nên mẻ vừa tải bằng REST
          // bị xoá trắng mà không sang được "Mẻ trước" nếu tick live ĐẦU TIÊN
          // của máy đã là mẻ mới — đúng tình huống mở trang ngay lúc đổi mẻ.
          const curLatestTemp = latestTempPtsRef.current[machineN];
          const curLatestAp = latestApPtsRef.current[machineN];
          const curLatestSp = latestSpPtsRef.current[machineN];
          const curLatestStart = latestBatchStartRef.current[machineN];
          const hasCurrent = (curLatestTemp?.length ?? 0) > 0 || (curLatestAp?.length ?? 0) > 0;
          if (curLatestStart != null && hasCurrent) {
            prevBatchStartRef.current[machineN] = curLatestStart;
            prevTempPtsRef.current[machineN] = curLatestTemp ?? [];
            prevApPtsRef.current[machineN] = curLatestAp ?? [];
            prevSpPtsRef.current[machineN] = curLatestSp ?? [];
          }

          revisionRef.current[machineN] = (revisionRef.current[machineN] ?? 0) + 1;
          latestBatchStartRef.current[machineN] = serverBatchStart ?? sensorTs.getTime();
          latestRunningRef.current[machineN] = true;
          latestTempPtsRef.current[machineN] = [];
          latestApPtsRef.current[machineN] = [];
          latestSpPtsRef.current[machineN] = [];

          // Nạp lại mẻ mới từ REST. Nếu chỉ tích bằng tick live thì với
          // MIN_PHUT_GAP=0.4 phải mất ~48 giây mới đủ 2 điểm để vẽ được một
          // đoạn đường — 8 máy sang mẻ mới lệch nhau vài phút sẽ làm các đường
          // biến mất lần lượt. Backend đã ghi sẵn điểm của mẻ mới, đọc lại là
          // đường liền ngay.
          void refetchLatest(machineN, latestBatchStartRef.current[machineN]);
        }

        if (!latestRunningRef.current[machineN]) return;

        const batchStart = latestBatchStartRef.current[machineN];
        if (batchStart == null) return;

        const nowPhut = (sensorTs.getTime() - batchStart) / 60000;
        if (nowPhut < 0) return;
        lastStageRef.current[machineN] = stageNum;
        lastElapsedRef.current[machineN] = elapsedMs;

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

        // --- Setpoint (chỉ stages 1-3, bỏ qua giá trị 0/missing) ---
        const spSetGd = activeStage.set_giai_doan as SetGiaiDoanStages123 | undefined;
        const spVal = spSetGd?.nhiet_do_cai_dat;
        if (isLiveSetpointValid(stageNum, spVal)) {
          const spPts = latestSpPtsRef.current[machineN] ?? [];
          const lastSPt = spPts[spPts.length - 1];
          if (!lastSPt || nowPhut - lastSPt.phut >= MIN_PHUT_GAP) {
            const newSPt: ChartPoint = { phut: nowPhut, value: spVal as number, stage: stageNum as 1 | 2 | 3 };
            latestSpPtsRef.current[machineN] = capPoints([...spPts, newSPt]);
          }
        }

        pushState(tracked);
      };

      const onStop = () => {
        if (cancelled) return;
        // Chỉ hạ cờ đang chạy. KHÔNG tăng revision: revision là tín hiệu "dữ
        // liệu REST đang tải đã lỗi thời vì mẻ khác đã bắt đầu". Mẻ dừng không
        // làm dữ liệu đã tải sai — mẻ vừa dừng chính là mẻ cần vẽ. Tăng ở đây
        // khiến guard trong loadAll xoá sạch payload REST của hệ đó nếu stop
        // rơi đúng lúc request còn bay, và hệ đó biến mất khỏi biểu đồ dù
        // legend vẫn hiện tên.
        latestRunningRef.current[machineN] = false;
      };

      const key = subscribe(machineN, [
        [`noi_chien_${machineN}_data`, onData as (...args: unknown[]) => void],
        [`noi_chien_${machineN}_stop`, onStop as (...args: unknown[]) => void],
      ]);
      subKeys.push({ n: machineN, key });
    }

    return () => {
      cancelled = true;
      for (const { n, key } of subKeys) {
        unsubscribe(n, key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  return state;
}
