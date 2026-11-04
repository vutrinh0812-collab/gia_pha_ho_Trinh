import { Link } from 'react-router-dom';
import { env, missingEnv } from '@/lib/env';
import { ConnectionCheck } from './ConnectionCheck';
import styles from './Page.module.css';

/**
 * Phase-1 landing page: verifies configuration and Firebase connectivity.
 * Replaced by the mobile "Gia đình" view in phase 3a.
 */
export function HomePage() {
  return (
    <main className={styles.page}>
      <h1>Gia Phả Dòng Họ</h1>
      <p className={styles.muted}>Trang kiểm tra cấu hình, kết nối Firebase và dữ liệu (tạm thời, đến giai đoạn 3).</p>

      <section className={styles.card} aria-labelledby="cfg">
        <h2 id="cfg">Cấu hình</h2>
        {missingEnv.length === 0 ? (
          <p className={styles.ok}>✓ Đã đủ biến môi trường.</p>
        ) : (
          <>
            <p className={styles.err}>Thiếu biến môi trường:</p>
            <ul className={styles.list}>
              {missingEnv.map((k) => (
                <li key={k}>
                  <code>{k}</code>
                </li>
              ))}
            </ul>
            <p>Sao chép <code>.env.example</code> thành <code>.env</code> và điền giá trị (xem README).</p>
          </>
        )}
        <ul className={styles.list}>
          <li>Project: <code>{env.firebase.projectId || '—'}</code></li>
          <li>Dòng họ (clanId): <code>{env.clanId}</code></li>
          <li>Chế độ: {env.useEmulator ? 'Firebase Emulator (máy cục bộ)' : 'Firebase thật'}</li>
        </ul>
      </section>

      {missingEnv.length === 0 && <ConnectionCheck />}

      <nav className={styles.nav} aria-label="Các trang">
        <Link to="/person/demo">Chi tiết người</Link>
        <Link to="/anniversaries">Ngày giỗ</Link>
        <Link to="/themes">Theme</Link>
        <Link to="/print">In A1</Link>
        <Link to="/admin">Admin</Link>
      </nav>
    </main>
  );
}
