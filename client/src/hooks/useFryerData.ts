import { useCallback, useRef, useState } from 'react';
import type { StagePayload, BatchDocument, BatchListItem, SensorData, SetGiaiDoanStages123, SetGiaiDoanStage4 } from '../types';
import { getNoiChien, getNoiChienDetail } from '../api';
import { parseTs } from './timeUtils';

const ZERO_SENSOR: SensorData = {
  ap_suat_vo_hoi: 0,
  ap_suat_chan_khong: 0,
  ap_suat_vong_nuoc: 0,
  nhiet_do: 0,
  dong_dien_dong_co_root: 0,
  dong_dien_dong_co_vong_nuoc: 0,
  nhiet_do_vao_binh_sinh_han: 0,
  nhiet_do_ra_binh_sinh_han: 0,
  nhiet_do_vao_bom_vong_nuoc: 0,
  nhiet_do_ra_bom_vong_nuoc: 0,
};

const ZERO_SET_GD_123: SetGiaiDoanStages123 = {
  thoi_gian_chay: 0,
  so_lan_nhung: 0,
  thoi_gian_nhung: 0,
  thoi_gian_lap_lai: 0,
  nhiet_do_cai_dat: 0,
  vi_tri_muc_dau: 0,
};

const ZERO_SET_GD_4: SetGiaiDoanStage4 = {
  thoi_gian_treo_long: 0,
};

function makeResetStages(): StagePayload[] {
  return [
    { data: { ...ZERO_SENSOR }, giai_doan: 'Giai đoạn:', active: false, tong_thoi_gian_chay: 0, set_giai_doan: { ...ZERO_SET_GD_123 } },
    { data: { ...ZERO_SENSOR }, giai_doan: 'Giai đoạn:', active: false, tong_thoi_gian_chay: 0, set_giai_doan: { ...ZERO_SET_GD_123 } },
    { data: { ...ZERO_SENSOR }, giai_doan: 'Giai đoạn:', active: false, tong_thoi_gian_chay: 0, set_giai_doan: { ...ZERO_SET_GD_123 } },
    { data: { ...ZERO_SENSOR }, giai_doan: 'Giai đoạn:', active: false, tong_thoi_gian_chay: 0, set_giai_doan: { ...ZERO_SET_GD_4 } },
  ];
}

/**
 * Backward-compat fallback: seed donut startMs from document when server does
 * not provide stage_elapsed_ms (old server). Returns null when unavailable.
 */
function seedStartMsFromDoc(doc: BatchDocument | null, gNum: number): number | null {
  if (!doc) return null;
  const gdKey = `giai_doan_${gNum}` as keyof BatchDocument;
  const gd = doc[gdKey] as { bien_du_lieu?: Array<{ thoi_gian?: string }> } | undefined;
  if (!gd || !Array.isArray(gd.bien_du_lieu) || gd.bien_du_lieu.length < 2) return null;
  const first = gd.bien_du_lieu[1];
  const last = gd.bien_du_lieu[gd.bien_du_lieu.length - 1];
  const tsFirst = parseTs(first.thoi_gian);
  const tsLast = parseTs(last.thoi_gian);
  if (!tsFirst || !tsLast) return null;
  let elapsedAtSeed = tsLast.getTime() - tsFirst.getTime();
  if (elapsedAtSeed < 0) elapsedAtSeed = 0;
  return Date.now() - elapsedAtSeed;
}

export interface DonutState {
  stage: number | null;
  elapsedMs: number;
  receivedAt: number;
  targetMin: number;
}

export interface FryerState {
  stages: StagePayload[];
  batchList: BatchListItem[];
  batchDetail: BatchDocument | null;
  donut: DonutState;
}

const DONUT_ZERO: DonutState = { stage: null, elapsedMs: 0, receivedAt: 0, targetMin: 0 };

