import { Link } from 'react-router-dom';
import { useAdminStore } from '@/store/adminStore';
import styles from './AdminStatus.module.css';

/** "Đang ở chế độ Admin" with a way out (SPEC §4), shown wherever the admin is signed in. */
export function AdminStatus({ variant = 'bar' }: { variant?: 'bar' | 'side' | 'chip' }) {
  const status = useAdminStore((s) => s.status);
  const signOut = useAdminStore((s) => s.signOut);
  if (status !== 'admin') return null;
  return (
    <div className={styles.status} data-variant={variant} role="status">
      <Link to="/admin" className={styles.label}>
        Đang ở chế độ Admin
      </Link>
      <button type="button" className={styles.exit} onClick={() => void signOut()}>
        Thoát
      </button>
    </div>
  );
}
