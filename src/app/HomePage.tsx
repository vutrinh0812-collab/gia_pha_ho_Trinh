import { env, missingEnv } from '@/lib/env';
import { DataCheck } from './DataCheck';
import styles from './Page.module.css';

/** "Kiểm tra dữ liệu": configuration, data statistics and the lunar calendar tools. */
export function HomePage() {
  return (
    <div className={styles.plain}>
      <h1>Kiểm tra dữ liệu</h1>
      <p className={styles.muted}>
        Thống kê dữ liệu, ngày giỗ sắp tới và công cụ đổi ngày âm – dương.
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

    </div>
  );
}
