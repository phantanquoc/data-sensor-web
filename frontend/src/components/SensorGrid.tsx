import React from 'react';
import { Clock3, Gauge, Thermometer, Zap } from 'lucide-react';
import { isTemperatureWarning } from '../constants';
import styles from './SensorGrid.module.css';
import type { SensorData } from '../types';

interface SensorGridProps {
  data: SensorData;
  tongThoiGian: number;
  temperatureTarget: number | null;
}

interface MetricProps {
  label: string;
  value: number;
  target?: number | null;
  warning?: boolean;
}

const Metric: React.FC<MetricProps> = ({ label, value, target, warning = false }) => (
  <div className={`${styles.metric} ${warning ? styles.warningMetric : ''}`}>
    <span className={styles.metricLabel}>{label}</span>
    <strong className={styles.metricValue}>
      {value}{target != null ? `/${target}` : ''}
    </strong>
  </div>
);

export const SensorGrid: React.FC<SensorGridProps> = ({ data, tongThoiGian, temperatureTarget }) => {
  const temperatureWarning = isTemperatureWarning(data.nhiet_do, temperatureTarget);

  return (
    <section className={styles.sensorSection} aria-label="Thông số hệ thống">
      <header className={styles.cardHeader}>
        <h3>Thông số hệ thống</h3>
        <span className={styles.totalTime}>
          <Clock3 size={15} aria-hidden="true" />
          <span>Thời gian: <b>{tongThoiGian}</b> phút</span>
        </span>
      </header>

      <div className={`${styles.metricSection} ${styles.temperatureSection}`}>
        <h4><Thermometer size={15} aria-hidden="true" /> Nhiệt độ</h4>
        <div className={styles.metricGrid}>
          <Metric
            label="Nhiệt độ chiên"
            value={data.nhiet_do}
            target={temperatureTarget}
            warning={temperatureWarning}
          />
          <Metric label="Vào bình sinh hàn" value={data.nhiet_do_vao_binh_sinh_han} />
          <Metric label="Ra bình sinh hàn" value={data.nhiet_do_ra_binh_sinh_han} />
          <Metric label="Vào động cơ vòng nước" value={data.nhiet_do_vao_bom_vong_nuoc} />
          <Metric label="Ra động cơ vòng nước" value={data.nhiet_do_ra_bom_vong_nuoc} />
        </div>
      </div>

      <div className={`${styles.metricSection} ${styles.pressureSection}`}>
        <h4><Gauge size={15} aria-hidden="true" /> Áp suất</h4>
        <div className={styles.metricGrid}>
          <Metric label="Vỏ hơi" value={data.ap_suat_vo_hoi} />
          <Metric label="Chân không" value={data.ap_suat_chan_khong} />
          <Metric label="Vòng nước" value={data.ap_suat_vong_nuoc} />
        </div>
      </div>

      <div className={`${styles.metricSection} ${styles.currentSection}`}>
        <h4><Zap size={15} aria-hidden="true" /> Dòng điện</h4>
        <div className={styles.metricGrid}>
          <Metric label="Động cơ Root" value={data.dong_dien_dong_co_root} />
          <Metric label="Động cơ vòng nước" value={data.dong_dien_dong_co_vong_nuoc} />
        </div>
      </div>
    </section>
  );
};
