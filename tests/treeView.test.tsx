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

async function renderTree(search = '') {
  render(
    <MemoryRouter initialEntries={[`/so-do${search}`]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
  return screen.findByRole('group', { name: 'Sơ đồ gia phả' }, { timeout: 5000 });
}

beforeEach(() => {
  useClanStore.setState({ status: 'ready', model, error: null, start: () => {} });
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

  it('filters by branch', async () => {
    await renderTree();
    fireEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    fireEvent.change(screen.getByLabelText('Chi'), { target: { value: 'Chi Ất' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(screen.getByRole('button', { name: /Lọc \(đang lọc 1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('6 đời');
  });

  it('flies to a person picked in search', async () => {
    const target = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === 5 && !model.isMaternal(p.id))!;
    await renderTree('?dr=1');
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: target.fullName } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(target.fullName) })[0]!);
    });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    // Still on the tree, not the family view.
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toBeInTheDocument();
  });

  it('switches the tree to a print theme and back, and remembers it', async () => {
    usePrefsStore.getState().setTreeTheme('son-son');
    const svg = await renderTree();
    const canvas = svg.parentElement!;
    expect(canvas.style.getPropertyValue('--bg')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /^Giao diện/ }));
    const sheet = await screen.findByRole('radiogroup', { name: 'Giao diện' }, { timeout: 5000 });
    const options = within(sheet).getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Sơn son/), expect.stringMatching(/^Men lam/), expect.stringMatching(/^Sơn mài vàng/)]),
    );
    expect(options).toHaveLength(5);
    fireEvent.click(within(sheet).getByRole('radio', { name: /^Sơn mài vàng/ }));
    await vi.waitFor(() => expect(canvas.style.getPropertyValue('--bg')).not.toBe(''));
    expect(usePrefsStore.getState().treeTheme).toBe('son-mai-vang');
    expect(screen.getByRole('button', { name: 'Giao diện: Sơn mài vàng' })).toBeInTheDocument();
    act(() => usePrefsStore.getState().setTreeTheme('son-son'));
    await vi.waitFor(() => expect(canvas.style.getPropertyValue('--bg')).toBe(''));
  });
});
