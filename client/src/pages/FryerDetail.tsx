import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { TabBar } from '../components/TabBar';
import { StageColumn } from '../components/StageColumn';
import { SensorGrid } from '../components/SensorGrid';
import { BatchList } from '../components/BatchList';
import { StatsBar } from '../components/StatsBar';
import { BatchDetailDrawer } from '../components/BatchDetailDrawer';
import { FleetLineChart } from '../components/FleetLineChart';
import { Toast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import { useFryerData } from '../hooks/useFryerData';
import { useFleetHistory } from '../hooks/useFleetHistory';
import { getNoiChien, getNoiChienDetail, suaNoiChienDetail, xoaNoiChienDetail } from '../api';
import type { StagePayload, SensorData, SetGiaiDoanStages123 } from '../types';
import type { Period } from '../hooks/useThongKe';
import styles from '../App.module.css';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'custom', label: 'Tùy chỉnh' },
];

/** Hôm nay dạng YYYY-MM-DD theo giờ máy (múi giờ VN). */
function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const ZERO_SENSOR: SensorData = {
  ap_suat_vo_hoi: 0,
  ap_suat_chan_khong: 0,
  ap_suat_vong_nuoc: 0,
  nhiet_do: 0,
  dong_dien_dong_co_root: 0,
  dong_dien_dong_co_vong_nuoc: 0,
  nhiet_do_vao_binh_sinh_han: 0,
  nhiet_do_ra_binh_sinh_han: 0,
  nhiet_do_vao_bom_vong_nuoc: 0,
  nhiet_do_ra_bom_vong_nuoc: 0,
};

