import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { StagePayload, NoiChienDataPayload } from '../types';

interface UseSocketOptions {
  soNoiChien: string;
  onData: (stages: StagePayload[], stageElapsedMs?: number | null) => void;
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

  // Re-join room and re-subscribe on tab switch
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      socket.emit('join_noi', soNoiChien);
    }

    const dataHandler = (payload: StagePayload[] | NoiChienDataPayload) => {
      // Backward-compat: old server sends raw array, new server sends wrapper object
      if (Array.isArray(payload)) {
        onData(payload, undefined);
      } else {
        onData(payload.stages, payload.stage_elapsed_ms);
      }
    };
    const stopHandler = () => {
      onStop();
    };

    // Subscribe to all 8 fryers but only process active one
    const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
    for (let n = 1; n <= 8; n++) {
      const dataEvent = `noi_chien_${n}_data`;
      const stopEvent = `noi_chien_${n}_stop`;
      const dh = (payload: StagePayload[] | NoiChienDataPayload) => {
        if (soNoiChien === String(n)) {
          dataHandler(payload);
        }
      };
      const sh = () => {
        if (soNoiChien === String(n)) {
          stopHandler();
        }
      };
      socket.on(dataEvent, dh as (...args: unknown[]) => void);
      socket.on(stopEvent, sh as (...args: unknown[]) => void);
      handlers.push({ event: dataEvent, handler: dh as (...args: unknown[]) => void });
      handlers.push({ event: stopEvent, handler: sh as (...args: unknown[]) => void });
    }

    return () => {
      for (const { event, handler } of handlers) {
        socket.off(event, handler);
      }
    };
  }, [soNoiChien, onData, onStop]);

  return socketRef;
}
