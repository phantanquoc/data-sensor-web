import React from 'react';
import styles from './StageColumn.module.css';
import type { StagePayload, SetGiaiDoanStages123, SetGiaiDoanStage4 } from '../types';
import { StageProgress } from './StageProgress';

interface StageColumnProps {
  stage: StagePayload;
  stageIndex: number; // 1-4
  donutElapsedMs: number | null;
  donutReceivedAt: number;
  donutTargetMin: number;
  activeDonutStage: number | null;
  completedElapsedMs: number | null;
}

function isStage123(s: StagePayload['set_giai_doan']): s is SetGiaiDoanStages123 {
  return 'thoi_gian_chay' in s;
}

function isStage4(s: StagePayload['set_giai_doan']): s is SetGiaiDoanStage4 {
  return 'thoi_gian_treo_long' in s;
}

export const StageColumn: React.FC<StageColumnProps> = ({
  stage,
  stageIndex,
  donutElapsedMs,
  donutReceivedAt,
  donutTargetMin,
  activeDonutStage,
  completedElapsedMs,
}) => {
  const showProgress = stage.active && activeDonutStage === stageIndex && donutElapsedMs !== null;
  const showCompletedProgress = !stage.active && completedElapsedMs !== null;
  const progressTargetMin = isStage123(stage.set_giai_doan)
    ? Number(stage.set_giai_doan.thoi_gian_chay) || 0
    : Number(stage.set_giai_doan.thoi_gian_treo_long) || 0;

  return (
    <div className={`${styles.stageCard} ${stage.active ? styles.activeStage : ''}`}>
      <p className={styles.stageTitle}>{stage.giai_doan}</p>
      <div className={styles.progressSlot}>
        {(showProgress || showCompletedProgress) && (
          <StageProgress
            elapsedMs={showProgress ? donutElapsedMs! : completedElapsedMs!}
            receivedAt={showProgress ? donutReceivedAt : 0}
            targetMin={showProgress ? donutTargetMin : progressTargetMin}
            frozen={showCompletedProgress}
          />
        )}
      </div>
      {isStage123(stage.set_giai_doan) && (
        <>
          {!showProgress && !showCompletedProgress && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Thời gian chạy</span>
              <b className={styles.valueBlue}>{stage.set_giai_doan.thoi_gian_chay} <span>phút</span></b>
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.rowLabel}>Số lần nhúng</span>
            <b className={styles.valueGreen}>{stage.set_giai_doan.so_lan_nhung} <span>lần</span></b>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Thời gian nhúng</span>
            <b className={styles.valueOrange}>{stage.set_giai_doan.thoi_gian_nhung} <span>S</span></b>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Thời gian lặp lại</span>
            <b className={styles.valuePurple}>{stage.set_giai_doan.thoi_gian_lap_lai} <span>phút</span></b>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Nhiệt độ cài đặt</span>
            <b className={styles.valueRed}>{stage.set_giai_doan.nhiet_do_cai_dat} <span>độ C</span></b>
          </div>
          <div className={styles.rowLast}>
            <span className={styles.rowLabel}>Vị trí dừng</span>
            <b className={styles.valueTeal}>{stage.set_giai_doan.vi_tri_muc_dau}</b>
          </div>
        </>
      )}
      {isStage4(stage.set_giai_doan) && (
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Thời gian treo lòng</span>
            <b className={styles.valueBlue}>{stage.set_giai_doan.thoi_gian_treo_long} <span>phút</span></b>
          </div>
          {(() => {
            const nl = stage.set_giai_doan.nhung_long_dau;
            if (!nl) return null;
            return (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>M120 → vào GĐ1 (M155)</span>
                  <b className={styles.valueBlue}>
                    {nl.giay_vao_gd1 != null ? <>{nl.giay_vao_gd1} <span>giây</span></> : '—'}
                  </b>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>M120 → nhúng lòng (M6)</span>
                  <b className={styles.valueTeal}>
                    {nl.giay_tu_start != null ? <>{nl.giay_tu_start} <span>giây</span></> : (nl.thoi_gian || '—')}
                  </b>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Nhiệt độ</span>
                  <b className={styles.valueRed}>{nl.nhiet_do} <span>độ C</span></b>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Áp suất chân không</span>
                  <b className={styles.valuePurple}>{nl.ap_suat_chan_khong}</b>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Dòng điện Root</span>
                  <b className={styles.valueGreen}>{nl.dong_dien_dong_co_root} <span>A</span></b>
                </div>
                <div className={styles.rowLast}>
                  <span className={styles.rowLabel}>Dòng điện vòng nước</span>
                  <b className={styles.valueOrange}>{nl.dong_dien_dong_co_vong_nuoc} <span>A</span></b>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
};
