import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './HomePage';
import { PlaceholderPage } from './PlaceholderPage';

// Heavy, rarely-used areas are code-split (SPEC 5A.3 bundle budget).
const PrintPage = lazy(() => import('@/features/print/PrintPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="page-loading">Đang tải…</p>}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
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
