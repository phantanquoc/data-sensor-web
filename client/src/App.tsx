import React, { useState, useCallback, useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { StageColumn } from './components/StageColumn';
import { SensorGrid } from './components/SensorGrid';
import { BatchList } from './components/BatchList';
import { BatchDetail } from './components/BatchDetail';
import { Toast } from './components/Toast';
import { useSocket } from './hooks/useSocket';
import { useFryerData } from './hooks/useFryerData';
import { getNoiChien, getNoiChienDetail, xoaNoiChienDetail } from './api';
import type { StagePayload, SensorData, BatchDocument } from './types';
import styles from './App.module.css';

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

function App() {
  const [soNoiChien, setSoNoiChien] = useState('1');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const {
    stages,
    batchList,
    setBatchList,
    batchDetail,
    setBatchDetail,
    donut,
    resetView,
    handleDataEvent,
    autoLoad,
  } = useFryerData();

  const onData = useCallback((stagesArr: StagePayload[]) => {
    handleDataEvent(stagesArr);
  }, [handleDataEvent]);

  const onStop = useCallback(() => {
    resetView();
    setToastMsg(`Đã hoàn thành mẻ hệ chiên ${soNoiChien}`);
  }, [resetView, soNoiChien]);

  useSocket({ soNoiChien, onData, onStop });

  const handleTabChange = useCallback((tab: string) => {
    setSoNoiChien(tab);
    resetView();
    setBatchList([]);
    setBatchDetail(null);
    // autoLoad will be triggered by effect below
  }, [resetView, setBatchList, setBatchDetail]);

  // When soNoiChien changes (tab switch), auto-load
  useEffect(() => {
    autoLoad(Number(soNoiChien));
  }, [soNoiChien, autoLoad]);

  const handleRefreshBatchList = useCallback(async () => {
    const docs = await getNoiChien(Number(soNoiChien));
    setBatchList(docs);
  }, [soNoiChien, setBatchList]);

  const handleViewBatch = useCallback(async (id: string) => {
    const detail = await getNoiChienDetail(id, Number(soNoiChien));
    setBatchDetail(detail);
  }, [soNoiChien, setBatchDetail]);

  const handleDeleteBatch = useCallback(async (id: string) => {
    await xoaNoiChienDetail(id, Number(soNoiChien));
    setToastMsg('Đã xóa mẻ chiên');
    const docs = await getNoiChien(Number(soNoiChien));
    setBatchList(docs);
  }, [soNoiChien, setBatchList]);

  const clearToast = useCallback(() => setToastMsg(null), []);

  // Get active stage's sensor data for the grid
  const activeStageIdx = stages.findIndex((s) => s.active);
  const sensorData: SensorData = activeStageIdx >= 0
    ? stages[activeStageIdx].data as SensorData
    : stages[0].data as SensorData ?? ZERO_SENSOR;

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
            <div className={styles.timeDisplay}>
              <span style={{ color: '#1f8836' }}>
                Thời gian: <span style={{ color: '#a5a728' }}>{tongThoiGian}</span> phút
              </span>
            </div>
          </h2>

          <div className={styles.stagesRow}>
            {stages.map((stage, idx) => (
              <StageColumn
                key={idx}
                stage={stage}
                stageIndex={idx + 1}
                donutStartMs={donut.stage === idx + 1 ? donut.startMs : null}
                donutTargetMin={donut.stage === idx + 1 ? donut.targetMin : 0}
                activeDonutStage={donut.stage}
              />
            ))}
          </div>

          <SensorGrid data={sensorData} />
        </div>
      </div>

      <BatchList
        batchList={batchList}
        onView={handleViewBatch}
        onDelete={handleDeleteBatch}
        onRefresh={handleRefreshBatchList}
      />

      {batchDetail && <BatchDetail data={batchDetail} />}

      <Toast message={toastMsg} onDone={clearToast} />
    </div>
  );
}

export default App;
