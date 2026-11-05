import { editSettings, settingsContent } from '@/lib/admin/changes';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { env } from '@/lib/env';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { useClanStore } from '@/store/clanStore';
import { useToastStore } from '@/store/toastStore';
import styles from './AdminPages.module.css';

/** /admin — enter the admin code (SPEC §4), then the admin home. */
export default function AdminPage() {
  const status = useAdminStore((s) => s.status);
  return status === 'admin' ? <AdminHome /> : <SignIn />;
}

function SignIn() {
  const { status, error, signIn } = useAdminStore();
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const busy = status === 'signingIn';
  return (
    <div className={styles.page}>
      <h1>Chế độ Admin</h1>
      <p className={styles.lead}>Nhập mật khẩu để thêm, sửa hoặc xóa thông tin trong gia phả. Người xem bình thường không cần mật khẩu.</p>
      <form
        className={styles.signIn}
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(code);
        }}
      >
        <label htmlFor="admin-code">Mật khẩu</label>
        <div className={styles.codeRow}>
          <input
            id="admin-code"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'admin-error' : undefined}
          />
          <button type="button" className={styles.ghost} onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? 'Ẩn' : 'Hiện'}
          </button>
        </div>
        {error && (
          <p id="admin-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={busy}>
          {status === 'signingIn' ? 'Đang kiểm tra…' : 'Vào chế độ Admin'}
        </button>
      </form>
      {env.dataSource === 'demo' && (
        <p className={styles.demo}>
          Bản xem thử: mật khẩu là <strong>ma-admin-demo</strong>. Mọi thay đổi chỉ nằm trong trang này và mất khi tải lại.
        </p>
      )}
      <p className={styles.note}>Phiên admin tự thoát sau 30 phút không thao tác, hoặc khi đóng trình duyệt.</p>
    </div>
  );
}

function AdminHome() {
  const signOut = useAdminStore((s) => s.signOut);
  const model = useClanStore((s) => s.model);
  const openAdmin = useAdminUi((s) => s.open);
  return (
    <div className={styles.page}>
      <h1>Quản trị</h1>
      <p className={styles.lead}>
        Đang ở chế độ Admin cho <strong>{model?.settings.title}</strong>.
      </p>
      <ul className={styles.links}>
        <li>
          <button type="button" className={styles.linkCard} onClick={() => openAdmin('generations', '')}>
            <span className={styles.linkTitle}>Thêm đời trên / dưới</span>
            <span className={styles.linkText}>Thêm tổ tiên ở đời trên cùng, hoặc thêm con để mở đời mới</span>
          </button>
        </li>
        <li>
          <Link to="/admin/cai-dat" className={styles.linkCard}>
            <span className={styles.linkTitle}>Cài đặt dòng họ</span>
            <span className={styles.linkText}>Tên, tiêu đề, câu đối, lạc khoản, hiển thị bên ngoại</span>
          </Link>
        </li>
        <li>
          <Link to="/admin/lich-su" className={styles.linkCard}>
            <span className={styles.linkTitle}>Lịch sử thay đổi</span>
            <span className={styles.linkText}>Xem ai đã sửa gì, và hoàn tác từng thay đổi</span>
          </Link>
        </li>
        <li>
          <div className={styles.linkCard} aria-disabled="true">
            <span className={styles.linkTitle}>Nhập, xuất dữ liệu</span>
            <span className={styles.linkText}>Excel và bản sao lưu JSON, có ở giai đoạn 7</span>
          </div>
        </li>
      </ul>
      <h2 className={styles.h2}>Cách sửa thông tin một người</h2>
      <ul className={styles.howto}>
        <li>Nhấn giữ vào tên người đó (trên điện thoại), hoặc mở “Xem chi tiết” rồi bấm “Sửa” hay “Thao tác”.</li>
        <li>“Thao tác” có: thêm con, thêm vợ hoặc chồng, thêm cha cho người ở Đời 1, đổi thứ tự anh chị em (hoặc các gia đình ở Đời 1), xóa.</li>
        <li>Thêm cả một đời: dùng “Thêm đời trên / dưới” ở trên, hoặc nút cùng tên trên màn Sơ đồ.</li>
        <li>Người còn con không xóa được; hãy xóa hoặc chuyển các con trước.</li>
      </ul>
      <EditPermission />
      <ChangePassword />
      <button type="button" className={styles.secondary} onClick={() => void signOut()}>
        Thoát chế độ Admin
      </button>
    </div>
  );
}

/**
 * D62: the admin opens editing to everyone (no password needed to add and edit people)
 * or locks it (only the admin edits). Saved in the clan settings.
 */
function EditPermission() {
  const model = useClanStore((s) => s.model);
  const apply = useAdminStore((s) => s.apply);
  const [busy, setBusy] = useState(false);
  if (!model) return null;
  const open = model.settings.openEditing === true;
  const choose = async (next: boolean) => {
    if (next === open || busy) return;
    setBusy(true);
    try {
      await apply(
        editSettings(model, { ...settingsContent(model.settings), openEditing: next }),
        next ? 'Đã mở quyền chỉnh sửa cho mọi người.' : 'Đã khóa: chỉ admin được chỉnh sửa.',
      );
    } catch (e) {
      // A check failed before saving: say why instead of doing nothing.
      useToastStore.getState().show(e instanceof Error ? e.message : 'Không lưu được quyền chỉnh sửa.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.permission} aria-labelledby="perm-title">
      <h2 id="perm-title" className={styles.h2}>
        Quyền chỉnh sửa
      </h2>
      <div className={styles.permChoices} role="radiogroup" aria-labelledby="perm-title">
        <button type="button" role="radio" aria-checked={!open} className={styles.permChoice} disabled={busy} onClick={() => void choose(false)}>
          <span className={styles.permTitle}>Khóa</span>
          <span className={styles.permText}>Chỉ admin (có mật khẩu) được thêm, sửa, xóa.</span>
        </button>
        <button type="button" role="radio" aria-checked={open} className={styles.permChoice} disabled={busy} onClick={() => void choose(true)}>
          <span className={styles.permTitle}>Mọi người được chỉnh sửa</span>
          <span className={styles.permText}>Ai mở gia phả cũng thêm, sửa thông tin được, không cần mật khẩu. Cài đặt dòng họ vẫn chỉ admin sửa.</span>
        </button>
      </div>
      {open && <p className={styles.permWarn}>Mọi thay đổi vẫn được ghi trong Lịch sử thay đổi (người sửa: “khách”) và hoàn tác được.</p>}
    </section>
  );
}

function ChangePassword() {
  const changePassword = useAdminStore((s) => s.changePassword);
  const showToast = useToastStore((s) => s.show);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        autoComplete={auto}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </>
  );
  return (
    <>
      <h2 className={styles.h2}>Đổi mật khẩu</h2>
      <form
        className={styles.signIn}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          changePassword(current, next, confirm)
            .then(() => {
              setCurrent('');
              setNext('');
              setConfirm('');
              showToast('Đã đổi mật khẩu. Lần sau hãy dùng mật khẩu mới.');
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không đổi được mật khẩu.'))
            .finally(() => setBusy(false));
        }}
      >
        {field('pw-current', 'Mật khẩu hiện tại', current, setCurrent, 'current-password')}
        {field('pw-next', 'Mật khẩu mới', next, setNext, 'new-password')}
        {field('pw-confirm', 'Nhập lại mật khẩu mới', confirm, setConfirm, 'new-password')}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </>
  );
}
