import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import styles from './BatchList.module.css';
import type { BatchListItem } from '../types';
import type { ExportFormat } from './batchExport';

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
  /** Tải chi tiết mẻ rồi ghi ra file — trả lỗi để hàng hiển thị thông báo. */
  onDownload: (batch: BatchListItem, format: ExportFormat) => Promise<void>;
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
  onDownload,
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
  /**
   * Menu chọn định dạng của hàng đang mở. Menu render bằng portal với position
   * fixed vì .tableWrap có overflow:auto — menu absolute sẽ bị cắt ở hàng cuối.
   */
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  /** id mẻ đang tải file — chặn bấm trùng và cho biết đang chạy */
  const [downloading, setDownloading] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const anchorsRef = useRef(new Map<string, HTMLButtonElement>());

  const openMenu = useCallback((id: string) => {
    const rect = anchorsRef.current.get(id)?.getBoundingClientRect();
    if (!rect) return;
    setMenu({
      id,
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  const total = batchList.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Giữ trang hợp lệ khi danh sách hoặc số dòng/trang thay đổi
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  // Đóng menu khi bấm ra ngoài, nhấn Esc, hoặc khi trang cuộn/đổi kích thước
  // (menu position:fixed nên phải đóng thay vì trôi lệch khỏi nút).
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorsRef.current.get(menu.id)?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  // Đổi trang / đổi số dòng thì menu của hàng cũ không còn nghĩa
  useEffect(() => {
    setMenu(null);
  }, [page, pageSize]);

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

  const runDownload = async (batch: BatchListItem, format: ExportFormat) => {
    setMenu(null);
    setDownloading(batch._id);
    setError(null);
    try {
      await onDownload(batch, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu mẻ');
    } finally {
      setDownloading(null);
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
                      ref={(node) => {
                        if (node) anchorsRef.current.set(batch._id, node);
                        else anchorsRef.current.delete(batch._id);
                      }}
                      className={styles.downloadBtn}
                      title="Tải dữ liệu mẻ về máy"
                      aria-haspopup="menu"
                      aria-expanded={menu?.id === batch._id}
                      disabled={downloading === batch._id}
                      onClick={() => menu?.id === batch._id ? setMenu(null) : openMenu(batch._id)}
                    >
                      {downloading === batch._id
                        ? <Loader2 size={15} className={styles.spin} />
                        : <Download size={15} />}
                      {downloading === batch._id ? 'Đang tải...' : 'Tải về'}
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

      {menu && (() => {
        const target = batchList.find((item) => item._id === menu.id);
        if (!target) return null;
        return createPortal(
          <div
            ref={menuRef}
            className={styles.downloadMenu}
            role="menu"
            aria-label={`Chọn định dạng tải về cho ${target.ma_me_chien}`}
            style={{ top: menu.top, right: menu.right }}
          >
            <button type="button" role="menuitem" onClick={() => void runDownload(target, 'excel')}>
              <FileSpreadsheet size={15} />
              <span>
                Excel
                <small>Mở trực tiếp bằng Excel</small>
              </span>
            </button>
            <button type="button" role="menuitem" onClick={() => void runDownload(target, 'csv')}>
              <FileText size={15} />
              <span>
                CSV
                <small>Chuẩn, cho Sheets / phân tích</small>
              </span>
            </button>
          </div>,
          document.body,
        );
      })()}

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
