import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PersonSheet } from '@/features/person/PersonSheet';
import { SearchOverlay } from '@/features/search/SearchOverlay';
import { useClanStore } from '@/store/clanStore';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { MoreSheet } from './MoreSheet';
import { ShortcutHelp } from './ShortcutHelp';
import { StatusBanner } from './StatusBanner';
import { Toast } from './Toast';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';

// Admin panels are only downloaded once an admin opens one.
const AdminLayer = lazy(() => import('@/features/admin/AdminLayer'));
import { isInDialog, useHotkeys } from './useHotkeys';
import { useIsDesktop } from './useMediaQuery';
import { useOverlays } from './useOverlays';
import styles from './AppShell.module.css';

/** Mobile-first shell: content, bottom navigation and the overlays driven by the URL. */
export function AppShell() {
  const { status, error, model, start } = useClanStore();
  const { params, open } = useOverlays();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  // The tree has its own floating header; every other phone screen shows the clan's name.
  const showTopBar = !desktop && pathname !== '/so-do';
  useEffect(() => start(), [start]);
  useEffect(() => useAdminStore.getState().init(), []);
  const isAdmin = useAdminStore((s) => s.status === 'admin');
  const adminAction = useAdminUi((s) => s.action);

  // Global shortcuts (see ShortcutHelp).
  useHotkeys((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      open('tk');
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') {
      open('tk');
      return true;
    }
    if (e.key === '?') {
      open('phim');
      return true;
    }
    if (isInDialog(e.target)) return;
    const tab = { '1': '/so-do', '2': '/danh-sach', '3': '/anniversaries' }[e.key];
    if (tab) {
      navigate(tab);
      return true;
    }
  });

  const detail = params.get('ct');
  const panelOpen = desktop && (Boolean(detail) || params.has('them') || params.has('phim'));
  return (
    <div className={styles.shell} data-panel={panelOpen || undefined}>
      {desktop ? <SideNav /> : showTopBar && <TopBar />}
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
      {!desktop && <BottomNav />}
      <StatusBanner />
      <Toast />
      {model && detail && <PersonSheet id={detail} />}
      {model && params.has('tk') && <SearchOverlay />}
      {params.has('them') && <MoreSheet />}
      {params.has('phim') && <ShortcutHelp />}
      {/* Last, so admin panels open above the detail sheet and other overlays. */}
      {isAdmin && adminAction && model && (
        <Suspense fallback={null}>
          <AdminLayer />
        </Suspense>
      )}
    </div>
  );
}
