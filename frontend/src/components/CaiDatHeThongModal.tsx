/**
 * Modal cài đặt áp suất chân không mục tiêu cho TỪNG nồi trong dàn 8 nồi.
 *
 * Lý do nhập tay: PLC không có thanh ghi áp suất cài đặt (khác nhiệt độ), nên
 * đường mục tiêu trên biểu đồ chỉ có thể do người vận hành cung cấp.
 *
 * Lý do có chiều máy: mỗi nồi chạy công thức và bơm chân không riêng, nên một
 * bộ giá trị dùng chung cho cả dàn vẽ sai mục tiêu ở những nồi lệch công thức.
 *
 * Ô trống = CHƯA cài đặt → gửi lên null, tuyệt đối không gửi 0: 0 vừa là một
 * con số hợp lệ được lưu, vừa không vẽ đường ở tầng biểu đồ, nên coi trống là 0
 * sẽ lưu một mục tiêu giả mà lại không thấy đường nào.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Gauge, CopyCheck } from 'lucide-react';
import { luuCaiDatHeThong, getCaiDatHeThong } from '../api';
import { setApSuatCaiDatCache } from '../hooks/apSuatCaiDatStore';
import type { ApSuatCaiDat, ApSuatCaiDatMay } from '../types';

interface CaiDatHeThongModalProps {
  onClose: () => void;
  /** Gọi khi lưu thành công — dùng để hiện toast ở trang cha. */
  onSaved?: (message: string) => void;
}

const STAGES = [
  { key: 'giai_doan_1' as const, label: 'Giai đoạn 1' },
  { key: 'giai_doan_2' as const, label: 'Giai đoạn 2' },
  { key: 'giai_doan_3' as const, label: 'Giai đoạn 3' },
  { key: 'giai_doan_4' as const, label: 'Giai đoạn 4' },
];

/** Số máy 1-based khớp với `noi_chien_1..8`, route `/may/:n` và phòng socket `noi_N`. */
const MACHINES = [1, 2, 3, 4, 5, 6, 7, 8];

type StageKey = (typeof STAGES)[number]['key'];
type FormValues = Record<StageKey, string>;
type FormErrors = Partial<Record<StageKey, string>>;
/** Bản nháp của CẢ 8 máy được giữ trong state để chuyển máy không mất phần đang sửa. */
type AllFormValues = Record<number, FormValues>;
type AllFormErrors = Record<number, FormErrors>;

const EMPTY_FORM: FormValues = {
  giai_doan_1: '',
  giai_doan_2: '',
  giai_doan_3: '',
  giai_doan_4: '',
};

function emptyAllValues(): AllFormValues {
  const out: AllFormValues = {};
  for (const n of MACHINES) out[n] = { ...EMPTY_FORM };
  return out;
}

/** null → ô trống (không hiện 0, vì 0 và "chưa cài đặt" là hai trạng thái khác nhau). */
function toFormValues(may: Partial<ApSuatCaiDatMay> | null | undefined): FormValues {
  const out = { ...EMPTY_FORM };
  if (!may) return out;
  for (const { key } of STAGES) {
    const v = may[key];
    out[key] = typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  }
  return out;
}

/** Trải cấu hình đã lưu (đã được backend mở về đủ 8 máy) thành bản nháp của form. */
function toAllFormValues(cfg: ApSuatCaiDat | null): AllFormValues {
  const out = emptyAllValues();
  if (!cfg) return out;
  for (const n of MACHINES) {
    // Backend trả khoá số, nhưng JSON object luôn có khoá chuỗi — nhận cả hai.
    const may = (cfg as Record<string | number, Partial<ApSuatCaiDatMay> | undefined>)[n]
      ?? (cfg as Record<string | number, Partial<ApSuatCaiDatMay> | undefined>)[String(n)];
    out[n] = toFormValues(may);
  }
  return out;
}

/**
 * Chấp nhận số thập phân, chặn số âm và chuỗi không phải số — chặn TRƯỚC khi gọi API.
 * Kiểm cả 8 máy chứ không chỉ máy đang hiện: một giá trị sai ở máy đang ẩn vẫn
 * sẽ bị backend từ chối, nên phải chặn tại chỗ và chỉ ra máy nào sai.
 */