export const FryerDetail: React.FC = () => {
  const { n } = useParams<{ n: string }>();
  const navigate = useNavigate();
  const soNoiChien = n && /^[1-8]$/.test(n) ? n : '1';

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('day');
  const [customFrom, setCustomFrom] = useState<string>(todayYmd());
  const [customTo, setCustomTo] = useState<string>(todayYmd());

  const {
    stages,
    batchList,
    setBatchList,
    batchDetail,
    setBatchDetail,
    donut,
    stageElapsedMsByStage,
    resetView,
    handleDataEvent,
    autoLoad,
  } = useFryerData();

  // Biểu đồ xu hướng mẻ hiện tại — chỉ theo dõi máy đang xem
  const chartMachines = useMemo(() => [Number(soNoiChien)], [soNoiChien]);
  const { latest, previous } = useFleetHistory(chartMachines);

  const onData = useCallback((stagesArr: StagePayload[], stageElapsedMs?: number | null, elapsedAgeMs?: number) => {
    handleDataEvent(stagesArr, stageElapsedMs, elapsedAgeMs);
  }, [handleDataEvent]);

  const onStop = useCallback(() => {
    resetView();
    setToastMsg(`Đã hoàn thành mẻ hệ chiên ${soNoiChien}`);
  }, [resetView, soNoiChien]);

  useSocket({ soNoiChien, onData, onStop });

  const handleTabChange = useCallback((tab: string) => {
    navigate(`/may/${tab}`);
  }, [navigate]);

  // When soNoiChien changes (tab switch via URL), reset + auto-load
  useEffect(() => {
    resetView();
    setBatchList([]);
    setBatchDetail(null);
    autoLoad(Number(soNoiChien));
  }, [soNoiChien, autoLoad, resetView, setBatchList, setBatchDetail]);

  const handleRefreshBatchList = useCallback(async (filters: { from?: string; to?: string } = {}) => {
    const docs = await getNoiChien(Number(soNoiChien), filters);
    setBatchList(docs);
  }, [soNoiChien, setBatchList]);

  const handleViewBatch = useCallback(async (id: string) => {
    const detail = await getNoiChienDetail(id, Number(soNoiChien));
    setBatchDetail(detail);
  }, [soNoiChien, setBatchDetail]);

  const handleDeleteBatch = useCallback(async (id: string) => {
    await xoaNoiChienDetail(id, Number(soNoiChien));
    setToastMsg('Đã xóa mẻ chiên');
    setBatchDetail((current) => current?._id === id ? null : current);
    const docs = await getNoiChien(Number(soNoiChien));
    setBatchList(docs);
  }, [soNoiChien, setBatchDetail, setBatchList]);

  const handleEditBatch = useCallback(async (
    id: string,
    values: { ma_me_chien: string; ghi_chu: string },
  ) => {
    await suaNoiChienDetail(id, Number(soNoiChien), values);
    setToastMsg('Đã cập nhật mẻ chiên');
    setBatchDetail((current) => current?._id === id ? { ...current, ...values } : current);
    const docs = await getNoiChien(Number(soNoiChien));
    setBatchList(docs);
  }, [soNoiChien, setBatchDetail, setBatchList]);

  const clearToast = useCallback(() => setToastMsg(null), []);

  // Get active stage's sensor data for the grid
  const activeStageIdx = stages.findIndex((s) => s.active);
  const sensorData: SensorData = activeStageIdx >= 0
    ? stages[activeStageIdx].data as SensorData
    : stages[0].data as SensorData ?? ZERO_SENSOR;

  const activeTemperatureTarget = activeStageIdx >= 0 && activeStageIdx < 3
    ? Number((stages[activeStageIdx].set_giai_doan as SetGiaiDoanStages123).nhiet_do_cai_dat) || null
    : null;

  // tong_thoi_gian_chay from the first non-zero stage
  const tongThoiGian = stages[0]?.tong_thoi_gian_chay ?? 0;

  return (
    <div className={styles.page}>
      <TabBar activeTab={soNoiChien} onTabChange={handleTabChange} />

      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.tabContent}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-3 text-2xl font-bold text-text-primary">
                <Activity size={20} className="text-brand" aria-hidden="true" />
                <span>Hệ Chiên </span>
                <span className="text-brand">{soNoiChien}</span>
              </h2>

              <div className="inline-flex self-start rounded-full border border-border bg-surface-raised p-1 sm:self-auto">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      period === p.key ? 'bg-brand text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {period === 'custom' && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  Từ ngày
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  Đến ngày
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    max={todayYmd()}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </label>
              </div>
            )}

            <div className="mb-4">
              <StatsBar
                period={period}
                custom={{ from: customFrom, to: customTo }}
                may={Number(soNoiChien)}
              />
            </div>

            <section aria-label="Biểu đồ xu hướng mẻ hiện tại" className="mb-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity size={16} className="text-brand" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-text-primary">Xu hướng theo mẻ hiện tại</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FleetLineChart
                  title="Nhiệt độ"
                  unit="°C"
                  latestSeries={latest.tempSeries}
                  previousSeries={previous.tempSeries}
                  latestSetpointSeries={latest.setpointSeries}
                  previousSetpointSeries={previous.setpointSeries}
                />
                <FleetLineChart
                  title="Áp chân không"
                  unit="bar"
                  latestSeries={latest.apSeries}
                  previousSeries={previous.apSeries}
                />
              </div>
            </section>

            <div className={styles.detailCardsRow}>
              {stages.map((stage, idx) => (
                <StageColumn
                  key={idx}
                  stage={stage}
                  stageIndex={idx + 1}
                  donutElapsedMs={donut.stage === idx + 1 ? donut.elapsedMs : null}
                  donutReceivedAt={donut.stage === idx + 1 ? donut.receivedAt : 0}
                  donutTargetMin={donut.stage === idx + 1 ? donut.targetMin : 0}
                  activeDonutStage={donut.stage}
                  completedElapsedMs={stageElapsedMsByStage[idx + 1] ?? null}
                />
              ))}

              <SensorGrid
                data={sensorData}
                tongThoiGian={tongThoiGian}
                temperatureTarget={activeTemperatureTarget}
              />
            </div>
          </div>
        </div>

        <BatchList
          batchList={batchList}
          onView={handleViewBatch}
          onEdit={handleEditBatch}
          onDelete={handleDeleteBatch}
          onRefresh={handleRefreshBatchList}
        />
      </div>

      {batchDetail && <BatchDetailDrawer data={batchDetail} onClose={() => setBatchDetail(null)} />}

      <Toast message={toastMsg} onDone={clearToast} />
    </div>
  );
};
