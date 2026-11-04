import { lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { env } from '@/lib/env';
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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/person/:id" element={<PlaceholderPage title="Chi tiết người" phase={3} />} />
      <Route path="/anniversaries" element={<PlaceholderPage title="Lịch ngày giỗ" phase={7} />} />
      <Route path="/themes" element={<PlaceholderPage title="Xem trước theme" phase={5} />} />
      <Route path="/print" element={<PrintPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
