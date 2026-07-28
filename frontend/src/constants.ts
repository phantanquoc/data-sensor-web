export const TEMPERATURE_WARNING_DELTA = 3;

/**
 * Max local interpolation between server elapsed ticks, in ms.
 * The server's real per-fryer emit gap is ~3 s (8 fryers, block Modbus reads +
 * 800 ms reschedule), so this must comfortably exceed one gap to keep the timer
 * counting smoothly between emits — but stay small enough to freeze the display
 * shortly after the server genuinely stops emitting (stalled batch / dead HMI).
 * Shared by the Overview card and the Detail stage timer so both agree.
 */
export const ELAPSED_STALL_CAP_MS = 6000;

export function isTemperatureWarning(current: number | undefined, target: number | null): boolean {
  return current != null
    && target != null
    && Math.abs(current - target) >= TEMPERATURE_WARNING_DELTA;
}
