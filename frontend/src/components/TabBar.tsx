import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Flame, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import styles from './TabBar.module.css';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.brand}>
        {!collapsed && (
          <span className={styles.brandName}>
            <Flame size={20} className="text-brand" />
            <span>Hệ Chiên</span>
          </span>
        )}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <Link to="/" className={styles.overview} title="Tổng quan">
        <LayoutDashboard size={18} />
        {!collapsed && <span>Tổng quan</span>}
      </Link>

      <div className={styles.divider} />
      {!collapsed && <span className={styles.sectionLabel}>Máy chiên</span>}

      <div className={styles.tabList}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            className={`${styles.tabBtn} ${activeTab === String(n) ? styles.active : ''}`}
            onClick={() => onTabChange(String(n))}
            title={`Hệ Chiên ${n}`}
          >
            <Flame size={16} />
            {!collapsed && <span>{`Hệ Chiên ${n}`}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
};
