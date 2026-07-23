import React, { useEffect, useState } from 'react';

interface StageProgressProps {
  elapsedMs: number;
  receivedAt: number;
  targetMin: number;
  frozen?: boolean;
}

// Cap interpolation so the progress bar freezes when realtime updates stop.
const MAX_INTERP = 2000;

export const StageProgress: React.FC<StageProgressProps> = ({ elapsedMs, receivedAt, targetMin, frozen = false }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const localDelta = frozen ? 0 : Math.min(Date.now() - receivedAt, MAX_INTERP);
  const elapsedMin = (elapsedMs + localDelta) / 60000;
  const isOvertime = targetMin > 0 && elapsedMin > targetMin;
  const pct = targetMin > 0 ? Math.min((elapsedMin / targetMin) * 100, 100) : 0;
  const elapsedText = elapsedMin.toFixed(1);
  const targetText = targetMin > 0 ? String(Math.round(targetMin)) : '--';
  const fillColor = isOvertime ? '#fd7e14' : '#2196f3';

  // `now` drives the once-per-second interpolation repaint.
  void now;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          color: '#6b7280',
          fontSize: 12,
        }}
      >
        <span>Thời gian chạy</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <b style={{ color: fillColor }}>{elapsedText}</b> / {targetText} phút
        </span>
      </div>
      <div
        style={{
          height: 10,
          width: '100%',
          overflow: 'hidden',
          borderRadius: 9999,
          background: '#e5e7eb',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: fillColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
