import React from 'react';
import styles from './BatchList.module.css';
import type { BatchListItem } from '../types';

interface BatchListProps {
  batchList: BatchListItem[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export const BatchList: React.FC<BatchListProps> = ({ batchList, onView, onDelete, onRefresh }) => {
  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Danh sách mẻ chiên</h2>
        <button className={styles.refreshBtn} onClick={onRefresh}>
          Hiển thị danh sách
        </button>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th className={styles.th}>Thời gian bắt đầu</th>
                <th className={styles.th}>Thời gian kết thúc</th>
                <th className={styles.th}>ID</th>
                <th className={styles.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {batchList.length === 0 ? (
                <tr>
                  <td className={styles.td}>---</td>
                  <td className={styles.td}>---</td>
                  <td className={styles.td}>---</td>
                  <td className={styles.td}>---</td>
                </tr>
              ) : (
                batchList.map((doc) => (
                  <tr key={doc._id} className={styles.row}>
                    <td className={styles.td}>{doc.thoi_gian_start}</td>
                    <td className={styles.td}>{doc.thoi_gian_stop}</td>
                    <td className={styles.td}>{doc._id}</td>
                    <td className={styles.td}>
                      <button className={styles.viewBtn} onClick={() => onView(doc._id)}>
                        Xem
                      </button>
                      <button className={styles.deleteBtn} onClick={() => onDelete(doc._id)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
