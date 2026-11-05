import { lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { AnniversariesPage } from '@/features/anniversaries/AnniversariesPage';
import { env } from '@/lib/env';
import { AppShell } from './AppShell';
import { PlaceholderPage } from './PlaceholderPage';

// Heavy, rarely-used areas are code-split (SPEC 5A.3 bundle budget).
const PrintPage = lazy(() => import('@/features/print/PrintPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const AdminSettingsPage = lazy(() => import('@/features/admin/SettingsPage'));
const AdminHistoryPage = lazy(() => import('@/features/admin/HistoryPage'));
// The full tree (d3) is only downloaded when the "Sơ đồ" tab is opened (SPEC 5A.3).
const TreeView = lazy(() => import('@/features/tree/TreeView'));
const ProfilePage = lazy(() => import('@/features/person/ProfilePage'));

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

/** Old shared links (/person/:id) open the profile page. */
function PersonLink() {
  const { id = '' } = useParams();
  return <Navigate to={`/nguoi/${encodeURIComponent(id)}`} replace />;
}

/** "/" opens Sơ đồ. Old family links (/?p=id&ct=id) go to that person on the tree. */
function HomeRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams();
  const person = params.get('p') ?? params.get('ct');
  if (person) next.set('f', person);
  if (params.get('ct')) next.set('ct', params.get('ct')!);
  for (const k of ['tk', 'them', 'phim']) if (params.has(k)) next.set(k, params.get(k)!);
  const search = next.toString();
  return <Navigate to={`/so-do${search ? `?${search}` : ''}`} replace />;
}

/** Old /themes links open "In ấn" with the same theme and branch. */
function ThemesRedirect() {
  const [params] = useSearchParams();
  const search = params.toString();
  return <Navigate to={`/print${search ? `?${search}` : ''}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* The family view was removed (D57): the tree is the home screen. */}
        <Route index element={<HomeRedirect />} />
        {/* "Danh sách" was replaced by "Cây dọc" (D55): old links open it. */}
        <Route path="danh-sach" element={<Navigate to="/so-do?xem=doc" replace />} />
        <Route
          path="so-do"
          element={
            <Suspense fallback={<p className="page-loading">Đang tải sơ đồ…</p>}>
              <TreeView />
            </Suspense>
          }
        />
        <Route path="person/:id" element={<PersonLink />} />
        <Route path="nguoi/:id" element={<ProfilePage />} />
        <Route path="anniversaries" element={<AnniversariesPage />} />
        {/* "Giao diện in" is part of "In ấn" now (D62). */}
        <Route path="themes" element={<ThemesRedirect />} />
        <Route path="print" element={<PrintPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/cai-dat" element={<AdminSettingsPage />} />
        <Route path="admin/lich-su" element={<AdminHistoryPage />} />
        {/* The data check page was removed (D62). */}
        <Route path="kiem-tra" element={<Navigate to="/so-do" replace />} />
        <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
      </Route>
    </Routes>
  );
}
