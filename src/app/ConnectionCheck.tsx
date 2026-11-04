import { useEffect, useState } from 'react';
import type { ClanSettings, PersonFields, UnionFields } from '@/lib/types';
import styles from './Page.module.css';

interface Summary {
  title: string;
  persons: number;
  unions: number;
  generations: number;
  unreachable: number;
}

type Status =
  | { kind: 'checking' }
  | { kind: 'ok'; fromCache: boolean; summary: Summary | null }
  | { kind: 'error'; message: string };

/** Reads the clan data to prove Firestore connectivity, read rules and generation computing. */
export function ConnectionCheck() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ collection, doc, getDoc, getDocs }, { getDb, paths }, gen] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase'),
          import('@/lib/generation'),
        ]);
        const db = getDb();
        const snap = await getDoc(doc(db, paths.settings()));
        let summary: Summary | null = null;
        if (snap.exists()) {
          const settings = snap.data() as ClanSettings;
          const [persons, unions] = await Promise.all([
            getDocs(collection(db, paths.persons())),
            getDocs(collection(db, paths.unions())),
          ]);
          const index = gen.buildFamilyIndex(
            persons.docs.map((d) => ({ id: d.id, ...(d.data() as PersonFields) })),
            unions.docs.map((d) => ({ id: d.id, ...(d.data() as UnionFields) })),
          );
          const result = gen.computeGenerations(index, settings.rootPersonId);
          summary = {
            title: settings.title,
            persons: persons.size,
            unions: unions.size,
            generations: result.maxGeneration,
            unreachable: result.unreachable.length,
          };
        }
        if (!cancelled) setStatus({ kind: 'ok', fromCache: snap.metadata.fromCache, summary });
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
          {status.summary ? (
            <ul className={styles.list}>
              <li>
                <strong>{status.summary.title}</strong>
              </li>
              <li>{status.summary.persons} người, {status.summary.unions} quan hệ hôn nhân</li>
              <li>{status.summary.generations} đời</li>
              {status.summary.unreachable > 0 && (
                <li className={styles.warn}>{status.summary.unreachable} người chưa nối được vào cây</li>
              )}
            </ul>
          ) : (
            <p>
              Chưa có dữ liệu dòng họ. Chạy <code>npm run seed</code> để tạo dữ liệu mẫu.
            </p>
          )}
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
