import React from 'react';
import styles from './TabBar.module.css';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className={styles.header}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <button
          key={n}
          className={`${styles.tabBtn} ${activeTab === String(n) ? styles.active : ''}`}
          onClick={() => onTabChange(String(n))}
        >
          {`Hệ Chiên ${n}`}
        </button>
      ))}
    </div>
  );
};
