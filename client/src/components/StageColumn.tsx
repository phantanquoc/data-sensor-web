import React from 'react';
import styles from './StageColumn.module.css';
import type { StagePayload, SetGiaiDoanStages123, SetGiaiDoanStage4 } from '../types';
import { DonutTimer } from './DonutTimer';

interface StageColumnProps {
  stage: StagePayload;
  stageIndex: number; // 1-4
  donutStartMs: number | null;
  donutTargetMin: number;
  activeDonutStage: number | null;
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
  donutStartMs,
  donutTargetMin,
  activeDonutStage,
}) => {
  const showDonut = stage.active && activeDonutStage === stageIndex && donutStartMs !== null;

  return (
    <div className={styles.stageCard}>
      <p className={styles.stageTitle}>{stage.giai_doan}</p>
      <span className={styles.donutSlot}>
        {showDonut && (
          <DonutTimer startMs={donutStartMs!} targetMin={donutTargetMin} />
        )}
      </span>
      {isStage123(stage.set_giai_doan) && (
        <>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Thời gian chạy</span>
            <b className={styles.valueBlue}>{stage.set_giai_doan.thoi_gian_chay} <span>phút</span></b>
          </div>
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
        <div className={styles.row}>
          <span className={styles.rowLabel}>Thời gian treo lòng</span>
          <b className={styles.valueBlue}>{stage.set_giai_doan.thoi_gian_treo_long} <span>phút</span></b>
        </div>
      )}
    </div>
  );
};
