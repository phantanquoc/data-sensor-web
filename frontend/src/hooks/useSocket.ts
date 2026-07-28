import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { StagePayload, NoiChienDataPayload } from '../types';

interface UseSocketOptions {
  soNoiChien: string;
  onData: (stages: StagePayload[], stageElapsedMs?: number | null, elapsedAgeMs?: number) => void;
  onStop: () => void;
}

export function useSocket({ soNoiChien, onData, onStop }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  // Always holds the currently active fryer so the (mount-scoped) connect
  // handler re-joins the correct room on reconnect, not the initial one.
  const soNoiChienRef = useRef(soNoiChien);
  soNoiChienRef.current = soNoiChien;

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_noi', soNoiChienRef.current);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Re-join room and re-subscribe on tab switch — only active fryer listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      socket.emit('join_noi', soNoiChien);
    }

    const dataHandler = (payload: StagePayload[] | NoiChienDataPayload) => {
      if (Array.isArray(payload)) {
        onData(payload, undefined, undefined);
      } else {
        onData(payload.stages, payload.stage_elapsed_ms, payload.elapsed_age_ms);
      }
    };
    const stopHandler = () => {
      onStop();
    };

    // Register only the active fryer's listeners (not all 8)
    const dataEvent = `noi_chien_${soNoiChien}_data`;
    const stopEvent = `noi_chien_${soNoiChien}_stop`;

    socket.on(dataEvent, dataHandler as (...args: unknown[]) => void);
    socket.on(stopEvent, stopHandler as (...args: unknown[]) => void);

    return () => {
      socket.off(dataEvent, dataHandler as (...args: unknown[]) => void);
      socket.off(stopEvent, stopHandler as (...args: unknown[]) => void);
    };
  }, [soNoiChien, onData, onStop]);

  return socketRef;
}
