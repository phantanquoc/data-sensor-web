import React from 'react';
import styles from './SensorGrid.module.css';
import type { SensorData } from '../types';

interface SensorGridProps {
  data: SensorData;
}

const SENSOR_LABELS: { key: keyof SensorData; label: string }[] = [
  { key: 'ap_suat_vo_hoi', label: 'Áp suất vỏ hơi' },
  { key: 'ap_suat_chan_khong', label: 'Áp suất chân không' },
  { key: 'ap_suat_vong_nuoc', label: 'Áp suất vòng nước' },
  { key: 'nhiet_do', label: 'Nhiệt độ' },
  { key: 'dong_dien_dong_co_root', label: 'Dòng điện động cơ Root' },
  { key: 'dong_dien_dong_co_vong_nuoc', label: 'Dòng điện động cơ vòng nước' },
  { key: 'nhiet_do_vao_binh_sinh_han', label: 'Nhiệt độ vào bình sinh hàn' },
  { key: 'nhiet_do_ra_binh_sinh_han', label: 'Nhiệt độ ra bình sinh hàn' },
  { key: 'nhiet_do_vao_bom_vong_nuoc', label: 'Nhiệt độ vào động cơ vòng nước' },
  { key: 'nhiet_do_ra_bom_vong_nuoc', label: 'Nhiệt độ ra động cơ vòng nước' },
];

export const SensorGrid: React.FC<SensorGridProps> = ({ data }) => {
  return (
    <div className={styles.sensorGrid}>
      {SENSOR_LABELS.map(({ key, label }) => (
        <div key={key} className={styles.sensorCard}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{data[key]}</span>
        </div>
      ))}
    </div>
  );
};
