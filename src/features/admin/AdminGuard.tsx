import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '@/store/adminStore';
import styles from './AdminPages.module.css';

/** Admin-only pages show a way in instead of their content when not signed in. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const status = useAdminStore((s) => s.status);
  if (status === 'admin') return <>{children}</>;
  return (
    <div className={styles.page}>
      <h1>Cần mã admin</h1>
      <p className={styles.lead}>Trang này chỉ dành cho admin.</p>
      <Link to="/admin" className={styles.primaryLink}>
        Nhập mã admin
      </Link>
    </div>
  );
}
