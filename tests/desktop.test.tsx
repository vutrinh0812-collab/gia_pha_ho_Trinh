import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from '@/app/App';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { useClanStore } from '@/store/clanStore';

const model = buildClanModel(loadDemoSnapshot())!;
const root = model.get(model.rootId)!;

function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 960px') ? desktop : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

const press = (key: string, opts: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
  });

beforeEach(() => {
  useClanStore.setState({ status: 'ready', model, error: null, start: () => {} });
  document.body.style.overflow = '';
});

afterEach(() => {
  // @ts-expect-error reset the mock between tests
  delete window.matchMedia;
});

describe('desktop layout', () => {
  beforeEach(() => mockMatchMedia(true));

  it('shows details in a non-modal side panel and keeps the tree usable', async () => {
    const { container } = renderAt(`/so-do?ct=${root.id}`);
    const panel = await screen.findByRole('dialog', { name: `Thông tin ${root.fullName}` });
    expect(panel).toHaveAttribute('aria-modal', 'false');
    expect(document.body.style.overflow).toBe('');
    expect(container.querySelector('[data-panel]')).not.toBeNull();
    // The tree is still there beside the panel.
    expect(await screen.findByRole('group', { name: 'Sơ đồ gia phả' }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('phone layout', () => {
  beforeEach(() => mockMatchMedia(false));

  it('keeps the modal bottom sheet', async () => {
    renderAt(`/so-do?ct=${root.id}`);
    expect(await screen.findByRole('dialog', { name: `Thông tin ${root.fullName}` })).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('keyboard shortcuts', () => {
  beforeEach(() => mockMatchMedia(true));

  it('/ and Ctrl+K open search; Esc closes it', () => {
    renderAt('/');
    press('/');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    press('k', { ctrlKey: true });
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('typing in the search box does not trigger shortcuts', () => {
    renderAt('/anniversaries?tk=1');
    const input = screen.getByRole('searchbox');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    });
    expect(screen.queryByRole('heading', { name: /Sơ đồ/ })).not.toBeInTheDocument();
  });

  it('number keys switch views and ? shows the shortcut list', async () => {
    renderAt('/');
    press('2');
    expect(screen.getByRole('heading', { name: 'Ngày giỗ' })).toBeInTheDocument();
    press('?');
    expect(screen.getByRole('dialog', { name: 'Phím tắt' })).toBeInTheDocument();
  });

  it('tree keys collapse the chart', async () => {
    renderAt('/so-do');
    await screen.findByRole('group', { name: 'Sơ đồ gia phả' });
    press('c');
    expect(screen.getByRole('heading', { name: /Sơ đồ/ })).toHaveTextContent('2 đời');
  });
});
