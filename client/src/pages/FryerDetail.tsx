import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TabBar } from '../components/TabBar';
import { StageColumn } from '../components/StageColumn';
import { SensorGrid } from '../components/SensorGrid';
import { BatchList } from '../components/BatchList';
import { BatchDetailDrawer } from '../components/BatchDetailDrawer';
import { Toast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import { useFryerData } from '../hooks/useFryerData';
import { getNoiChien, getNoiChienDetail, suaNoiChienDetail, xoaNoiChienDetail } from '../api';
import type { StagePayload, SensorData, SetGiaiDoanStages123 } from '../types';
import styles from '../App.module.css';

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
    <div>
      <TabBar activeTab={soNoiChien} onTabChange={handleTabChange} />

      <div className={styles.content}>
        <div className={styles.tabContent}>
          <h2 className={styles.heading}>
            <div>
              <span>Hệ Chiên </span>
              <span>{soNoiChien}</span>
            </div>
          </h2>

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

      {batchDetail && <BatchDetailDrawer data={batchDetail} onClose={() => setBatchDetail(null)} />}

      <Toast message={toastMsg} onDone={clearToast} />
    </div>
  );
};
