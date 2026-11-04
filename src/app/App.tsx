import { lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AnniversariesPage } from '@/features/anniversaries/AnniversariesPage';
import { FamilyView } from '@/features/family/FamilyView';
import { ListView } from '@/features/list/ListView';
import { env } from '@/lib/env';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { PlaceholderPage } from './PlaceholderPage';

// Heavy, rarely-used areas are code-split (SPEC 5A.3 bundle budget).
const PrintPage = lazy(() => import('@/features/print/PrintPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const AdminSettingsPage = lazy(() => import('@/features/admin/SettingsPage'));
const AdminHistoryPage = lazy(() => import('@/features/admin/HistoryPage'));
// The full tree (d3) is only downloaded when the "Sơ đồ" tab is opened (SPEC 5A.3).
const TreeView = lazy(() => import('@/features/tree/TreeView'));

// Embedded previews (claude.ai artifact) cannot use path routing, so they keep routes in memory.
const Router = env.router === 'memory' ? MemoryRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Suspense fallback={<p className="page-loading">Đang tải…</p>}>
        <AppRoutes />
      </Suspense>
    </Router>
  );
}

/** Shared link /person/:id → "Gia đình" centred on that person with the detail sheet open. */
function PersonLink() {
  const { id = '' } = useParams();
  const q = new URLSearchParams({ p: id, ct: id });
  return <Navigate to={`/?${q}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<FamilyView />} />
        <Route path="danh-sach" element={<ListView />} />
        <Route
          path="so-do"
          element={
            <Suspense fallback={<p className="page-loading">Đang tải sơ đồ…</p>}>
              <TreeView />
            </Suspense>
          }
        />
        <Route path="person/:id" element={<PersonLink />} />
        <Route path="anniversaries" element={<AnniversariesPage />} />
        <Route path="themes" element={<PlaceholderPage title="Giao diện in (theme)" phase={5} />} />
        <Route path="print" element={<PrintPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/cai-dat" element={<AdminSettingsPage />} />
        <Route path="admin/lich-su" element={<AdminHistoryPage />} />
        <Route path="kiem-tra" element={<HomePage />} />
        <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
      </Route>
    </Routes>
  );
}
