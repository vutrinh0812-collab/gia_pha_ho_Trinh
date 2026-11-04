import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminError, editSettings, settingsContent } from '@/lib/admin/changes';
import type { ClanSettings } from '@/lib/types';
import { useAdminStore } from '@/store/adminStore';
import { useClanStore } from '@/store/clanStore';
import { AdminGuard } from './AdminGuard';
import styles from './AdminPages.module.css';

const THEMES: Array<[string, string]> = [['minimal', 'Sơn son (màn hình)']];

function SettingsForm() {
  const model = useClanStore((s) => s.model)!;
  const apply = useAdminStore((s) => s.apply);
  const [draft, setDraft] = useState<ClanSettings>(() => settingsContent(model.settings));
  const [error, setError] = useState<string | null>(null);
  const root = model.get(model.rootId);
  const set = (k: keyof ClanSettings, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const text = (k: keyof ClanSettings, label: string, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={`s-${k}`}>{label}</label>
      <input id={`s-${k}`} value={String(draft[k] ?? '')} onChange={(e) => set(k, e.target.value)} aria-describedby={hint ? `s-${k}-h` : undefined} />
      {hint && (
        <span id={`s-${k}-h`} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );

  return (
    <form
      className={styles.page}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await apply(editSettings(model, draft), 'Đã lưu cài đặt.');
        } catch (err) {
          setError(err instanceof AdminError ? err.message : 'Không lưu được.');
        }
      }}
    >
      <p className={styles.back}>
        <Link to="/admin">← Quản trị</Link>
      </p>
      <h1>Cài đặt dòng họ</h1>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.form}>
        {text('clanName', 'Tên dòng họ', 'Ví dụ: Trịnh')}
        {text('title', 'Tiêu đề', 'Hiện ở đầu trang và trên bản in')}
        {text('subtitle', 'Phụ đề', 'Ví dụ: Từ đời 1 đến đời 7, thôn…, xã…')}
        {text('coupletLeft', 'Câu đối bên trái')}
        {text('coupletRight', 'Câu đối bên phải')}
        {text('colophon', 'Lạc khoản', 'Dòng ghi ở góc dưới bản in')}
        <div className={styles.field}>
          <label htmlFor="s-theme">Giao diện mặc định</label>
          <select id="s-theme" value={draft.defaultThemeId} onChange={(e) => set('defaultThemeId', e.target.value)}>
            {THEMES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className={styles.check} htmlFor="s-maternal">
          <input
            id="s-maternal"
            type="checkbox"
            checked={draft.showMaternalDescendants}
            onChange={(e) => set('showMaternalDescendants', e.target.checked)}
          />
          Hiện con cháu bên ngoại (con của con gái) cho mọi người xem
        </label>
        <p className={styles.note}>
          Thủy tổ: <strong>{root?.fullName}</strong>. Muốn thêm đời trên, mở thủy tổ rồi chọn Thao tác → Thêm cha.
        </p>
      </div>
      <button type="submit" className={styles.primary}>
        Lưu cài đặt
      </button>
    </form>
  );
}

export default function SettingsPage() {
  return (
    <AdminGuard>
      <SettingsForm />
    </AdminGuard>
  );
}
