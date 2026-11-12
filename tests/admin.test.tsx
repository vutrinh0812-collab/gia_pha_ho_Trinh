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
    const input = await screen.findByLabelText('Mật khẩu');
    const submit = screen.getByRole('button', { name: 'Vào chế độ Admin' });
    await waitFor(() => expect(submit).toBeEnabled()); // the previous session is checked first
    fireEvent.change(input, { target: { value: 'sai' } });
    fireEvent.click(submit);
    expect(await screen.findByText('Mật khẩu không đúng.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ma-admin-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vào chế độ Admin' }));
    expect(await screen.findByRole('heading', { name: 'Quản trị' })).toBeInTheDocument();
    // The small admin note (header on phones, sidebar on desktop) with its way out.
    expect(screen.getAllByRole('button', { name: 'Thoát chế độ Admin' }).length).toBeGreaterThan(0);
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
    expect(await screen.findByRole('heading', { name: 'Cần mật khẩu admin' })).toBeInTheDocument();
  });
});

describe('admin editing (demo backend)', () => {
  it('edits a person from the detail sheet', async () => {
    await signIn();
    renderAt('/?p=p0007&ct=p0007');
    const sheet = await screen.findByRole('dialog', { name: /Thông tin/ });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const form = await screen.findByRole('dialog', { name: /Sửa thông tin/ });
    fireEvent.change(within(form).getByLabelText('Nghề nghiệp'), { target: { value: 'Thầy lang' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    await waitFor(() => expect(useClanStore.getState().model?.get('p0007')?.occupation).toBe('Thầy lang'));
  });

  it('suggests the lunar date for a full solar date', async () => {
    await signIn();
    renderAt('/nguoi/p0007');
    await screen.findByRole('heading', { level: 1 });
    act(() => useAdminUi.getState().open('addChild', 'p0007'));
    const form = await screen.findByRole('dialog', { name: /Thêm con/ });
    const birth = within(form).getByRole('group', { name: 'Ngày sinh' });
    // D93: one wheel, day – month – year; spin buttons for the keyboard (arrows, typed digits).
    const wheel = within(birth).getByRole('group', { name: /ngày, tháng, năm/ });
    const [day, month, year] = within(wheel).getAllByRole('spinbutton');
    expect([day, month, year].map((x) => x!.getAttribute('aria-label'))).toEqual(['Ngày', 'Tháng', 'Năm']);
    for (const k of '2024') fireEvent.keyDown(year!, { key: k });
    expect(year).toHaveAttribute('aria-valuetext', '2024');
    fireEvent.keyDown(month!, { key: 'ArrowDown' });
    fireEvent.keyDown(month!, { key: 'ArrowDown' });
    expect(month).toHaveAttribute('aria-valuetext', 'tháng 2');
    // Typed before the month was known, a day beyond February would come back to the 29th.
    fireEvent.keyDown(day!, { key: '1' });
    fireEvent.keyDown(day!, { key: '0' });
    expect(day).toHaveAttribute('aria-valuetext', '10');
    expect(within(birth).getByText('Đã chọn: ngày 10 tháng 2 năm 2024')).toBeInTheDocument();
    expect(within(birth).getByText(/Âm lịch tương ứng: ngày 1 tháng 1 năm Giáp Thìn/)).toBeInTheDocument();
    fireEvent.click(within(birth).getByRole('button', { name: 'Điền vào' }));
    expect((within(birth).getByLabelText('Ngày', { selector: 'select' }) as HTMLSelectElement).value).toBe('1');
  });

  it('adds a child from the edit form', async () => {
    await signIn();
    renderAt('/nguoi/p0007');
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const edit = await screen.findByRole('dialog', { name: /Sửa thông tin/ });
    fireEvent.click(within(edit).getByRole('button', { name: 'Thêm con' }));
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
    const { unmount } = renderAt(`/nguoi/${leaf.id}`);
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

  it('adds a generation below from Cài đặt ("Tùy chỉnh nhánh gia phả"), no longer from the tree', async () => {
    await signIn();
    renderAt('/so-do?them=1');
    fireEvent.click(await screen.findByRole('button', { name: /Tùy chỉnh nhánh gia phả/ }, { timeout: 5000 }));
    expect(screen.queryByRole('button', { name: /Thêm đời trên \/ dưới/ })).toBeNull();
    const sheet = await screen.findByRole('dialog', { name: 'Thêm đời' }, { timeout: 5000 });
    const model = useClanStore.getState().model!;
    const deepest = model.persons.find((p) => p.isBloodline && model.generationOf(p.id) === model.gens.maxGeneration)!;
    fireEvent.change(within(sheet).getByLabelText('Thêm con cho'), { target: { value: deepest.id } });
    fireEvent.click(within(sheet).getByRole('button', { name: `Thêm con (Đời ${model.gens.maxGeneration + 1})` }));
    const form = await screen.findByRole('dialog', { name: `Thêm con của ${deepest.fullName}` });
    fireEvent.change(within(form).getByLabelText('Họ và tên'), { target: { value: 'Trịnh Đời Mới' } });
    fireEvent.click(within(form).getByRole('button', { name: /Lưu|Thêm/ }));
    await waitFor(() => expect(useClanStore.getState().model!.gens.maxGeneration).toBe(model.gens.maxGeneration + 1));
  });

  it('adds a generation above from the admin page', async () => {
    await signIn();
    renderAt('/admin');
    const before = useClanStore.getState().model!;
    fireEvent.click(await screen.findByRole('button', { name: /Tùy chỉnh nhánh gia phả/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Thêm đời' }, { timeout: 5000 });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Thêm tổ tiên ở đời trên' }));
    const form = await screen.findByRole('dialog', { name: /Thêm cha của/ });
    fireEvent.change(within(form).getByLabelText('Họ và tên'), { target: { value: 'Trịnh Tổ Mới' } });
    fireEvent.click(within(form).getByRole('button', { name: /Lưu|Thêm/ }));
    await waitFor(() => expect(useClanStore.getState().model!.get(useClanStore.getState().model!.rootId)!.fullName).toBe('Trịnh Tổ Mới'));
    expect(useClanStore.getState().model!.generationOf(before.rootId)).toBe(2);
  });
});

describe('admin password', () => {
  it('changes the password from the admin page', async () => {
    await signIn();
    renderAt('/admin');
    await screen.findByRole('heading', { name: 'Đổi mật khẩu' });
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'ma-admin-demo' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Hai lần nhập mật khẩu mới không giống nhau.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await waitFor(() => expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue(''));

    await act(async () => {
      await useAdminStore.getState().signOut();
    });
    await act(async () => {
      expect(await useAdminStore.getState().signIn('ma-admin-demo')).toBe(false);
      expect(await useAdminStore.getState().signIn('1234')).toBe(true);
    });
    // Put the demo password back for the other tests.
    await act(async () => {
      await useAdminStore.getState().changePassword('1234', 'ma-admin-demo', 'ma-admin-demo');
    });
  });
});

describe('password lock', () => {
  it('hashes with the salt and accepts the default password', async () => {
    const { checkPassword, defaultLock, makeLock, DEFAULT_ADMIN_PASSWORD } = await import('@/lib/admin/lock');
    const def = await defaultLock();
    expect(def.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkPassword(DEFAULT_ADMIN_PASSWORD, def)).toBe(true);
    expect(await checkPassword(` ${DEFAULT_ADMIN_PASSWORD} `, def)).toBe(true);
    expect(await checkPassword('7150566', def)).toBe(false);
    const lock = await makeLock('mat-khau-moi');
    expect(lock.hash).not.toContain('mat-khau-moi');
    expect(await checkPassword('mat-khau-moi', lock)).toBe(true);
  });
});

describe('editing open to everyone (D62)', () => {
  afterEach(async () => {
    // Put the shared demo clan back to "locked" for the other tests.
    const { demoDocs } = await import('@/lib/data/demoStore');
    const s = useClanStore.getState().model!.settings;
    const { openEditing: _drop, ...rest } = s as typeof s & { openEditing?: boolean };
    demoDocs.setSettings(rest);
  });

  it('the admin opens editing; then a viewer without the password can add a child, but not change the clan settings', async () => {
    await signIn();
    const { unmount } = renderAt('/admin');
    const choice = await screen.findByRole('radio', { name: /Mọi người được chỉnh sửa/ });
    expect(screen.getByRole('radio', { name: /Khóa/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(choice);
    await waitFor(() => expect(useClanStore.getState().model?.settings.openEditing).toBe(true));
    unmount();
    await act(async () => {
      await useAdminStore.getState().signOut();
    });

    // A viewer: no password, but the edit buttons are there and saving works.
    renderAt('/nguoi/p0007');
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const edit = await screen.findByRole('dialog', { name: /Sửa thông tin/ });
    fireEvent.click(within(edit).getByRole('button', { name: 'Thêm con' }));
    const form = await screen.findByRole('dialog', { name: /Thêm con/ });
    fireEvent.change(within(form).getByLabelText('Họ và tên'), { target: { value: 'Trịnh Văn Khách Thêm' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã thêm.')).toBeInTheDocument();
    expect(screen.queryAllByText('Mọi người đang được chỉnh sửa').length + screen.queryAllByText('Được sửa').length).toBeGreaterThan(0);

    // Clan settings stay admin-only.
    const { editSettings, settingsContent } = await import('@/lib/admin/changes');
    const model = useClanStore.getState().model!;
    let ok = true;
    await act(async () => {
      ok = await useAdminStore.getState().apply(editSettings(model, { ...settingsContent(model.settings), title: 'Đổi bởi khách' }));
    });
    expect(ok).toBe(false);
    expect(useClanStore.getState().model?.settings.title).not.toBe('Đổi bởi khách');
  });

  it('when locked, a viewer sees no edit buttons', async () => {
    renderAt('/nguoi/p0007');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa hồ sơ' })).not.toBeInTheDocument();
  });

  it('a profile has one edit button, which opens the whole edit form (D84)', async () => {
    await signIn();
    renderAt('/nguoi/p0007');
    await screen.findByRole('heading', { level: 1 });
    // Reading: no pencils, chips or photo button on the profile itself.
    expect(screen.queryAllByRole('button', { name: /ảnh đại diện|^Sửa: |Thêm người thân|Sửa thông tin/ })).toHaveLength(0);
    expect(screen.queryAllByRole('group', { name: /Bổ sung|Thêm/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    // The form holds the fields and, at the end, relatives and other actions.
    const form = await screen.findByRole('dialog', { name: /Sửa thông tin/ });
    expect(within(form).getByLabelText('Họ và tên')).toBeInTheDocument();
    const more = within(form).getByRole('group', { name: 'Người thân và thao tác khác' });
    expect(within(more).getByRole('button', { name: 'Thêm con' })).toBeInTheDocument();
    expect(within(more).getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });
});
