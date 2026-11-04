import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from '@/app/App';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot, subscribeDemo } from '@/lib/data/demoSource';
import { IDLE_LIMIT_MS, resetAdminStoreForTests, useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { useClanStore } from '@/store/clanStore';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

async function signIn() {
  await act(async () => {
    expect(await useAdminStore.getState().signIn('ma-admin-demo')).toBe(true);
  });
}

let unsubscribe: () => void = () => {};
afterEach(() => unsubscribe());

beforeEach(() => {
  sessionStorage.clear();
  resetAdminStoreForTests();
  useAdminUi.getState().close();
  // Like the app, follow the demo clan live so admin writes show up.
  unsubscribe = subscribeDemo((snap) => useClanStore.setState({ status: 'ready', model: buildClanModel(snap), error: null }));
  document.body.style.overflow = '';
});

describe('admin sign-in', () => {
  it('rejects a wrong code and accepts the right one', async () => {
    renderAt('/admin');
    const input = await screen.findByLabelText('Mã admin');
    const submit = screen.getByRole('button', { name: 'Vào chế độ Admin' });
    await waitFor(() => expect(submit).toBeEnabled()); // the previous session is checked first
    fireEvent.change(input, { target: { value: 'sai' } });
    fireEvent.click(submit);
    expect(await screen.findByText('Mã admin không đúng.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ma-admin-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vào chế độ Admin' }));
    expect(await screen.findByRole('heading', { name: 'Quản trị' })).toBeInTheDocument();
    expect(screen.getAllByText('Đang ở chế độ Admin').length).toBeGreaterThan(0);
  });

  it('signs out after 30 minutes without activity', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await signIn();
      expect(useAdminStore.getState().status).toBe('admin');
      await act(async () => {
        vi.advanceTimersByTime(IDLE_LIMIT_MS + 30_000);
      });
      await waitFor(() => expect(useAdminStore.getState().status).toBe('signedOut'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps admin pages closed to visitors', async () => {
    renderAt('/admin/lich-su');
    expect(await screen.findByRole('heading', { name: 'Cần mã admin' })).toBeInTheDocument();
  });
});

describe('admin editing (demo backend)', () => {
  it('edits a person from the detail sheet', async () => {
    await signIn();
    renderAt('/person/p0007');
    const sheet = await screen.findByRole('dialog', { name: /Thông tin/ });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sửa thông tin' }));
    const form = await screen.findByRole('dialog', { name: /Sửa thông tin/ });
    fireEvent.change(within(form).getByLabelText('Nghề nghiệp'), { target: { value: 'Thầy lang' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    await waitFor(() => expect(useClanStore.getState().model?.get('p0007')?.occupation).toBe('Thầy lang'));
  });

  it('suggests the lunar date for a full solar date', async () => {
    await signIn();
    renderAt('/?p=p0007');
    await screen.findByRole('heading', { level: 1 });
    act(() => useAdminUi.getState().open('addChild', 'p0007'));
    const form = await screen.findByRole('dialog', { name: /Thêm con/ });
    const birth = within(form).getByRole('group', { name: 'Ngày sinh' });
    fireEvent.change(within(birth).getAllByLabelText('Năm')[0]!, { target: { value: '2024' } });
    fireEvent.change(within(birth).getAllByLabelText('Tháng')[0]!, { target: { value: '2' } });
    fireEvent.change(within(birth).getAllByLabelText('Ngày')[0]!, { target: { value: '10' } });
    expect(within(birth).getByText(/Âm lịch tương ứng: ngày 1 tháng 1 năm Giáp Thìn/)).toBeInTheDocument();
    fireEvent.click(within(birth).getByRole('button', { name: 'Điền vào' }));
    expect((within(birth).getAllByLabelText('Ngày')[1] as HTMLSelectElement).value).toBe('1');
  });

  it('adds a child from the action menu', async () => {
    await signIn();
    renderAt('/?p=p0007');
    fireEvent.click(await screen.findByRole('button', { name: 'Thao tác (Admin)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm con' }));
    const form = await screen.findByRole('dialog', { name: /Thêm con/ });
    fireEvent.change(within(form).getByLabelText('Họ và tên'), { target: { value: 'Trịnh Văn Thử Nghiệm' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã thêm.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Trịnh Văn Thử Nghiệm/ })).toBeInTheDocument();
  });

  it('refuses to delete someone with children', async () => {
    await signIn();
    renderAt('/?p=p0007');
    await screen.findByRole('heading', { level: 1 });
    act(() => useAdminUi.getState().open('delete', 'p0007'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/còn \d+ người con/);
  });

  it('deletes a leaf, then undoes it from the history', async () => {
    await signIn();
    const model = buildClanModel(loadDemoSnapshot())!;
    const leaf = model.persons.find((p) => p.isBloodline && model.index.unionsOf(p.id).length === 0 && model.generationOf(p.id) === 7)!;
    const { unmount } = renderAt(`/?p=${leaf.id}`);
    await screen.findByRole('heading', { level: 1, name: leaf.fullName });
    act(() => useAdminUi.getState().open('delete', leaf.id));
    const dialog = await screen.findByRole('dialog', { name: `Xóa ${leaf.fullName}` });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(useClanStore.getState().model?.get(leaf.id)).toBeUndefined());
    unmount();

    renderAt('/admin/lich-su');
    const undo = await screen.findByRole('button', { name: `Hoàn tác: Xóa ${leaf.fullName}` });
    fireEvent.click(undo);
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    await waitFor(() => expect(useClanStore.getState().model?.get(leaf.id)?.fullName).toBe(leaf.fullName));
    expect(await screen.findByText(`Hoàn tác: Xóa ${leaf.fullName}`)).toBeInTheDocument();
  });

  it('saves the clan settings', async () => {
    await signIn();
    renderAt('/admin/cai-dat');
    const title = await screen.findByLabelText('Tiêu đề');
    fireEvent.change(title, { target: { value: 'Gia Phả Họ Trịnh Làng An Hòa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByText('Đã lưu cài đặt.')).toBeInTheDocument();
    await waitFor(() => expect(useClanStore.getState().model?.settings.title).toBe('Gia Phả Họ Trịnh Làng An Hòa'));
  });
});