export function useFryerData() {
  const [stages, setStages] = useState<StagePayload[]>(makeResetStages());
  const [batchList, setBatchList] = useState<BatchListItem[]>([]);
  const [batchDetail, setBatchDetail] = useState<BatchDocument | null>(null);
  const [donut, setDonut] = useState<DonutState>(DONUT_ZERO);

  const currentRunningDocRef = useRef<BatchDocument | null>(null);
  const donutRef = useRef<DonutState>(DONUT_ZERO);
  // Fallback-only anchor: the seeded stage start used when the server does not
  // provide stage_elapsed_ms. Elapsed is recomputed from it on every tick so the
  // donut keeps counting forward (not frozen at the rising-edge value).
  const fallbackStartMsRef = useRef<number | null>(null);

  const resetView = useCallback(() => {
    setStages(makeResetStages());
    donutRef.current = DONUT_ZERO;
    setDonut(DONUT_ZERO);
    currentRunningDocRef.current = null;
    fallbackStartMsRef.current = null;
  }, []);

  /** Process a single stage payload (updates stages state + donut for backward-compat fallback) */
  const processStage = useCallback((stagePayload: StagePayload, stageElapsedMs?: number | null) => {
    const stageNum = parseInt(stagePayload.giai_doan.replace('Giai đoạn: ', ''), 10);
    if (isNaN(stageNum) || stageNum < 1 || stageNum > 4) return;

    setStages((prev) => {
      const next = [...prev];
      next[stageNum - 1] = stagePayload;
      return next;
    });

    // Donut logic — server-authoritative path when stageElapsedMs is provided
    if (stagePayload.active) {
      let targetMin: number;
      if (stageNum <= 3) {
        targetMin = Number((stagePayload.set_giai_doan as SetGiaiDoanStages123).thoi_gian_chay) || 0;
      } else {
        targetMin = Number((stagePayload.set_giai_doan as SetGiaiDoanStage4).thoi_gian_treo_long) || 0;
      }

      if (typeof stageElapsedMs === 'number') {
        // Server-authoritative: use server-provided elapsed
        const newDonut: DonutState = { stage: stageNum, elapsedMs: stageElapsedMs, receivedAt: Date.now(), targetMin };
        donutRef.current = newDonut;
        setDonut(newDonut);
      } else {
        // Backward-compat fallback: derive elapsed from a document-seeded anchor
        // (old server without stage_elapsed_ms). Seed the anchor once on the
        // stage rising edge, then recompute elapsed = now - anchor every tick so
        // the donut counts forward instead of freezing at the seed value.
        if (donutRef.current.stage !== stageNum) {
          fallbackStartMsRef.current =
            seedStartMsFromDoc(currentRunningDocRef.current, stageNum) ?? Date.now();
        }
        const startMs = fallbackStartMsRef.current ?? Date.now();
        const elapsed = Math.max(0, Date.now() - startMs);
        const newDonut: DonutState = { stage: stageNum, elapsedMs: elapsed, receivedAt: Date.now(), targetMin };
        donutRef.current = newDonut;
        setDonut(newDonut);
      }
    } else {
      if (donutRef.current.stage === stageNum) {
        donutRef.current = DONUT_ZERO;
        setDonut(DONUT_ZERO);
        fallbackStartMsRef.current = null;
      }
    }
  }, []);

  /** Handle full data event (array of 4 stages + optional server elapsed) */
  const handleDataEvent = useCallback((stagesArray: StagePayload[], stageElapsedMs?: number | null) => {
    for (const s of stagesArray) {
      processStage(s, stageElapsedMs);
    }
  }, [processStage]);

  /** Port auto_load_noi_chien */
  const autoLoad = useCallback(async (n: number) => {
    try {
      const documents = await getNoiChien(n);
      if (!Array.isArray(documents)) return;
      setBatchList(documents);

      if (documents.length === 0) {
        resetView();
        return;
      }

      // Pick newest running (reverse scan for empty thoi_gian_stop) else newest
      let running: BatchListItem | null = null;
      for (let i = documents.length - 1; i >= 0; i--) {
        if (documents[i].thoi_gian_stop === '' || documents[i].thoi_gian_stop == null) {
          running = documents[i];
          break;
        }
      }
      const chosen = running || documents[documents.length - 1];

      const fullDoc = await getNoiChienDetail(chosen._id, n);
      // Retain running doc for backward-compat donut seeding only when batch is running
      currentRunningDocRef.current = running ? fullDoc : null;

      // Rebuild 4 stage payloads from the document (static snapshot, no donut)
      const lastOf = (gd: { bien_du_lieu?: Array<Record<string, unknown>> }) =>
        gd && Array.isArray(gd.bien_du_lieu) && gd.bien_du_lieu.length
          ? gd.bien_du_lieu[gd.bien_du_lieu.length - 1]
          : { ...ZERO_SENSOR };

      for (let g = 1; g <= 3; g++) {
        const gdKey = `giai_doan_${g}` as 'giai_doan_1' | 'giai_doan_2' | 'giai_doan_3';
        const gd = fullDoc[gdKey] || { bien_du_lieu: [] };
        processStage({
          data: lastOf(gd) as StagePayload['data'],
          giai_doan: `Giai đoạn: ${g}`,
          active: false,
          tong_thoi_gian_chay: fullDoc.tong_thoi_gian_chay,
          set_giai_doan: {
            thoi_gian_chay: gd.thoi_gian_chay,
            so_lan_nhung: gd.so_lan_nhung,
            thoi_gian_nhung: gd.thoi_gian_nhung,
            thoi_gian_lap_lai: gd.thoi_gian_lap_lai,
            nhiet_do_cai_dat: gd.nhiet_do_cai_dat,
            vi_tri_muc_dau: gd.vi_tri_dung,
          },
        });
      }

      const gd4 = fullDoc.giai_doan_4 || { bien_du_lieu: [] };
      processStage({
        data: lastOf(gd4) as StagePayload['data'],
        giai_doan: 'Giai đoạn: 4',
        active: false,
        tong_thoi_gian_chay: fullDoc.tong_thoi_gian_chay,
        set_giai_doan: {
          thoi_gian_treo_long: gd4.thoi_gian_treo_long ?? gd4.thoi_gian_treo_long_gd_4 ?? 0,
        },
      });
    } catch (err) {
      console.log('auto_load_noi_chien error:', err);
      resetView();
    }
  }, [processStage, resetView]);

  return {
    stages,
    batchList,
    setBatchList,
    batchDetail,
    setBatchDetail,
    donut,
    resetView,
    handleDataEvent,
    autoLoad,
  };
}
