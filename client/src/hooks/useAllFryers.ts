import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
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
  targetMin: number;       // active-stage target minutes
  tongThoiGian: number;    // total run time (phút)
  sensor: SensorData | null;
}

const EMPTY: Omit<FryerStatus, 'n'> = {
  connected: false,
  running: false,
  stage: null,
  elapsedMs: 0,
  targetMin: 0,
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

/**
 * Opens one socket connection per fryer (the server rooms a socket to a single
 * fryer at a time), joins its room, and derives running/idle + current stage +
 * elapsed for the overview. Mount-scoped: all 8 connections close on unmount.
 */
export function useAllFryers(): FryerStatus[] {
  const [statuses, setStatuses] = useState<FryerStatus[]>(initStatuses);

  useEffect(() => {
    const sockets: Socket[] = [];

    for (let n = 1; n <= 8; n++) {
      const socket = io({ forceNew: true });
      sockets.push(socket);

      const patch = (upd: Partial<FryerStatus>) => {
        setStatuses((prev) => {
          const next = [...prev];
          next[n - 1] = { ...next[n - 1], ...upd };
          return next;
        });
      };

      socket.on('connect', () => {
        patch({ connected: true });
        socket.emit('join_noi', String(n));
      });
      socket.on('disconnect', () => patch({ connected: false }));

      const onData = (payload: StagePayload[] | NoiChienDataPayload) => {
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
        const running = elapsedMs !== null || activeIdx >= 0;
        const stageNum = activeIdx >= 0 ? activeIdx + 1 : null;
        const activeStage = activeIdx >= 0 ? stages[activeIdx] : null;
        const sensorSource = activeStage ?? stages[0];

        patch({
          running,
          stage: stageNum,
          elapsedMs: elapsedMs ?? 0,
          targetMin: activeStage && stageNum ? targetOf(activeStage, stageNum) : 0,
          tongThoiGian: Number(stages[0]?.tong_thoi_gian_chay) || 0,
          sensor: (sensorSource?.data as SensorData) ?? null,
        });
      };

      const onStop = () => {
        patch({ running: false, stage: null, elapsedMs: 0, targetMin: 0 });
      };

      socket.on(`noi_chien_${n}_data`, onData as (...args: unknown[]) => void);
      socket.on(`noi_chien_${n}_stop`, onStop);
    }

    return () => {
      for (const s of sockets) s.disconnect();
    };
  }, []);

  return statuses;
}
