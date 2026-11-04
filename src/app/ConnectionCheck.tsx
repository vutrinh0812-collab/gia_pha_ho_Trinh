import { useEffect, useState } from 'react';
import styles from './Page.module.css';

type Status =
  | { kind: 'checking' }
  | { kind: 'ok'; hasSettings: boolean; fromCache: boolean }
  | { kind: 'error'; message: string };

/** Reads clans/{clanId}/settings/main to prove Firestore connectivity + read rules. */
export function ConnectionCheck() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ doc, getDoc }, { getDb, paths }] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase'),
        ]);
        const snap = await getDoc(doc(getDb(), paths.settings()));
        if (!cancelled) {
          setStatus({ kind: 'ok', hasSettings: snap.exists(), fromCache: snap.metadata.fromCache });
        }
      } catch (e) {
        if (!cancelled) setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.card} aria-labelledby="conn" aria-live="polite">
      <h2 id="conn">Kết nối Firestore</h2>
      {status.kind === 'checking' && <p>Đang kiểm tra…</p>}
      {status.kind === 'ok' && (
        <>
          <p className={styles.ok}>✓ Kết nối thành công{status.fromCache ? ' (từ bộ nhớ đệm)' : ''}.</p>
          <p>
            {status.hasSettings
              ? 'Đã có tài liệu cài đặt dòng họ.'
              : 'Chưa có dữ liệu dòng họ — sẽ tạo bằng script seed ở giai đoạn 2.'}
          </p>
        </>
      )}
      {status.kind === 'error' && (
        <>
          <p className={styles.err}>✗ Không kết nối được.</p>
          <p>
            <code>{status.message}</code>
          </p>
          <p className={styles.muted}>Kiểm tra lại cấu hình trong .env, hoặc emulator đã chạy chưa.</p>
        </>
      )}
    </section>
  );
}
