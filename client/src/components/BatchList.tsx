import React, { FormEvent, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Filter, Pencil, Save, Trash2, X } from 'lucide-react';
import styles from './BatchList.module.css';
import type { BatchListItem } from '../types';

const PAGE_SIZES = [10, 20, 50] as const;

interface BatchFilters {
  from?: string;
  to?: string;
}

interface BatchEditValues {
  ma_me_chien: string;
  ghi_chu: string;
}

interface BatchListProps {
  batchList: BatchListItem[];
  onView: (id: string) => void;
  onEdit: (id: string, values: BatchEditValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: (filters: BatchFilters) => Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
  running: 'Đang chạy',
  completed: 'Hoàn thành',
  error: 'Lỗi',
};

export const BatchList: React.FC<BatchListProps> = ({
  batchList,
  onView,
  onEdit,
  onDelete,
  onRefresh,
}) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BatchListItem | null>(null);
  const [draft, setDraft] = useState<BatchEditValues>({ ma_me_chien: '', ghi_chu: '' });
  const [saving, setSaving] = useState(false);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  const total = batchList.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Giữ trang hợp lệ khi danh sách hoặc số dòng/trang thay đổi
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const startIndex = (page - 1) * pageSize;
  const pageItems = batchList.slice(startIndex, startIndex + pageSize);
  const rangeStart = total === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, total);

  const refresh = async () => {
    if (from && to && from > to) {
      setError('Ngày bắt đầu không được sau ngày kết thúc');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onRefresh({ from: from || undefined, to: to || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách mẻ');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (batch: BatchListItem) => {
    setEditing(batch);
    setDraft({ ma_me_chien: batch.ma_me_chien, ghi_chu: batch.ghi_chu || '' });
    setError(null);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !draft.ma_me_chien.trim()) {
      setError('Mã mẻ không được để trống');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onEdit(editing._id, {
        ma_me_chien: draft.ma_me_chien.trim(),
        ghi_chu: draft.ghi_chu.trim(),
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể sửa mẻ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (batch: BatchListItem) => {
    if (batch.trang_thai === 'running' || !batch.thoi_gian_stop) {
      setError('Không thể xóa mẻ đang chạy');
      return;
    }
    if (!window.confirm(`Xóa mẻ ${batch.ma_me_chien}?`)) return;
    setLoading(true);
    setError(null);
    try {
      await onDelete(batch._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa mẻ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.container} aria-label="Danh sách mẻ chiên">
      <div className={styles.inner}>
        <div className={styles.headingRow}>
          <div>
            <h2 className={styles.title}>Danh sách mẻ chiên</h2>
            <p className={styles.subtitle}>Lịch sử của hệ chiên đang xem</p>
          </div>
          <span className={styles.count}>{total} mẻ</span>
        </div>

        <div className={styles.filters}>
          <label>
            Từ ngày
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button className={styles.filterBtn} onClick={refresh} disabled={loading}>
            <Filter size={16} />
            {loading ? 'Đang tải...' : 'Lọc danh sách'}
          </button>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th>Mã mẻ</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Thời gian hoàn thành</th>
                <th>Ghi chú</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr><td className={styles.empty} colSpan={7}>Không có mẻ phù hợp</td></tr>
              ) : pageItems.map((batch) => (
                <tr key={batch._id}>
                  <td className={styles.code}>{batch.ma_me_chien}</td>
                  <td>{batch.thoi_gian_start || '—'}</td>
                  <td>{batch.thoi_gian_stop || '—'}</td>
                  <td className={styles.duration}>{batch.tong_thoi_gian_chay || 0} phút</td>
                  <td className={styles.note}>{batch.ghi_chu || '—'}</td>
                  <td>
                    <span className={`${styles.status} ${styles[`status_${batch.trang_thai || 'completed'}`]}`}>
                      {STATUS_LABELS[batch.trang_thai || 'completed'] || 'Hoàn thành'}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.viewBtn} title="Xem chi tiết" onClick={() => onView(batch._id)}>
                      <Eye size={15} /> Xem
                    </button>
                    <button className={styles.editBtn} title="Sửa mã mẻ và ghi chú" onClick={() => openEdit(batch)}>
                      <Pencil size={15} /> Sửa
                    </button>
                    <button
                      className={styles.deleteBtn}
                      title="Xóa mẻ"
                      disabled={batch.trang_thai === 'running'}
                      onClick={() => void confirmDelete(batch)}
                    >
                      <Trash2 size={15} /> Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <div className={styles.pageSize}>
            <span className={styles.pageSizeLabel}>Số dòng</span>
            <div className={styles.pageSizeTabs} role="tablist" aria-label="Số dòng mỗi trang">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  role="tab"
                  aria-selected={pageSize === size}
                  className={`${styles.pageSizeTab} ${pageSize === size ? styles.pageSizeTabActive : ''}`}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <span className={styles.pageInfo}>
            {rangeStart}-{rangeEnd} / {total} kết quả
          </span>

          <div className={styles.pageNav}>
            <button
              type="button"
              className={styles.pageBtn}
              aria-label="Trang trước"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.pageCurrent}>{page} / {totalPages}</span>
            <button
              type="button"
              className={styles.pageBtn}
              aria-label="Trang sau"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => !saving && setEditing(null)}>
          <form className={styles.modal} onSubmit={submitEdit} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Sửa thông tin mẻ</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setEditing(null)} disabled={saving}>
                <X size={18} />
              </button>
            </div>
            <label>
              Mã mẻ
              <input value={draft.ma_me_chien} onChange={(event) => setDraft({ ...draft, ma_me_chien: event.target.value })} maxLength={100} />
            </label>
            <label>
              Ghi chú
              <textarea value={draft.ghi_chu} onChange={(event) => setDraft({ ...draft, ghi_chu: event.target.value })} maxLength={500} rows={4} />
            </label>
            <button className={styles.saveBtn} type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
