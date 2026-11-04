import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import { useClanStore } from '@/store/clanStore';
import { BrandMark } from './BrandMark';
import { CalendarIcon, FamilyIcon, ListIcon, MoreIcon, SearchIcon, TreeIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './SideNav.module.css';

/** Desktop sidebar: the clan's name and scope, search, the views and the anniversaries due this week. */
export function SideNav() {
  const model = useClanStore((s) => s.model);
  const { open } = useOverlays();
  const dueThisWeek = useMemo(() => (model ? upcomingAnniversaries(model, todaySolar(), 7).length : 0), [model]);
  const link = ({ isActive }: { isActive: boolean }) => `${styles.link} ${isActive ? styles.active : ''}`;

  return (
    <aside className={styles.side} aria-label="Điều hướng chính">
      <div className={styles.brand}>
        <BrandMark className={styles.mark} size={32} />
        <div className={styles.brandText}>
          <span className={styles.brandName}>{model?.settings.title ?? 'Gia phả'}</span>
          {model && (
            <span className={styles.scope}>
              {model.persons.length} người · {model.gens.maxGeneration} đời
            </span>
          )}
        </div>
      </div>
      <button type="button" className={styles.search} onClick={() => open('tk')}>
        <SearchIcon width={18} height={18} />
        <span>Tìm người</span>
        <kbd>/</kbd>
      </button>
      <nav>
        <ul className={styles.list}>
          <li>
            <NavLink to="/" end className={link}>
              <FamilyIcon width={18} height={18} /> <span>Gia đình</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/so-do" className={link}>
              <TreeIcon width={18} height={18} /> <span>Sơ đồ</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/danh-sach" className={link}>
              <ListIcon width={18} height={18} /> <span>Danh sách</span>
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
        </ul>
      </nav>
      <div className={styles.foot}>
        <button type="button" className={styles.link} onClick={() => open('them')}>
          <MoreIcon width={18} height={18} /> <span>Thêm</span>
        </button>
      </div>
    </aside>
  );
}
