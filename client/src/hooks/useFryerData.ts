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
 * Seed the donut startMs so that displayed elapsed = tsLast − tsFirst (the DB
 * span of the stage's recorded data). This is a frozen snapshot: if the batch
 * stops updating (HMI disconnect, batch ended without stop event), the elapsed
 * time freezes at the last known span rather than counting wall-clock forward.
 *
 * Algorithm (mirrors EJS `seedStartMsFromDoc` in view_home.ejs):
 *   first = bien_du_lieu[1]  (skip [0] init row)
 *   last  = bien_du_lieu[length - 1]
 *   elapsedAtSeed = tsLast - tsFirst  (clamped >= 0)
 *   startMs = Date.now() - elapsedAtSeed
 *
 * The donut then computes elapsed = now - startMs = elapsedAtSeed at seed time,
 * and counts forward from there while live ticks keep arriving.
 *
 * Returns null when the doc can't provide a valid seed (caller falls back to
 * Date.now(), yielding elapsed = 0 for a stage that only just went active).
 */
function seedStartMsFromDoc(doc: BatchDocument | null, gNum: number): number | null {
  if (!doc) return null;
  const gdKey = `giai_doan_${gNum}` as keyof BatchDocument;
  const gd = doc[gdKey] as { bien_du_lieu?: Array<{ thoi_gian?: string }> } | undefined;
  if (!gd || !Array.isArray(gd.bien_du_lieu) || gd.bien_du_lieu.length < 2) return null;
  const first = gd.bien_du_lieu[1]; // skip [0] init record
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
  startMs: number;
  targetMin: number;
}

export interface FryerState {
  stages: StagePayload[];
  batchList: BatchListItem[];
  batchDetail: BatchDocument | null;
  donut: DonutState;
}

export function useFryerData() {
  const [stages, setStages] = useState<StagePayload[]>(makeResetStages());
  const [batchList, setBatchList] = useState<BatchListItem[]>([]);
  const [batchDetail, setBatchDetail] = useState<BatchDocument | null>(null);
  const [donut, setDonut] = useState<DonutState>({ stage: null, startMs: 0, targetMin: 0 });

  const currentRunningDocRef = useRef<BatchDocument | null>(null);
  const donutRef = useRef<DonutState>({ stage: null, startMs: 0, targetMin: 0 });

  const resetView = useCallback(() => {
    setStages(makeResetStages());
    donutRef.current = { stage: null, startMs: 0, targetMin: 0 };
    setDonut({ stage: null, startMs: 0, targetMin: 0 });
    currentRunningDocRef.current = null;
  }, []);

  /** Process a single stage payload (same logic as realTimer_he_chien) */
  const processStage = useCallback((stagePayload: StagePayload) => {
    const stageNum = parseInt(stagePayload.giai_doan.replace('Giai đoạn: ', ''), 10);
    if (isNaN(stageNum) || stageNum < 1 || stageNum > 4) return;

    setStages((prev) => {
      const next = [...prev];
      next[stageNum - 1] = stagePayload;
      return next;
    });

    // Donut logic
    if (stagePayload.active) {
      let targetMin: number;
      if (stageNum <= 3) {
        targetMin = Number((stagePayload.set_giai_doan as SetGiaiDoanStages123).thoi_gian_chay) || 0;
      } else {
        targetMin = Number((stagePayload.set_giai_doan as SetGiaiDoanStage4).thoi_gian_treo_long) || 0;
      }

      if (donutRef.current.stage !== stageNum) {
        // Stage transition: seed once from the running doc's DB span.
        const startMs = seedStartMsFromDoc(currentRunningDocRef.current, stageNum) ?? Date.now();
        donutRef.current = { stage: stageNum, startMs, targetMin };
        setDonut({ stage: stageNum, startMs, targetMin });
      } else {
        // Same stage: only update targetMin (startMs stays fixed so the live
        // timer counts forward from the seeded point — matches EJS behavior).
        donutRef.current.targetMin = targetMin;
        setDonut((prev) => ({ ...prev, targetMin }));
      }
    } else {
      if (donutRef.current.stage === stageNum) {
        donutRef.current = { stage: null, startMs: 0, targetMin: 0 };
        setDonut({ stage: null, startMs: 0, targetMin: 0 });
      }
    }
  }, []);

  /** Handle full data event (array of 4 stages) */
  const handleDataEvent = useCallback((stagesArray: StagePayload[]) => {
    for (const s of stagesArray) {
      processStage(s);
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
      // Retain running doc for donut seeding only when batch is running
      currentRunningDocRef.current = running ? fullDoc : null;

      // Rebuild 4 stage payloads from the document
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