function validateAll(all: AllFormValues): { errors: AllFormErrors; payload: ApSuatCaiDat } {
  const errors: AllFormErrors = {};
  const payload = {} as ApSuatCaiDat;
  for (const n of MACHINES) {
    const values = all[n] ?? EMPTY_FORM;
    const perMayErrors: FormErrors = {};
    const perMay: ApSuatCaiDatMay = {
      giai_doan_1: null,
      giai_doan_2: null,
      giai_doan_3: null,
      giai_doan_4: null,
    };
    for (const { key } of STAGES) {
      const raw = values[key].trim();
      if (raw === '') {
        perMay[key] = null;
        continue;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        perMayErrors[key] = 'Phải là một số hợp lệ';
        continue;
      }
      if (num < 0) {
        perMayErrors[key] = 'Không được nhập số âm';
        continue;
      }
      perMay[key] = num;
    }
    if (Object.values(perMayErrors).some(Boolean)) errors[n] = perMayErrors;
    payload[n] = perMay;
  }
  return { errors, payload };
}

export const CaiDatHeThongModal: React.FC<CaiDatHeThongModalProps> = ({ onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allValues, setAllValues] = useState<AllFormValues>(emptyAllValues);
  const [allErrors, setAllErrors] = useState<AllFormErrors>({});
  const [activeMay, setActiveMay] = useState<number>(MACHINES[0]);
  const [copiedNote, setCopiedNote] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useMemo(() => `cai-dat-he-thong-title`, []);

  const values = allValues[activeMay] ?? EMPTY_FORM;
  const errors = allErrors[activeMay] ?? {};

  // Không đóng modal khi đang lưu: request đã bay, đóng giữa đường khiến người
  // dùng không biết kết quả lưu.
  const requestClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  // Gọi thẳng API thay vì qua store: store cố tình nuốt lỗi mạng và trả null để
  // biểu đồ không sập, nhưng ở màn sửa thì "tải lỗi" phải hiện rõ — nếu không,
  // người vận hành thấy các ô trống rồi bấm Lưu sẽ xoá mất cấu hình đang có.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCaiDatHeThong()
      .then((res) => {
        if (cancelled) return;
        const cfg = res?.ap_suat_cai_dat ?? null;
        // Đồng bộ luôn vào store: đã tốn một lượt gọi mạng thì biểu đồ đang mở
        // cũng nên dùng bản mới nhất này.
        setApSuatCaiDatCache(cfg);
        setAllValues(toAllFormValues(cfg));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Không thể tải cài đặt hệ thống');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape để đóng + bẫy focus trong modal (Tab/Shift+Tab không thoát ra ngoài).
  // Bộ chọn máy là các <button> nên tự nằm trong danh sách focusable dưới đây.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  // Chặn scroll trang nền + trả focus về đúng nút đã mở modal khi đóng.
  // Đặt ở cleanup của một effect duy nhất để MỌI đường đóng (Lưu, Hủy, Escape,
  // bấm ra ngoài) đều khôi phục focus, không phải nhớ xử lý riêng từng đường.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      // Nút mở có thể đã bị gỡ khỏi DOM (dropdown đóng lại) — focus vào phần tử
      // rời DOM sẽ ném focus về <body>, nên kiểm tra trước.
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const root = dialogRef.current;
    if (!root) return;
    const firstInput = root.querySelector<HTMLElement>('input');
    (firstInput ?? root).focus();
  }, [loading]);

  const handleChange = (key: StageKey, raw: string) => {
    setAllValues((prev) => ({
      ...prev,
      [activeMay]: { ...(prev[activeMay] ?? EMPTY_FORM), [key]: raw },
    }));
    setCopiedNote(null);
    // Xoá lỗi của đúng ô đang sửa để thông báo không đứng lại sau khi đã sửa đúng.
    setAllErrors((prev) => {
      const perMay = prev[activeMay];
      if (!perMay || !perMay[key]) return prev;
      return { ...prev, [activeMay]: { ...perMay, [key]: undefined } };
    });
  };

  // Chép giá trị đang nhập của máy hiện tại sang cả 8 máy. Chỉ đụng bản nháp
  // trong state — chưa ghi gì xuống server cho tới khi bấm Lưu, để người dùng
  // còn kịp sửa lại hoặc bấm Hủy.
  const handleApplyToAll = () => {
    if (saving) return;
    const source = { ...(allValues[activeMay] ?? EMPTY_FORM) };
    const next: AllFormValues = {};
    for (const n of MACHINES) next[n] = { ...source };
    setAllValues(next);
    setAllErrors({});
    setSaveError(null);
    setCopiedNote(`Đã chép giá trị của Nồi ${activeMay} sang cả 8 nồi (chưa lưu)`);
  };

  const handleSave = async () => {
    if (saving) return;
    const { errors: found, payload } = validateAll(allValues);
    const machinesWithError = MACHINES.filter((n) => found[n]);
    if (machinesWithError.length > 0) {
      setAllErrors(found);
      setSaveError(null);
      setCopiedNote(null);
      // Nếu lỗi nằm ở máy đang ẩn thì tự chuyển sang máy đó: báo lỗi mà không
      // cho thấy ô sai thì người dùng không biết sửa ở đâu.
      if (!found[activeMay]) setActiveMay(machinesWithError[0]);
      return; // Không gọi API khi dữ liệu chưa hợp lệ.
    }
    setAllErrors({});
    setSaveError(null);
    setCopiedNote(null);
    setSaving(true);
    try {
      const res = await luuCaiDatHeThong(payload);
      // Đẩy vào store để biểu đồ đang mở vẽ lại ngay, không cần tải lại trang.
      setApSuatCaiDatCache(res?.ap_suat_cai_dat ?? payload);
      setSaving(false);
      onSaved?.('Đã lưu cài đặt áp suất');
      onClose();
    } catch (err) {
      // Giữ modal mở và giữ nguyên giá trị đã nhập để người dùng thử lại được.
      setSaving(false);
      setSaveError(err instanceof Error ? err.message : 'Không thể lưu cài đặt hệ thống');
    }
  };

  const machinesWithError = MACHINES.filter((n) => allErrors[n]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-cardHover focus:outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <Gauge size={18} />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-text-primary">
                Cài đặt hệ thống
              </h2>
              <p className="text-xs text-text-secondary">
                Áp chân không cài đặt — riêng cho từng nồi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="Đóng cài đặt"
            title="Đóng"
            className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-overlay hover:text-text-primary disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-text-secondary">Đang tải cài đặt…</p>
        ) : loadError ? (
          <p className="rounded-xl border border-val-red/30 bg-val-red/10 px-4 py-3 text-sm text-val-red">
            {loadError}
          </p>
        ) : (
          <>
            {/* Bộ chọn nồi. Trạng thái đang chọn báo bằng aria-pressed chứ không
                chỉ bằng màu, để trình đọc màn hình cũng biết đang ở nồi nào. */}
            <div
              role="group"
              aria-label="Chọn nồi chiên cần cài đặt"
              className="mb-3 grid grid-cols-4 gap-2"
            >
              {MACHINES.map((n) => {
                const isActive = n === activeMay;
                const hasError = Boolean(allErrors[n]);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setActiveMay(n)}
                    disabled={saving}
                    aria-pressed={isActive}
                    aria-label={`Nồi ${n}${hasError ? ' — có giá trị chưa hợp lệ' : ''}`}
                    className={`rounded-lg border px-2 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                      isActive
                        ? 'border-brand bg-brand text-white'
                        : hasError
                          ? 'border-val-red text-val-red hover:bg-val-red/10'
                          : 'border-border text-text-secondary hover:bg-surface-overlay'
                    }`}
                  >
                    Nồi {n}
                  </button>
                );
              })}
            </div>

            <p className="mb-3 text-xs text-text-muted">
              Đang sửa <span className="font-semibold text-text-secondary">Nồi {activeMay}</span>. Để trống nếu
              giai đoạn đó chưa có mục tiêu — biểu đồ sẽ không vẽ đường cho giai đoạn đó.
            </p>
            <div className="space-y-3">
              {STAGES.map(({ key, label }) => (
                <div key={key}>
                  <label
                    htmlFor={`ap-suat-${key}`}
                    className="mb-1 block text-sm font-medium text-text-secondary"
                  >
                    {label}
                  </label>
                  <input
                    id={`ap-suat-${key}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={values[key]}
                    disabled={saving}
                    onChange={(e) => handleChange(key, e.target.value)}
                    aria-invalid={errors[key] ? true : undefined}
                    aria-describedby={errors[key] ? `ap-suat-${key}-error` : undefined}
                    placeholder="Chưa cài đặt"
                    className={`w-full rounded-lg border bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${
                      errors[key] ? 'border-val-red focus:border-val-red' : 'border-border focus:border-brand'
                    }`}
                  />
                  {errors[key] && (
                    <p id={`ap-suat-${key}-error`} className="mt-1 text-xs font-medium text-val-red">
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApplyToAll}
              disabled={saving}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay disabled:opacity-50"
            >
              <CopyCheck size={14} />
              Áp dụng cho tất cả 8 nồi
            </button>

            {copiedNote && (
              <p role="status" className="mt-2 text-xs font-medium text-text-secondary">
                {copiedNote}
              </p>
            )}

            {machinesWithError.length > 0 && (
              <p className="mt-3 rounded-xl border border-val-red/30 bg-val-red/10 px-4 py-2 text-xs font-medium text-val-red">
                Còn giá trị chưa hợp lệ ở: {machinesWithError.map((n) => `Nồi ${n}`).join(', ')}
              </p>
            )}

            {saveError && (
              <p className="mt-4 rounded-xl border border-val-red/30 bg-val-red/10 px-4 py-3 text-sm text-val-red">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={requestClose}
                disabled={saving}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-pill transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
