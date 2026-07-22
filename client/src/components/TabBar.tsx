import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import styles from './TabBar.module.css';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className={styles.header}>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white shadow-pill transition hover:bg-brand-dark"
      >
        <LayoutDashboard size={18} />
        Tổng quan
      </Link>
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
