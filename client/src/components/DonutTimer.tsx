import React, { useEffect, useState } from 'react';

interface DonutTimerProps {
  elapsedMs: number;
  receivedAt: number;
  targetMin: number;
}

const RADIUS = 27;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 169.646
// Cap interpolation to 2x the expected emit gap (~1s) to freeze on stall
const MAX_INTERP = 2000;

export const DonutTimer: React.FC<DonutTimerProps> = ({ elapsedMs, receivedAt, targetMin }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Interpolate from server value but cap so donut freezes when server stops emitting
  const localDelta = Math.min(Date.now() - receivedAt, MAX_INTERP);
  const displayedMs = elapsedMs + localDelta;
  const elapsedMin = displayedMs / 60000;
  const isOvertime = targetMin > 0 && elapsedMin > targetMin;
  const color = isOvertime ? '#fd7e14' : '#00aaff';

  let pct = 0;
  let targetText = '--';
  if (targetMin > 0) {
    pct = Math.min((elapsedMin / targetMin) * 100, 100);
    targetText = String(Math.round(targetMin));
  }
  const elapsedText = elapsedMin.toFixed(1);
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100;

  // Suppress unused 'now' lint warning — it drives re-renders
  void now;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 70 }}>
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={RADIUS} fill="none" stroke="#e0e0e0" strokeWidth="5" />
        {targetMin > 0 && (
          <circle
            cx="35"
            cy="35"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={CIRCUMFERENCE.toFixed(3)}
            strokeDashoffset={dashOffset.toFixed(3)}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
            style={{ transition: 'stroke-dashoffset 0.3s' }}
          />
        )}
        <text x="35" y="33" textAnchor="middle" fontSize="9" fill="#333" fontWeight="bold">
          {elapsedText} / {targetText}
        </text>
        <text x="35" y="44" textAnchor="middle" fontSize="8" fill="#666">
          phút
        </text>
      </svg>
    </div>
  );
};
