export const TEMPERATURE_WARNING_DELTA = 3;

export function isTemperatureWarning(current: number | undefined, target: number | null): boolean {
  return current != null
    && target != null
    && Math.abs(current - target) >= TEMPERATURE_WARNING_DELTA;
}
