import React, { useEffect, useState } from 'react';

interface DonutTimerProps {
  startMs: number;
  targetMin: number;
}

const RADIUS = 27;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 169.646

export const DonutTimer: React.FC<DonutTimerProps> = ({ startMs, targetMin }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = now - startMs;
  const elapsedMin = elapsedMs / 60000;
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
