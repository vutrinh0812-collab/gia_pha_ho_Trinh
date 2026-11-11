import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('home', () => {
  const outline = () => screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 });

  it('opens Sơ đồ (the family view was removed), with the bottom navigation', async () => {
    renderAt('/');
    expect(await outline()).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    for (const label of ['Sơ đồ', 'Ngày giỗ', 'Tìm kiếm', 'In ấn', 'Cài đặt']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    expect(within(nav).queryByText('Gia đình')).not.toBeInTheDocument();
    // "In ấn" is its own tab (D87) and opens the print page.
    fireEvent.click(within(nav).getByText('In ấn'));
    expect(await screen.findByRole('heading', { level: 1, name: 'In ấn' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('old family links (/?p=id) go to that person on the tree', async () => {
    const target = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === 4 && !model.isMaternal(p.id))!;
    renderAt(`/?p=${target.id}`);
    const list = await outline();
    await waitFor(() => expect(within(list).getAllByRole('listitem').some((li) => li.getAttribute('data-row') === target.id)).toBe(true));
  });

  it('the detail sheet shows the profile without the old action buttons or totals', async () => {
    renderAt(`/so-do?ct=${root.id}`);
    const dialog = await screen.findByRole('dialog', { name: `Thông tin ${root.fullName}` });
    expect(within(dialog).getByRole('heading', { name: root.fullName })).toBeInTheDocument();
    expect(within(dialog).getByText(/^Giỗ ngày/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Húy/)).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'Gia đình' })).toBeInTheDocument();
    for (const name of [/^Gia đình$/, /Trang cá nhân/, /Chia sẻ/, /Dòng dõi/]) {
      expect(within(dialog).queryByRole('button', { name })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(within(dialog).queryByText(/con cháu/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('shared person link', () => {
  it('/person/:id opens the profile page', async () => {
    const p = model.persons.find((x) => model.generationOf(x.id) === 4 && x.isBloodline)!;
    renderAt(`/person/${p.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: p.fullName })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: `Trang của ${p.fullName}` })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Giới thiệu & tiểu sử' })).toBeInTheDocument();
  });

  it('opens a relative from the profile page', async () => {
    renderAt(`/nguoi/${root.id}`);
    await screen.findByRole('heading', { level: 1, name: root.fullName });
    const child = model.family(root.id)!.partnerships[0]!.children[0]!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(child.fullName) }));
    expect(await screen.findByRole('heading', { level: 1, name: child.fullName })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('finds people without diacritics and goes to them on the tree', async () => {
    const target = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === 3 && !model.isMaternal(p.id))!;
    renderAt('/anniversaries');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getByRole('button', { name: 'Tìm kiếm' }));
    const input = screen.getByRole('searchbox');
    const plain = target.fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    fireEvent.change(input, { target: { value: plain } });
    const searchDialog = screen.getByRole('dialog', { name: 'Tìm kiếm' });
    const hit = within(searchDialog).getAllByRole('button', { name: new RegExp(target.fullName) })[0]!;
    expect(hit).toHaveTextContent('Đời 3');
    fireEvent.click(hit);
    expect(screen.queryByRole('dialog', { name: 'Tìm kiếm' })).not.toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 });
    await waitFor(() => expect(within(list).getAllByRole('listitem').find((li) => li.getAttribute('data-row') === target.id)).toHaveAttribute('data-mark', 'flash'));
  });

  it('says when nothing matches', () => {
    renderAt('/?tk=1');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzxyz' } });
    expect(screen.getByText(/Không tìm thấy ai/)).toBeInTheDocument();
  });
});

describe('old Danh sách links', () => {
  it('open the vertical tree, which replaced the list', async () => {
    renderAt('/danh-sach');
    expect(await screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('other pages', () => {
  it('lists the upcoming death anniversaries', () => {
    renderAt('/anniversaries');
    expect(screen.getByRole('heading', { name: 'Ngày giỗ' })).toBeInTheDocument();
    expect(screen.getAllByText(/âm lịch/).length).toBeGreaterThan(0);
  });

  it('"In ấn" shows every print theme to pick, and the A1 preview (D62)', async () => {
    renderAt('/print');
    expect(await screen.findByRole('heading', { level: 1, name: 'In ấn' }, { timeout: 5000 })).toBeInTheDocument();
    const picker = screen.getByRole('heading', { name: 'Giao diện khung' }).parentElement!;
    const options = within(picker).getAllByRole('button', { name: /^Giao diện / });
    // D91: only the frame presets, "Đỏ son sen vàng", "Hoa điểu trên lụa", "Sơn mài rồng vàng".
    expect(options.map((b) => b.getAttribute('aria-label'))).toEqual(['Giao diện Đỏ son sen vàng', 'Giao diện Hoa điểu trên lụa', 'Giao diện Sơn mài rồng vàng']);
    // No stored default in the sample clan: "Hoa điểu trên lụa" is chosen.
    expect(options.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'))).toEqual(['Giao diện Hoa điểu trên lụa']);
    fireEvent.click(options[1]!);
    expect(options[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Phạm vi in')).toBeInTheDocument();
    // D91: no frame-package import, no theme description, no phone note.
    expect(screen.queryByRole('button', { name: /Nhập gói giao diện|Tải JSON mẫu/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Nền lụa mộc|Trên điện thoại vẫn/);
    // D72: the title written on the sheet is typed here; the PDF is one click away.
    expect(screen.getByRole('textbox', { name: 'Tiêu đề' })).toHaveValue(useClanStore.getState().model!.settings.title);
    expect(screen.getByRole('button', { name: 'Tải PDF khổ A1' })).toBeInTheDocument();
    // D73: no tick boxes for colophon, couplets, spouses… on the print page.
    expect(screen.queryByRole('checkbox', { name: /Lạc khoản|Câu đối|Dâu, rể/ })).toBeNull();
  });

  it('printing one branch adds no caption line under the title (D76)', async () => {
    const model = useClanStore.getState().model!;
    const someone = model.persons.find((p) => model.generationOf(p.id) === 3)!;
    renderAt(`/print?goc=${someone.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'In ấn' }, { timeout: 5000 })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/đầy đủ con cháu|các nhánh khác thu gọn/);
  });

  it('old /themes links open "In ấn"', async () => {
    renderAt('/themes');
    expect(await screen.findByRole('heading', { level: 1, name: 'In ấn' }, { timeout: 5000 })).toBeInTheDocument();
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
