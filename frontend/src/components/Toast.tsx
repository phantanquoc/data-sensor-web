import React, { useEffect, useState } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string | null;
  onDone: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDone();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onDone]);

  if (!visible || !message) return null;

  return (
    <div className={styles.toast}>
      {message}
    </div>
  );
};
