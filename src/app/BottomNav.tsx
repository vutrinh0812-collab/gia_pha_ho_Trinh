import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import { useClanStore } from '@/store/clanStore';
import { CalendarIcon, PrintIcon, SearchIcon, SettingsIcon, TreeIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './BottomNav.module.css';

/** Bottom navigation in the thumb zone (SPEC 5A.2): Sơ đồ · Ngày giỗ · Tìm kiếm · In ấn · Cài đặt (the sidebar's items; In ấn has its own tab, D87). */
export function BottomNav() {
  const { params, open, close } = useOverlays();
  const model = useClanStore((s) => s.model);
  const dueThisWeek = useMemo(() => (model ? upcomingAnniversaries(model, todaySolar(), 7).length : 0), [model]);
  const searching = params.has('tk');
  const more = params.has('them');
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.item} ${isActive && !searching && !more ? styles.active : ''}`;

  return (
    <nav className={styles.nav} aria-label="Điều hướng chính">
      <NavLink to="/so-do" className={tabClass}>
        <TreeIcon />
        <span>Sơ đồ</span>
      </NavLink>
      <NavLink to="/anniversaries" className={tabClass}>
        <span className={styles.iconWrap}>
          <CalendarIcon />
          {dueThisWeek > 0 && (
            <span className={styles.badge} aria-label={`${dueThisWeek} ngày giỗ trong 7 ngày tới`}>
              {dueThisWeek}
            </span>
          )}
        </span>
        <span>Ngày giỗ</span>
      </NavLink>
      <button
        type="button"
        className={`${styles.item} ${searching ? styles.active : ''}`}
        aria-pressed={searching}
        // Search stays above this bar: tapping its tab again closes it.
        onClick={() => (searching ? close('tk') : open('tk'))}
      >
        <SearchIcon />
        <span>Tìm kiếm</span>
      </button>
      <NavLink to="/print" className={tabClass}>
        <PrintIcon />
        <span>In ấn</span>
      </NavLink>
      <button
        type="button"
        className={`${styles.item} ${more ? styles.active : ''}`}
        aria-pressed={more}
        onClick={() => open('them')}
      >
        <SettingsIcon />
        <span>Cài đặt</span>
      </button>
    </nav>
  );
}
