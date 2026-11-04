import { Link } from 'react-router-dom';
import { env, missingEnv } from '@/lib/env';
import { DataCheck } from './DataCheck';
import styles from './Page.module.css';

/**
 * Temporary landing page (phases 1–2): verifies configuration, data and the
 * calendar logic. Replaced by the mobile "Gia đình" view in phase 3a.
 */
export function HomePage() {
  return (
    <main className={styles.page}>
      <h1>Gia Phả Dòng Họ</h1>
      <p className={styles.muted}>
        Trang kiểm tra tạm thời của giai đoạn 1–2. Giao diện xem gia phả thật sẽ có ở giai đoạn 3.
      </p>
      {env.dataSource === 'demo' && (
        <p className={styles.notice}>Bản xem thử: dùng dữ liệu mẫu hư cấu, chưa nối với Firebase.</p>
      )}

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
          {env.dataSource === 'firebase' && (
            <>
              <li>Project: <code>{env.firebase.projectId || '—'}</code></li>
              <li>Dòng họ (clanId): <code>{env.clanId}</code></li>
            </>
          )}
          <li>
            Nguồn dữ liệu:{' '}
            {env.dataSource === 'demo'
              ? 'dữ liệu mẫu trong trình duyệt'
              : env.useEmulator
                ? 'Firebase Emulator (máy cục bộ)'
                : 'Firebase thật'}
          </li>
        </ul>
      </section>

      {missingEnv.length === 0 && <DataCheck />}

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
