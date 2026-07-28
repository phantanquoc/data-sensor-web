import { useEffect, useState } from 'react';
import { subscribe, unsubscribe, getSocket } from './sharedSockets';
import type {
  StagePayload,
  NoiChienDataPayload,
  SensorData,
  SetGiaiDoanStages123,
  SetGiaiDoanStage4,
} from '../types';

/** Per-machine overview status derived client-side from the existing socket contract. */
export interface FryerStatus {
  n: number;
  connected: boolean;      // socket connected to server
  running: boolean;        // a batch is active (stage_elapsed_ms !== null)
  stage: number | null;    // current active stage (1..4) or null
  elapsedMs: number;       // active-stage elapsed (server-authoritative)
  receivedAt: number;      // local time the elapsed measurement is anchored to (now - age)
  targetMin: number;       // active-stage target minutes
  targetTemperature: number | null; // active-stage temperature setpoint (stages 1..3)
  tongThoiGian: number;    // total run time (phut)
  sensor: SensorData | null;
}

const EMPTY: Omit<FryerStatus, 'n'> = {
  connected: false,
  running: false,
  stage: null,
  elapsedMs: 0,
  receivedAt: 0,
  targetMin: 0,
  targetTemperature: null,
  tongThoiGian: 0,
  sensor: null,
};

function initStatuses(): FryerStatus[] {
  return Array.from({ length: 8 }, (_, i) => ({ n: i + 1, ...EMPTY }));
}

function targetOf(stage: StagePayload, stageNum: number): number {
  if (stageNum <= 3) {
    return Number((stage.set_giai_doan as SetGiaiDoanStages123).thoi_gian_chay) || 0;
  }
  return Number((stage.set_giai_doan as SetGiaiDoanStage4).thoi_gian_treo_long) || 0;
}

function targetTemperatureOf(stage: StagePayload, stageNum: number): number | null {
  if (stageNum > 3) return null;

  const target = Number((stage.set_giai_doan as SetGiaiDoanStages123).nhiet_do_cai_dat);
  return Number.isFinite(target) ? target : null;
}

/**
 * Uses the shared socket manager (one socket per fryer, shared across hooks)
 * to derive running/idle + current stage + elapsed for the overview.
 */
export function useAllFryers(): FryerStatus[] {
  const [statuses, setStatuses] = useState<FryerStatus[]>(initStatuses);

  useEffect(() => {
    const keys: Array<{ n: number; key: symbol }> = [];

    for (let n = 1; n <= 8; n++) {
      const patch = (upd: Partial<FryerStatus>) => {
        setStatuses((prev) => {
          const next = [...prev];
          next[n - 1] = { ...next[n - 1], ...upd };
          return next;
        });
      };

      // Set initial connected state from actual socket
      const sock = getSocket(n);
      patch({ connected: sock?.connected ?? false });

      const onData = (payload: StagePayload[] | NoiChienDataPayload) => {
        let stages: StagePayload[];
        let elapsedMs: number | null;
        let ageMs = 0;
        if (Array.isArray(payload)) {
          stages = payload;
          elapsedMs = null;
        } else {
          stages = payload.stages;
          elapsedMs = payload.stage_elapsed_ms ?? null;
          ageMs = Math.max(0, payload.elapsed_age_ms ?? 0);
        }
        if (!Array.isArray(stages) || stages.length === 0) return;

        const activeIdx = stages.findIndex((s) => s.active);
        const running = elapsedMs !== null || activeIdx >= 0;
        const stageNum = activeIdx >= 0 ? activeIdx + 1 : null;
        const activeStage = activeIdx >= 0 ? stages[activeIdx] : null;
        const sensorSource = activeStage ?? stages[0];

        patch({
          running,
          stage: stageNum,
          elapsedMs: elapsedMs ?? 0,
          receivedAt: Date.now() - ageMs,
          targetMin: activeStage && stageNum ? targetOf(activeStage, stageNum) : 0,
          targetTemperature: activeStage && stageNum
            ? targetTemperatureOf(activeStage, stageNum)
            : null,
          tongThoiGian: Number(stages[0]?.tong_thoi_gian_chay) || 0,
          sensor: (sensorSource?.data as SensorData) ?? null,
        });
      };

      const onStop = () => {
        patch({
          running: false,
          stage: null,
          elapsedMs: 0,
          targetMin: 0,
          targetTemperature: null,
        });
      };

      const key = subscribe(n, [
        ['connect', (() => patch({ connected: true })) as (...args: unknown[]) => void],
        ['disconnect', (() => patch({ connected: false })) as (...args: unknown[]) => void],
        [`noi_chien_${n}_data`, onData as (...args: unknown[]) => void],
        [`noi_chien_${n}_stop`, onStop as (...args: unknown[]) => void],
      ]);
      keys.push({ n, key });
    }

    return () => {
      for (const { n, key } of keys) {
        unsubscribe(n, key);
      }
    };
  }, []);

  return statuses;
}