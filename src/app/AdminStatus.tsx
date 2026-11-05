import { Link } from 'react-router-dom';
import { useAdminStore } from '@/store/adminStore';
import styles from './AdminStatus.module.css';

/**
 * "Đang ở chế độ Admin" with a way out (SPEC §4): a small line of text, not a bar.
 * Desktop shows it in the sidebar's bottom corner; phones in the header.
 */
export function AdminStatus({ variant = 'side' }: { variant?: 'side' | 'header' }) {
  const status = useAdminStore((s) => s.status);
  const signOut = useAdminStore((s) => s.signOut);
  if (status !== 'admin') return null;
  return (
    <div className={styles.status} data-variant={variant} role="status">
      <span className={styles.dot} aria-hidden="true" />
      <Link to="/admin" className={styles.label}>
        {variant === 'header' ? 'Admin' : 'Đang ở chế độ Admin'}
      </Link>
      <span aria-hidden="true">·</span>
      <button type="button" className={styles.exit} onClick={() => void signOut()} aria-label="Thoát chế độ Admin">
        Thoát
      </button>
    </div>
  );
}
