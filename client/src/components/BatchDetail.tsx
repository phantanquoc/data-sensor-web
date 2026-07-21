import React from 'react';
import styles from './BatchDetail.module.css';
import type { BatchDocument, BienDuLieuEntry } from '../types';
import { getDuration } from '../hooks/timeUtils';

interface BatchDetailProps {
  data: BatchDocument;
}

const SENSOR_LABELS = [
  { key: 'ap_suat_vo_hoi', label: 'Áp suất vỏ hơi' },
  { key: 'ap_suat_chan_khong', label: 'Áp suất chân không' },
  { key: 'ap_suat_vong_nuoc', label: 'Áp suất vòng nước' },
  { key: 'nhiet_do', label: 'Nhiệt độ' },
  { key: 'dong_dien_dong_co_root', label: 'Dòng điện động cơ root' },
  { key: 'dong_dien_dong_co_vong_nuoc', label: 'Dòng điện động cơ vòng nước' },
  { key: 'nhiet_do_vao_binh_sinh_han', label: 'Nhiệt độ vào bình sinh hàn' },
  { key: 'nhiet_do_ra_binh_sinh_han', label: 'Nhiệt độ ra bình sinh hàn' },
  { key: 'nhiet_do_vao_bom_vong_nuoc', label: 'Nhiệt độ vào bơm vòng nước' },
  { key: 'nhiet_do_ra_bom_vong_nuoc', label: 'NHiệt độ ra bơm vòng nước' },
];

function computeAverage(entries: BienDuLieuEntry[], field: string): string {
  if (entries.length <= 1) return '0';
  const divisor = entries.length - 1;
  let sum = 0;
  for (const entry of entries) {
    sum += Number(entry[field]) || 0;
  }
  return (sum / divisor).toFixed(2);
}

function getStageDuration(entries: BienDuLieuEntry[]): string {
  if (entries.length <= 1) return '0';
  const first = entries[1];
  const last = entries[entries.length - 1];
  if (!first.thoi_gian || !last.thoi_gian) return '0';
  try {
    return getDuration(first.thoi_gian, last.thoi_gian).text;
  } catch {
    return '0';
  }
}

export const BatchDetail: React.FC<BatchDetailProps> = ({ data }) => {
  const stages = [data.giai_doan_1, data.giai_doan_2, data.giai_doan_3, data.giai_doan_4];

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.mainTitle}>Dữ liệu mẻ chiên</h1>
      <div className={styles.appContainer}>
        {/* Summary + Averages Table */}
        <div className={styles.topRow}>
          {/* Left: Summary panel */}
          <div className={styles.summaryPanel}>
            <p className={styles.summaryItem}>
              <b style={{ color: '#2563eb' }}>Thời gian Start:</b>
              <span>{data.thoi_gian_start}</span>
            </p>
            <p className={styles.summaryItem}>
              <b style={{ color: '#dc2626' }}>Thời gian Stop:</b>
              <span>{data.thoi_gian_stop}</span>
            </p>
            <p className={styles.summaryItem}>
              <b style={{ color: '#16a34a' }}>Tổng thời gian chạy:</b>
              <span style={{ fontWeight: 'bold' }}>{data.tong_thoi_gian_chay} (phút)</span>
            </p>
            {[1, 2, 3, 4].map((g) => {
              const gd = stages[g - 1];
              const entries = gd?.bien_du_lieu || [];
              return (
                <p key={g} className={styles.summaryItem}>
                  <b style={{ color: '#16a34a' }}>Thời gian chạy giai đoạn {g}: </b>
                  <span style={{ fontWeight: 'bold' }}>{getStageDuration(entries)}</span>
                </p>
              );
            })}
          </div>

          {/* Right: Averages table */}
          <table className={styles.avgTable}>
            <thead>
              <tr className={styles.avgHeaderRow}>
                <th className={styles.avgTh}>Tên Cảm biến</th>
                <th className={styles.avgTh}>Gian đoạn 1</th>
                <th className={styles.avgTh}>Gian đoạn 2</th>
                <th className={styles.avgTh}>Gian đoạn 3</th>
                <th className={styles.avgTh}>Gian đoạn 4</th>
              </tr>
            </thead>
            <tbody>
              {SENSOR_LABELS.map(({ key, label }, idx) => (
                <tr key={key} style={{ background: idx % 2 === 0 ? '#f9fafb' : 'white', textAlign: 'center' }}>
                  <td className={styles.avgTdLeft}>{label}</td>
                  {stages.map((gd, si) => (
                    <td key={si} className={styles.avgTd}>
                      {computeAverage(gd?.bien_du_lieu || [], key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-stage dump */}
        {['giai_doan_1', 'giai_doan_2', 'giai_doan_3', 'giai_doan_4'].map((gdKey) => {
          const stage = data[gdKey as keyof BatchDocument] as Record<string, unknown> | undefined;
          if (!stage) return null;
          return (
            <div key={gdKey} className={styles.stageDump}>
              <h2 className={styles.stageDumpTitle}>{gdKey.replace('_', ' ').toUpperCase()}</h2>
              <div className={styles.infoGrid}>
                {Object.keys(stage)
                  .filter((f) => f !== 'bien_du_lieu')
                  .map((field) => (
                    <div key={field} className={styles.infoItem}>
                      <b>{field}</b>: {String(stage[field] ?? '')}
                    </div>
                  ))}
              </div>
              {Array.isArray(stage.bien_du_lieu) && (stage.bien_du_lieu as BienDuLieuEntry[]).length > 1 && (
                <div className={styles.tableScroll}>
                  <table className={styles.dumpTable}>
                    <thead>
                      <tr>
                        {Object.keys((stage.bien_du_lieu as BienDuLieuEntry[])[0]).map((h) => (
                          <th key={h} className={styles.dumpTh}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(stage.bien_du_lieu as BienDuLieuEntry[]).map((row, ri) => (
                        <tr key={ri}>
                          {Object.keys((stage.bien_du_lieu as BienDuLieuEntry[])[0]).map((h) => (
                            <td key={h} className={styles.dumpTd}>{String(row[h] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
