import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminBackend } from '@/lib/admin/backend';
import { AdminError, undoGroup, type AuditRecord } from '@/lib/admin/changes';
import { normalizeVi } from '@/lib/search';
import { useAdminStore } from '@/store/adminStore';
import { useClanStore } from '@/store/clanStore';
import { useToastStore } from '@/store/toastStore';
import { AdminGuard } from './AdminGuard';
import styles from './AdminPages.module.css';

interface Group {
  id: string;
  at: number;
  summary: string;
  entries: AuditRecord[];
}

const pad = (n: number) => String(n).padStart(2, '0');
function when(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Lịch sử thay đổi (SPEC §6): every admin action, newest first, each undoable. */
function History() {
  const model = useClanStore((s) => s.model)!;
  const apply = useAdminStore((s) => s.apply);
  const [records, setRecords] = useState<AuditRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [day, setDay] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRecords(await (await getAdminBackend()).listAudit(500));
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, model]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of records ?? []) {
      const id = r.groupId ?? r.id;
      const g = map.get(id) ?? { id, at: r.at, summary: r.summary ?? `${r.action} ${r.docId}`, entries: [] };
      g.entries.push(r);
      map.set(id, g);
    }
    const nq = normalizeVi(q);
    return [...map.values()].filter((g) => (!nq || normalizeVi(g.summary).includes(nq)) && (!day || dayKey(g.at) === day));
  }, [records, q, day]);

  const undo = async (g: Group) => {
    setConfirming(null);
    try {
      const set = undoGroup(model, g.entries, g.summary);
      if (await apply(set, 'Đã hoàn tác.')) await load();
    } catch (e) {
      useToastStore.getState().show(e instanceof AdminError ? e.message : 'Không hoàn tác được.', 'error');
    }
  };

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link to="/admin">← Quản trị</Link>
      </p>
      <h1>Lịch sử thay đổi</h1>
      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="h-q">Tìm theo tên hoặc nội dung</label>
          <input id="h-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="vd. trinh van an" />
        </div>
        <div className={styles.field}>
          <label htmlFor="h-day">Ngày</label>
          <input id="h-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      {failed ? (
        <p className={styles.error} role="alert">
          Không tải được lịch sử.{' '}
          <button type="button" className={styles.textButton} onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      ) : records === null ? (
        <p className={styles.note}>Đang tải…</p>
      ) : groups.length === 0 ? (
        <p className={styles.note}>{records.length ? 'Không có thay đổi nào khớp bộ lọc.' : 'Chưa có thay đổi nào.'}</p>
      ) : (
        <ol className={styles.history}>
          {groups.map((g) => (
            <li key={g.id} className={styles.entry}>
              <div className={styles.entryText}>
                <span className={styles.entrySummary}>{g.summary}</span>
                <span className={styles.entryMeta}>
                  {when(g.at)} · {g.entries.length} thay đổi
                </span>
              </div>
              {confirming === g.id ? (
                <div className={styles.entryActions}>
                  <button type="button" className={styles.primarySmall} onClick={() => void undo(g)}>
                    Hoàn tác
                  </button>
                  <button type="button" className={styles.ghost} onClick={() => setConfirming(null)}>
                    Thôi
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.ghost} onClick={() => setConfirming(g.id)} aria-label={`Hoàn tác: ${g.summary}`}>
                  Hoàn tác…
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AdminGuard>
      <History />
    </AdminGuard>
  );
}
