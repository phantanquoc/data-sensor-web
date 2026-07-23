import React from 'react';
import { useLiveElapsed } from '../hooks/useLiveElapsed';

interface StageProgressProps {
  elapsedMs: number;
  receivedAt: number;
  targetMin: number;
  frozen?: boolean;
}

export const StageProgress: React.FC<StageProgressProps> = ({ elapsedMs, receivedAt, targetMin, frozen = false }) => {
  // Shared server-authoritative timer: same interpolation + stall cap + 1 s tick
  // as the Overview card, so the two views always show the same number.
  const totalMs = useLiveElapsed(elapsedMs, receivedAt, true, frozen);
  const elapsedMin = totalMs / 60000;
  const isOvertime = targetMin > 0 && elapsedMin > targetMin;
  const pct = targetMin > 0 ? Math.min((elapsedMin / targetMin) * 100, 100) : 0;
  const totalSeconds = Math.floor(Math.max(0, totalMs) / 1000);
  const elapsedText = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const targetText = targetMin > 0 ? String(Math.round(targetMin)) : '--';
  const fillColor = isOvertime ? '#fd7e14' : '#2196f3';

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
