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
  const fillColor = isOvertime ? 'var(--color-val-orange)' : 'var(--color-brand)';
  const fillColorEnd = isOvertime ? 'var(--color-val-orange)' : 'var(--color-brand-dark)';
  const glowColor = isOvertime ? 'rgba(251, 146, 60, 0.3)' : 'var(--color-brand-glow)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          color: 'var(--color-text-secondary)',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <span>Thời gian chạy</span>
        <span style={{ whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
          <b style={{ color: fillColor, fontSize: 13 }}>{elapsedText}</b>
          <span style={{ color: 'var(--color-text-muted)' }}> / {targetText} phút</span>
        </span>
      </div>
      <div
        style={{
          height: 8,
          width: '100%',
          overflow: 'hidden',
          borderRadius: 9999,
          background: 'var(--color-surface-overlay)',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: `linear-gradient(90deg, ${fillColor}, ${fillColorEnd})`,
            boxShadow: `0 0 8px ${glowColor}`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
