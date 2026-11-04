import { lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { FamilyView } from '@/features/family/FamilyView';
import { ListView } from '@/features/list/ListView';
import { env } from '@/lib/env';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { PlaceholderPage } from './PlaceholderPage';

// Heavy, rarely-used areas are code-split (SPEC 5A.3 bundle budget).
const PrintPage = lazy(() => import('@/features/print/PrintPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));

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
            <PlaceholderPage title="Sơ đồ cây" phase="3b">
              Sơ đồ toàn bộ dòng họ, phóng to thu nhỏ bằng hai ngón tay, đang được làm ở bước tiếp theo.
            </PlaceholderPage>
          }
        />
        <Route path="person/:id" element={<PersonLink />} />
        <Route path="anniversaries" element={<PlaceholderPage title="Lịch ngày giỗ" phase={7} />} />
        <Route path="themes" element={<PlaceholderPage title="Giao diện in (theme)" phase={5} />} />
        <Route path="print" element={<PrintPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="kiem-tra" element={<HomePage />} />
        <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
      </Route>
    </Routes>
  );
}
