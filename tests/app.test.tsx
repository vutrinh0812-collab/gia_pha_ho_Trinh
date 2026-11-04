import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from '@/app/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

describe('routing', () => {
  it('renders the anniversaries placeholder in Vietnamese', () => {
    renderAt('/anniversaries');
    expect(screen.getByRole('heading', { name: 'Lịch ngày giỗ' })).toBeInTheDocument();
  });

  it('lazy-loads the print page', async () => {
    renderAt('/print');
    expect(await screen.findByRole('heading', { name: 'In khổ A1' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderAt('/khong-co');
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
  });
});
