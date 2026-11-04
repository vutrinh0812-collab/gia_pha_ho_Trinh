import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PersonSheet } from '@/features/person/PersonSheet';
import { SearchOverlay } from '@/features/search/SearchOverlay';
import { useClanStore } from '@/store/clanStore';
import { BottomNav } from './BottomNav';
import { MoreSheet } from './MoreSheet';
import { useOverlays } from './useOverlays';
import styles from './AppShell.module.css';

/** Mobile-first shell: content, bottom navigation and the overlays driven by the URL. */
export function AppShell() {
  const { status, error, model, start } = useClanStore();
  const { params } = useOverlays();
  useEffect(() => start(), [start]);

  const detail = params.get('ct');
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        {status === 'ready' && model ? (
          <Outlet />
        ) : status === 'error' ? (
          <div className={styles.state} role="alert">
            <h1>Không tải được gia phả</h1>
            <p>Kiểm tra kết nối mạng rồi thử lại.</p>
            <p className={styles.small}>{error}</p>
            <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
              Thử lại
            </button>
          </div>
        ) : status === 'empty' ? (
          <div className={styles.state}>
            <h1>Chưa có dữ liệu</h1>
            <p>Gia phả này chưa có thông tin dòng họ. Admin cần nhập dữ liệu trước.</p>
          </div>
        ) : (
          <div className={styles.state} aria-busy="true">
            <p>Đang tải gia phả…</p>
          </div>
        )}
      </main>
      <BottomNav />
      {model && detail && <PersonSheet id={detail} />}
      {model && params.has('tk') && <SearchOverlay />}
      {params.has('them') && <MoreSheet />}
    </div>
  );
}
