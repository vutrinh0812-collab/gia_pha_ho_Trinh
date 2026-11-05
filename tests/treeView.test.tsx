import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from '@/app/App';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';

const model = buildClanModel(loadDemoSnapshot())!;
const root = model.get(model.rootId)!;

/** The search overlay's box (the tree has its own "Lọc theo tên" box too). */
const searchDialogInput = () => within(screen.getByRole('dialog', { name: 'Tìm kiếm' })).getByRole('searchbox');

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

/** The chart layout ("Sơ đồ ngang"); tests run at phone width, where "Cây dọc" is the default. */
async function renderTree(search = '') {
  const params = new URLSearchParams(search);
  params.set('xem', 'ngang');
  render(
    <MemoryRouter initialEntries={[`/so-do?${params}`]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
  return screen.findByRole('group', { name: 'Sơ đồ gia phả' }, { timeout: 5000 });
}

beforeEach(() => {
  useClanStore.setState({ status: 'ready', model, error: null, start: () => {} });
  usePrefsStore.setState({ treeLayout: null });
  sessionStorage.clear();
  document.body.style.overflow = '';
});

describe('Sơ đồ view', () => {
  it('draws the root and the generation rail', async () => {
    const svg = await renderTree();
    expect(within(svg).getByRole('button', { name: new RegExp(`^${root.fullName}, đời 1`) })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('7 đời');
  });

  it('opens the detail sheet when a node is tapped, with a lineage action', async () => {
    const svg = await renderTree();
    fireEvent.click(within(svg).getByRole('button', { name: new RegExp(`^${root.fullName}`) }));
    const dialog = screen.getByRole('dialog', { name: `Thông tin ${root.fullName}` });
    fireEvent.click(within(dialog).getByRole('button', { name: /Dòng dõi/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Dòng dõi: ${root.fullName}`);
  });

  it('collapses everything to two generations and expands again', async () => {
    const svg = await renderTree();
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('2 đời');
    expect(within(svg).getAllByRole('button', { name: /Mở rộng nhánh/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mở hết' }));
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('7 đời');
  });

  it('shows a range of generations picked on the slider', async () => {
    await renderTree();
    const slider = screen.getByRole('group', { name: 'Hiển thị theo đời' });
    expect(slider).toHaveTextContent('Đời 1–7');
    fireEvent.change(within(slider).getByRole('slider', { name: 'Từ đời' }), { target: { value: '2' } });
    fireEvent.change(within(slider).getByRole('slider', { name: 'Đến đời' }), { target: { value: '4' } });
    expect(slider).toHaveTextContent('Đời 2–4');
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('3 đời');
    fireEvent.click(within(slider).getByRole('button', { name: 'Hiện tất cả các đời' }));
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('7 đời');
  });

  it('flies to a person picked in search', async () => {
    const target = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === 5 && !model.isMaternal(p.id))!;
    await renderTree('?dr=1');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getByRole('button', { name: 'Tìm kiếm' }));
    fireEvent.change(searchDialogInput(), { target: { value: target.fullName } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(target.fullName) })[0]!);
    });
    expect(screen.queryByRole('dialog', { name: 'Tìm kiếm' })).not.toBeInTheDocument();
    // Still on the tree, not the family view.
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toBeInTheDocument();
  });

  it('always shows the Ember screen theme, with no theme picker', async () => {
    const svg = await renderTree();
    expect(svg.parentElement!.style.getPropertyValue('--bg')).toBe('');
    expect(screen.queryByRole('button', { name: /^Giao diện/ })).not.toBeInTheDocument();
  });
});

describe('Cây dọc (phone layout of Sơ đồ)', () => {
  const outline = () => screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 });
  const firstChild = model.family(model.rootId)!.partnerships[0]!.children[0]!;
  /** The name button of a row (the toggle next to it is labelled "Mở/Thu nhánh …"). */
  const nameButtons = (list: HTMLElement, name: string) =>
    within(list)
      .queryAllByRole('button', { name: new RegExp(name) })
      .filter((b) => !b.hasAttribute('aria-label'));

  it('is the default on a phone: the root ancestor with their children, readable rows', async () => {
    renderAt('/so-do');
    const list = await outline();
    expect(nameButtons(list, root.fullName)).toHaveLength(1);
    expect(nameButtons(list, firstChild.fullName)).toHaveLength(1);
    expect(within(list).getByRole('button', { name: `Thu nhánh ${root.fullName}` })).toHaveAttribute('aria-expanded', 'true');
    expect(within(list).getByRole('button', { name: `Mở nhánh ${firstChild.fullName}` })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('7 đời');
  });

  it('opens and closes a branch', async () => {
    renderAt('/so-do');
    const list = await outline();
    const grandchild = model.family(firstChild.id)!.partnerships[0]!.children[0]!;
    expect(nameButtons(list, grandchild.fullName)).toHaveLength(0);
    fireEvent.click(within(list).getByRole('button', { name: `Mở nhánh ${firstChild.fullName}` }));
    expect(nameButtons(list, grandchild.fullName)).toHaveLength(1);
    fireEvent.click(within(list).getByRole('button', { name: `Thu nhánh ${firstChild.fullName}` }));
    expect(nameButtons(list, grandchild.fullName)).toHaveLength(0);
  });

  it('opens the detail sheet when a name is tapped, and closes in one click after switching people', async () => {
    renderAt('/so-do');
    const list = await outline();
    const secondChild = model.family(model.rootId)!.partnerships[0]!.children[1]!;

    fireEvent.click(nameButtons(list, root.fullName)[0]!);
    expect(screen.getByRole('dialog', { name: `Thông tin ${root.fullName}` })).toBeInTheDocument();

    fireEvent.click(nameButtons(list, firstChild.fullName)[0]!);
    expect(screen.getByRole('dialog', { name: `Thông tin ${firstChild.fullName}` })).toBeInTheDocument();

    fireEvent.click(nameButtons(list, secondChild.fullName)[0]!);
    const dialog = screen.getByRole('dialog', { name: `Thông tin ${secondChild.fullName}` });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('goes to a person picked in search, opening their line', async () => {
    const target = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === 5 && !model.isMaternal(p.id))!;
    renderAt('/so-do');
    await outline();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getByRole('button', { name: 'Tìm kiếm' }));
    fireEvent.change(searchDialogInput(), { target: { value: target.fullName } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(target.fullName) })[0]!);
    });
    const list = await outline();
    await vi.waitFor(() => expect(nameButtons(list, target.fullName)).toHaveLength(1));
    expect(nameButtons(list, target.fullName)[0]!.closest('li')).toHaveAttribute('data-mark', 'flash');
  });

  it('switches to the chart and remembers the choice', async () => {
    renderAt('/so-do');
    await outline();
    fireEvent.click(within(screen.getByRole('group', { name: 'Kiểu sơ đồ' })).getByRole('button', { name: 'Ngang' }));
    expect(await screen.findByRole('group', { name: 'Sơ đồ gia phả' }, { timeout: 5000 })).toBeInTheDocument();
    expect(usePrefsStore.getState().treeLayout).toBe('ngang');
    fireEvent.click(within(screen.getByRole('group', { name: 'Kiểu sơ đồ' })).getByRole('button', { name: 'Dọc' }));
    expect(await outline()).toBeInTheDocument();
    expect(usePrefsStore.getState().treeLayout).toBe('doc');
  });
});

describe('generation slider in Cây dọc', () => {
  it('limits the outline to the chosen generations, and never lets the thumbs cross', async () => {
    renderAt('/so-do');
    await screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 });
    const slider = screen.getByRole('group', { name: 'Hiển thị theo đời' });
    const from = within(slider).getByRole('slider', { name: 'Từ đời' });
    const to = within(slider).getByRole('slider', { name: 'Đến đời' });
    fireEvent.change(to, { target: { value: '3' } });
    fireEvent.change(from, { target: { value: '5' } });
    // "Từ đời" cannot pass "Đến đời".
    expect(slider).toHaveTextContent('Đời 3');
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('1 đời');
  });

  it('has no other filters', async () => {
    renderAt('/so-do');
    await screen.findByRole('list', { name: 'Cây gia phả' }, { timeout: 5000 });
    expect(screen.queryByRole('searchbox', { name: 'Lọc theo tên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bộ lọc/ })).not.toBeInTheDocument();
  });
});
