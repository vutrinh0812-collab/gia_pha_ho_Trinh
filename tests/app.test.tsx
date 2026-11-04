import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from '@/app/App';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { useClanStore } from '@/store/clanStore';

const model = buildClanModel(loadDemoSnapshot())!;
const root = model.get(model.rootId)!;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useClanStore.setState({ status: 'ready', model, error: null });
  document.body.style.overflow = '';
});

describe('Gia đình view', () => {
  it('opens on the root ancestor with children and bottom navigation', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: root.fullName })).toBeInTheDocument();
    expect(screen.getByText(/Thủy tổ, đời đầu tiên/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    for (const label of ['Gia đình', 'Sơ đồ', 'Danh sách', 'Tìm kiếm', 'Thêm']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it('makes a tapped child the new centre, with parents above', () => {
    renderAt('/');
    const child = model.family(model.rootId)!.partnerships[0]!.children[0]!;
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(child.fullName) })[0]!);
    expect(screen.getByRole('heading', { level: 1, name: child.fullName })).toBeInTheDocument();
    const parents = screen.getByRole('region', { name: 'Cha mẹ' });
    expect(within(parents).getByText(root.fullName)).toBeInTheDocument();
    // Breadcrumb shows the lineage.
    const lineage = screen.getByRole('navigation', { name: 'Dòng dõi' });
    expect(within(lineage).getByText('Đời 2')).toBeInTheDocument();
  });

  it('opens the detail sheet', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }));
    const dialog = screen.getByRole('dialog', { name: `Thông tin ${root.fullName}` });
    expect(within(dialog).getByText('Ngày giỗ')).toBeInTheDocument();
    expect(within(dialog).getByText('Tên húy')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('groups children by wife for a man with two wives', () => {
    const union = [...model.index.unions.values()].find((u) => u.order === 2)!;
    renderAt(`/?p=${union.bloodlinePersonId}`);
    expect(screen.getByText(/Con bà cả/)).toBeInTheDocument();
    expect(screen.getByText(/Con bà hai/)).toBeInTheDocument();
    expect(screen.getByText('Vợ cả')).toBeInTheDocument();
  });
});

describe('shared person link', () => {
  it('/person/:id centres the person and opens the sheet', () => {
    const p = model.persons.find((x) => model.generationOf(x.id) === 4 && x.isBloodline)!;
    renderAt(`/person/${p.id}`);
    expect(screen.getByRole('heading', { level: 1, name: p.fullName })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: `Thông tin ${p.fullName}` })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('finds people without diacritics and shows who they are', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    const input = screen.getByRole('searchbox');
    const plain = root.fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    fireEvent.change(input, { target: { value: plain } });
    const hit = screen.getAllByRole('button', { name: new RegExp(root.fullName) })[0]!;
    expect(hit).toHaveTextContent('Đời 1');
    fireEvent.click(hit);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: `Thông tin ${root.fullName}` });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: root.fullName })).toBeInTheDocument();
  });

  it('says when nothing matches', () => {
    renderAt('/?tk=1');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzxyz' } });
    expect(screen.getByText(/Không tìm thấy ai/)).toBeInTheDocument();
  });
});

describe('Danh sách view', () => {
  it('lists generations and expands one grouped by branch', () => {
    renderAt('/danh-sach');
    const gen3 = screen.getByRole('button', { name: /Đời 3/ });
    expect(gen3).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(gen3);
    expect(gen3).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Chi Giáp' })).toBeInTheDocument();
  });
});

describe('other pages', () => {
  it('lists the upcoming death anniversaries', () => {
    renderAt('/anniversaries');
    expect(screen.getByRole('heading', { name: 'Ngày giỗ' })).toBeInTheDocument();
    expect(screen.getAllByText(/âm lịch/).length).toBeGreaterThan(0);
  });

  it('previews every print theme', async () => {
    renderAt('/themes');
    expect(await screen.findByRole('heading', { name: 'Giao diện in' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Bản in/ }).length).toBe(4);
  });

  it('lazy-loads the print page', async () => {
    renderAt('/print');
    expect(await screen.findByRole('heading', { name: 'In khổ A1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Phạm vi in')).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderAt('/khong-co');
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
  });

  it('shows a loading state before data arrives', () => {
    useClanStore.setState({ status: 'loading', model: null, start: () => {} });
    renderAt('/');
    expect(screen.getByText('Đang tải gia phả…')).toBeInTheDocument();
  });
});
