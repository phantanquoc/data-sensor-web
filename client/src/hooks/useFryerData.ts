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
 * Anchor the donut to the stage's real start time so elapsed = now - stageStart.
 *
 * The original algorithm seeded elapsed = (last DB record - first DB record),
 * which froze at the last 15s push and reset toward 0 on every tab switch.
 * Instead we anchor startMs to the stage's first real record ([1], skipping the
 * empty [0] init row). tsFirst is constant, so re-seeding on tab switch is
 * idempotent — the timer keeps counting from the true stage start, never resets.
 *
 * Returns the anchor startMs, or null when the doc can't provide one (caller
 * then falls back to Date.now() for a stage that only just went active live).
 */
function seedStartMsFromDoc(doc: BatchDocument | null, gNum: number): number | null {
  if (!doc) return null;
  const gdKey = `giai_doan_${gNum}` as keyof BatchDocument;
  const gd = doc[gdKey] as { bien_du_lieu?: Array<{ thoi_gian?: string }> } | undefined;
  if (!gd || !Array.isArray(gd.bien_du_lieu) || gd.bien_du_lieu.length < 2) return null;
  const first = gd.bien_du_lieu[1]; // skip [0] init record (empty thoi_gian)
  const tsFirst = parseTs(first.thoi_gian);
  if (!tsFirst) return null;
  const startMs = tsFirst.getTime();
  // Guard against clock skew putting the anchor in the future.
  return startMs > Date.now() ? Date.now() : startMs;
}

export interface DonutState {
  stage: number | null;
  startMs: number;
  targetMin: number;
  /** true once startMs was anchored from the DB doc (not a live fallback) */
  seededFromDoc?: boolean;
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
        // Stage transition (or first tick after a tab switch).
        const anchored = seedStartMsFromDoc(currentRunningDocRef.current, stageNum);
        // If the doc anchor isn't available yet (async auto-load still in
        // flight), fall back to now and DON'T drop the doc — a later tick will
        // re-anchor once it loads, self-correcting the race.
        const seededFromDoc = anchored !== null;
        const startMs = anchored ?? Date.now();
        donutRef.current = { stage: stageNum, startMs, targetMin, seededFromDoc };
        setDonut({ stage: stageNum, startMs, targetMin });
      } else {
        // Same stage. Re-anchor if we only had a live fallback and the running
        // doc has since loaded (fixes elapsed jumping to ~0 on tab switch).
        if (!donutRef.current.seededFromDoc) {
          const anchored = seedStartMsFromDoc(currentRunningDocRef.current, stageNum);
          if (anchored !== null) {
            donutRef.current.startMs = anchored;
            donutRef.current.seededFromDoc = true;
            setDonut((prev) => ({ ...prev, startMs: anchored }));
          }
        }
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
