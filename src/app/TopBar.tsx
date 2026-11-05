import { Link } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { AdminStatus } from './AdminStatus';
import { BrandMark } from './BrandMark';
import { SearchIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './TopBar.module.css';

/** Phone header: the clan's mark and name, and search. */
export function TopBar() {
  const model = useClanStore((s) => s.model);
  const { open } = useOverlays();
  return (
    <header className={styles.wrap}>
      <div className={styles.bar}>
        <Link to="/" className={styles.home} aria-label="Về trang đầu">
          <BrandMark className={styles.mark} size={26} />
          <span className={styles.name}>{model?.settings.title ?? 'Gia phả'}</span>
        </Link>
        <AdminStatus variant="header" />
        <button type="button" className={styles.search} onClick={() => open('tk')} aria-label="Tìm kiếm">
          <SearchIcon />
        </button>
      </div>
    </header>
  );
}
