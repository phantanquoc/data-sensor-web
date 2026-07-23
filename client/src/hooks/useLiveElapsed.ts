import { useEffect, useState } from 'react';
import { ELAPSED_STALL_CAP_MS } from '../constants';

/**
 * Server-authoritative elapsed timer with smooth 1 s local interpolation.
 *
 * The server owns `elapsedMs` (measured at `receivedAt`). Between socket emits
 * we project forward locally: `elapsedMs + min(now - receivedAt, STALL_CAP)`.
 * The cap means when the server stops emitting the display freezes shortly after
 * the last value instead of running away. Every consumer of the fryer elapsed
 * timer uses this hook, so the Overview card and the Detail stage timer show the
 * exact same number and tick in lockstep.
 *
 * `frozen` short-circuits interpolation (completed stage: show the fixed value).
 * `running === false` yields 0 (no active stage).
 */
export function useLiveElapsed(
  elapsedMs: number,
  receivedAt: number,
  running: boolean,
  frozen = false,
): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running || frozen) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, frozen]);

  if (!running) return 0;
  if (frozen) return Math.max(0, elapsedMs);

  const localDelta = Math.min(Math.max(0, Date.now() - receivedAt), ELAPSED_STALL_CAP_MS);
  return Math.max(0, elapsedMs + localDelta);
}
