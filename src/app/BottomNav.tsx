import { NavLink } from 'react-router-dom';
import { ListIcon, SearchIcon, SettingsIcon, TreeIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './BottomNav.module.css';

/** Bottom navigation in the thumb zone (SPEC 5A.2): Sơ đồ · Danh sách · Tìm kiếm · Cài đặt. */
export function BottomNav() {
  const { params, open } = useOverlays();
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
      <NavLink to="/danh-sach" className={tabClass}>
        <ListIcon />
        <span>Danh sách</span>
      </NavLink>
      <button
        type="button"
        className={`${styles.item} ${searching ? styles.active : ''}`}
        aria-pressed={searching}
        onClick={() => open('tk')}
      >
        <SearchIcon />
        <span>Tìm kiếm</span>
      </button>
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
