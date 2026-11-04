import { useState } from 'react';
import { Link } from 'react-router-dom';
import { env } from '@/lib/env';
import { useAdminStore } from '@/store/adminStore';
import { useClanStore } from '@/store/clanStore';
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
  const busy = status === 'signingIn' || status === 'unknown';
  return (
    <div className={styles.page}>
      <h1>Chế độ Admin</h1>
      <p className={styles.lead}>Nhập mã admin để thêm, sửa hoặc xóa thông tin trong gia phả. Người xem bình thường không cần mã.</p>
      <form
        className={styles.signIn}
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(code);
        }}
      >
        {/* Hidden username so password managers file the code under the admin account. */}
        <input type="text" name="username" autoComplete="username" value={env.adminEmail} readOnly hidden />
        <label htmlFor="admin-code">Mã admin</label>
        <div className={styles.codeRow}>
          <input
            id="admin-code"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
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
          Bản xem thử: mã admin là <strong>ma-admin-demo</strong>. Mọi thay đổi chỉ nằm trong trang này và mất khi tải lại.
        </p>
      )}
      <p className={styles.note}>Phiên admin tự thoát sau 30 phút không thao tác, hoặc khi đóng trình duyệt.</p>
    </div>
  );
}

function AdminHome() {
  const signOut = useAdminStore((s) => s.signOut);
  const model = useClanStore((s) => s.model);
  return (
    <div className={styles.page}>
      <h1>Quản trị</h1>
      <p className={styles.lead}>
        Đang ở chế độ Admin cho <strong>{model?.settings.title}</strong>.
      </p>
      <ul className={styles.links}>
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
        <li>“Thao tác” có: thêm con, thêm vợ hoặc chồng, thêm cha cho thủy tổ, đổi thứ tự anh chị em, xóa.</li>
        <li>Người còn con không xóa được; hãy xóa hoặc chuyển các con trước.</li>
      </ul>
      <button type="button" className={styles.secondary} onClick={() => void signOut()}>
        Thoát chế độ Admin
      </button>
    </div>
  );
}
