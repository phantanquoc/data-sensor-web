import React from 'react';
import { Activity, CalendarDays, Clock3, Gauge, Thermometer, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './BatchDetail.module.css';
import type { BatchDocument, BienDuLieuEntry, HieuSuatMaySnapshot, SensorData } from '../types';
import { parseTs } from '../hooks/timeUtils';

interface BatchDetailProps {
  data: BatchDocument;
}

type MetricKey =
  | 'nhiet_do'
  | 'nhiet_do_vao_binh_sinh_han'
  | 'nhiet_do_ra_binh_sinh_han'
  | 'nhiet_do_vao_bom_vong_nuoc'
  | 'nhiet_do_ra_bom_vong_nuoc'
  | 'ap_suat_vo_hoi'
  | 'ap_suat_chan_khong'
  | 'ap_suat_vong_nuoc'
  | 'dong_dien_dong_co_root'
  | 'dong_dien_dong_co_vong_nuoc';

interface MetricDefinition {
  key: MetricKey;
  label: string;
}

const metricGroups: Array<{
  title: string;
  tone: 'temperature' | 'pressure' | 'current';
  icon: LucideIcon;
  metrics: MetricDefinition[];
}> = [
  {
    title: 'Nhiệt độ',
    tone: 'temperature',
    icon: Thermometer,
    metrics: [
      { key: 'nhiet_do', label: 'Nhiệt độ chiến' },
      { key: 'nhiet_do_vao_binh_sinh_han', label: 'Vào bình sinh hàn' },
      { key: 'nhiet_do_ra_binh_sinh_han', label: 'Ra bình sinh hàn' },
      { key: 'nhiet_do_vao_bom_vong_nuoc', label: 'Vào động cơ vòng nước' },
      { key: 'nhiet_do_ra_bom_vong_nuoc', label: 'Ra động cơ vòng nước' },
    ],
  },
  {
    title: 'Áp suất',
    tone: 'pressure',
    icon: Gauge,
    metrics: [
      { key: 'ap_suat_vo_hoi', label: 'Vỏ hơi' },
      { key: 'ap_suat_chan_khong', label: 'Chân không' },
      { key: 'ap_suat_vong_nuoc', label: 'Vòng nước' },
    ],
  },
  {
    title: 'Dòng điện',
    tone: 'current',
    icon: Zap,
    metrics: [
      { key: 'dong_dien_dong_co_root', label: 'Động cơ Root' },
      { key: 'dong_dien_dong_co_vong_nuoc', label: 'Động cơ vòng nước' },
    ],
  },
];

function parseEntryTime(value: string | undefined): Date | null {
  return parseTs(value);
}

function validSamples(entries: BienDuLieuEntry[] | undefined): BienDuLieuEntry[] {
  return (Array.isArray(entries) ? entries : []).filter((entry) => parseEntryTime(entry.thoi_gian) !== null);
}

function formatValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function getStats(entries: BienDuLieuEntry[], key: MetricKey) {
  const values = entries
    .map((entry) => Number(entry[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return { start: null, min: null, max: null, avg: null };
  return {
    start: values[0],
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function formatSeconds(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total)) return '—';
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s} giây`;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return seconds ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Chưa có dữ liệu';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} phút ${seconds} giây`;
}

function stageDuration(entries: BienDuLieuEntry[]): string {
  if (entries.length < 2) return 'Chưa có dữ liệu';
  const start = parseEntryTime(entries[0].thoi_gian)?.getTime() ?? 0;
  const stop = parseEntryTime(entries[entries.length - 1].thoi_gian)?.getTime() ?? 0;
  return formatDuration(stop - start);
}

function getConfiguredMinutes(stage: Record<string, unknown>): number | null {
  const value = stage.thoi_gian_chay ?? stage.thoi_gian_treo_long_gd_4 ?? stage.thoi_gian_treo_long;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export const BatchDetail: React.FC<BatchDetailProps> = ({ data }) => {
  const stages = [data.giai_doan_1, data.giai_doan_2, data.giai_doan_3, data.giai_doan_4];

  // Hiệu suất máy: 2 mốc chụp (M1 kick root, M155 nhúng hàng). Hiển thị nếu có ít nhất 1 mốc.
  const hieuSuat = data.hieu_suat_may;
  const perfRows: Array<{ label: string; snap: HieuSuatMaySnapshot | null | undefined }> = [
    { label: 'Bắt đầu kick root (M1)', snap: hieuSuat?.kick_root },
    { label: 'Bắt đầu nhúng hàng (M155)', snap: hieuSuat?.nhung_hang },
  ];
  const hasPerf = perfRows.some((row) => !!row.snap);

  function perfNumber(snap: HieuSuatMaySnapshot | null | undefined, key: keyof SensorData): number | null {
    if (!snap) return null;
    const raw = Number(snap[key]);
    return Number.isFinite(raw) ? raw : null;
  }

  return (
    <section className={styles.wrapper} aria-label="Chi tiết mẻ chiên">
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>Chi tiết mẻ chiên</p>
          <h2>{data.ma_me_chien || 'Mẻ chưa có mã'}</h2>
          {data.ghi_chu && <p className={styles.note}>{data.ghi_chu}</p>}
        </div>
        <div className={styles.headerMeta}>
          <span><CalendarDays size={16} /> Bắt đầu: {data.thoi_gian_start || '—'}</span>
          <span><CalendarDays size={16} /> Kết thúc: {data.thoi_gian_stop || 'Đang chạy'}</span>
          <strong><Clock3 size={17} /> {formatValue(Number(data.tong_thoi_gian_chay) || 0)} phút</strong>
        </div>
      </div>

      {hasPerf && (
        <section className={styles.perfSection} aria-label="Hiệu suất máy">
          <h3 className={styles.perfTitle}><Gauge size={17} strokeWidth={2.2} /> Hiệu suất máy</h3>
          <div className={styles.perfTable}>
            <div className={styles.perfHeader}>
              <span>Thông số</span>
              <span>Thời gian</span>
              <span>Nhiệt độ</span>
              <span>Áp suất</span>
              <span>Dòng điện</span>
            </div>
            {perfRows.map((row) => {
              const giay = row.snap?.giay_tu_start;
              return (
                <div className={styles.perfRow} key={row.label}>
                  <span>{row.label}</span>
                  <b>{formatSeconds(giay)}</b>
                  <b>{formatValue(perfNumber(row.snap, 'nhiet_do'))}</b>
                  <b>{formatValue(perfNumber(row.snap, 'ap_suat_chan_khong'))}</b>
                  <b>{formatValue(perfNumber(row.snap, 'dong_dien_dong_co_root'))}</b>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className={styles.stageGrid}>
        {stages.map((stage, index) => {
          const samples = validSamples(stage?.bien_du_lieu);
          const configuredMinutes = getConfiguredMinutes((stage || {}) as Record<string, unknown>);
          return (
            <article className={styles.stageCard} key={index}>
              <div className={styles.stageHeader}>
                <div>
                  <p className={styles.stageLabel}>Giai đoạn {index + 1}</p>
                  <span className={styles.sampleCount}>{samples.length} mẫu dữ liệu</span>
                </div>
                <div className={styles.stageTimes}>
                  <span><Clock3 size={15} /> {stageDuration(samples)}</span>
                  {configuredMinutes !== null && <small>Thiết lập: {formatValue(configuredMinutes)} phút</small>}
                </div>
              </div>

              {metricGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <section className={`${styles.metricGroup} ${styles[group.tone]}`} key={group.title}>
                    <h3><Icon size={17} strokeWidth={2.2} /> {group.title}</h3>
                    <div className={styles.metricTable}>
                      <div className={styles.metricRowHeader}>
                        <span>Thông số</span>
                        <span>Bắt đầu</span><span>Thấp nhất</span><span>Cao nhất</span><span>Trung bình</span>
                      </div>
                      {group.metrics.map((metric) => {
                        const stats = getStats(samples, metric.key);
                        return (
                          <div className={styles.metricRow} key={metric.key}>
                            <span>{metric.label}</span>
                            <b>{formatValue(stats.start)}</b>
                            <b>{formatValue(stats.min)}</b>
                            <b>{formatValue(stats.max)}</b>
                            <b>{formatValue(stats.avg)}</b>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {!samples.length && (
                <div className={styles.emptyStage}><Activity size={18} /> Chưa có mẫu dữ liệu cho giai đoạn này.</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
