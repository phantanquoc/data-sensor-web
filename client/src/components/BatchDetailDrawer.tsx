import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { BatchDocument } from '../types';
import { BatchDetail } from './BatchDetail';
import styles from './BatchDetailDrawer.module.css';

interface BatchDetailDrawerProps {
  data: BatchDocument;
  onClose: () => void;
}

export const BatchDetailDrawer: React.FC<BatchDetailDrawerProps> = ({ data, onClose }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${data.ma_me_chien || 'mẻ chiên'}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className={styles.closeButton} type="button" title="Đóng chi tiết" aria-label="Đóng chi tiết" onClick={onClose}>
          <X size={20} />
        </button>
        <BatchDetail data={data} />
      </aside>
    </div>,
    document.body,
  );
};
