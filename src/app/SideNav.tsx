import { useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import { useClanStore } from '@/store/clanStore';
import { AdminStatus } from './AdminStatus';
import { BrandMark } from './BrandMark';
import { CalendarIcon, SearchIcon, SettingsIcon, TreeIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './SideNav.module.css';

/** Desktop sidebar: the clan's name and scope (links home), search, the views, anniversaries due this week and settings. */
export function SideNav() {
  const model = useClanStore((s) => s.model);
  const { params, open } = useOverlays();
  const settingsOpen = params.has('them');
  const dueThisWeek = useMemo(() => (model ? upcomingAnniversaries(model, todaySolar(), 7).length : 0), [model]);
  const link = ({ isActive }: { isActive: boolean }) => `${styles.link} ${isActive ? styles.active : ''}`;

  return (
    <aside className={styles.side} aria-label="Điều hướng chính">
      <Link to="/" className={styles.brand} aria-label="Về trang đầu">
        <BrandMark className={styles.mark} size={32} />
        <div className={styles.brandText}>
          <span className={styles.brandName}>{model?.settings.title ?? 'Gia phả'}</span>
          {model && (
            <span className={styles.scope}>
              {model.persons.length} người · {model.gens.maxGeneration} đời
            </span>
          )}
        </div>
      </Link>
      <button type="button" className={styles.search} onClick={() => open('tk')}>
        <SearchIcon width={18} height={18} />
        <span>Tìm kiếm</span>
        <kbd>/</kbd>
      </button>
      <nav>
        <ul className={styles.list}>
          <li>
            <NavLink to="/so-do" className={link}>
              <TreeIcon width={18} height={18} /> <span>Sơ đồ</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/anniversaries" className={link}>
              <CalendarIcon width={18} height={18} /> <span>Ngày giỗ</span>
              {dueThisWeek > 0 && (
                <span className={styles.count} aria-label={`${dueThisWeek} ngày giỗ trong 7 ngày tới`}>
                  {dueThisWeek}
                </span>
              )}
            </NavLink>
          </li>
          <li>
            <button
              type="button"
              className={`${styles.link} ${settingsOpen ? styles.active : ''}`}
              aria-pressed={settingsOpen}
              onClick={() => open('them')}
            >
              <SettingsIcon width={18} height={18} /> <span>Cài đặt</span>
            </button>
          </li>
        </ul>
      </nav>
      <div className={styles.foot}>
        <AdminStatus variant="side" />
      </div>
    </aside>
  );
}
