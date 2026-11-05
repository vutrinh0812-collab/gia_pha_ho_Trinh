import {
  addChild,
  addFather,
  addSpouse,
  AdminError,
  deletePerson,
  editPerson,
  editSettings,
  personContent,
  reorderChildren,
  reorderFounders,
  undoGroup,
  type ChangeSet,
} from '@/lib/admin/changes';
import { demoBackend, DEMO_ADMIN_CODE } from '@/lib/admin/demoBackend';
import { buildClanModel, type ClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';

const user = { uid: 'demo-admin', email: 'admin@example.com' };
const model = (): ClanModel => buildClanModel(loadDemoSnapshot())!;
const apply = async (set: ChangeSet) => demoBackend.apply(set, user);
const groupOf = async (set: ChangeSet) => (await demoBackend.listAudit()).filter((a) => a.groupId === set.groupId);

describe('admin change sets (demo backend)', () => {
  it('signs in only with the demo code', async () => {
    await expect(demoBackend.signIn('sai-ma')).rejects.toThrow('Mật khẩu không đúng.');
    await expect(demoBackend.signIn(DEMO_ADMIN_CODE)).resolves.toMatchObject({ uid: 'demo-admin' });
  });

  it('edits a person and describes the change', async () => {
    const m = model();
    const p = m.get('p0007')!;
    const set = editPerson(m, p.id, { ...personContent(p), occupation: 'Thầy thuốc' });
    expect(set.summary).toContain('nghề nghiệp');
    await apply(set);
    expect(model().get('p0007')!.occupation).toBe('Thầy thuốc');
    expect(() => editPerson(model(), p.id, personContent(model().get(p.id)!))).toThrow(AdminError);
  });

  it('rejects invalid data in Vietnamese', () => {
    const m = model();
    expect(() => editPerson(m, 'p0007', { ...personContent(m.get('p0007')!), fullName: '' })).toThrow(/Họ tên/);
  });

  it('adds a child with the next birth order and the branch of the parent', async () => {
    const m = model();
    const root = m.family(m.rootId)!;
    const kids = root.partnerships[0]!.children.length;
    const set = addChild(m, m.rootId, { fullName: 'Trịnh Văn Mới', gender: 'male', isBloodline: true });
    await apply(set);
    const after = model();
    const child = after.family(after.rootId)!.partnerships[0]!.children.at(-1)!;
    expect(child.fullName).toBe('Trịnh Văn Mới');
    expect(child.birthOrder).toBe(kids + 1);
    expect(after.generationOf(child.id)).toBe(2);
  });

  it('creates a marriage when adding a child to someone with none', async () => {
    const m = model();
    const single = m.persons.find((p) => p.isBloodline && p.gender === 'male' && m.index.unionsOf(p.id).length === 0)!;
    const set = addChild(m, single.id, { fullName: 'Trịnh Thị Nhỏ', gender: 'female', isBloodline: true });
    expect(set.changes.map((c) => `${c.collection}:${c.action}`)).toEqual(['unions:create', 'persons:create']);
    await apply(set);
    expect(model().family(single.id)!.partnerships[0]!.children[0]!.fullName).toBe('Trịnh Thị Nhỏ');
  });

  it('adds a wife as a new marriage, and fills an unknown spouse first', async () => {
    let m = model();
    const man = m.persons.find((p) => p.isBloodline && p.gender === 'male' && m.index.unionsOf(p.id).length === 0)!;
    await apply(addSpouse(m, man.id, { fullName: 'Lê Thị Vợ Cả', gender: 'female', isBloodline: false }));
    m = model();
    expect(m.index.unionsOf(man.id)).toHaveLength(1);
    await apply(addSpouse(m, man.id, { fullName: 'Phan Thị Vợ Hai', gender: 'female', isBloodline: false }));
    m = model();
    expect(m.index.unionsOf(man.id).map((u) => u.order)).toEqual([1, 2]);
    // A marriage with an unknown spouse gets filled instead of creating a third one.
    const withUnknown = m.persons.find((p) => m.index.unionsOf(p.id).some((u) => !u.spousePersonId))!;
    const set = addSpouse(m, withUnknown.id, { fullName: 'Ngô Thị Bổ Sung', gender: 'female', isBloodline: false });
    expect(set.changes.map((c) => `${c.collection}:${c.action}`)).toEqual(['persons:create', 'unions:update']);
  });

  it('refuses to delete someone with children, or the root', () => {
    const m = model();
    expect(() => deletePerson(m, m.rootId)).toThrow(/thủy tổ/);
    const parent = m.family(m.rootId)!.partnerships[0]!.children.find((c) => m.index.unionsOf(c.id).length)!;
    expect(() => deletePerson(m, parent.id)).toThrow(/còn \d+ người con/);
  });

  it('deletes a leaf with their spouse and marriage, and undoes it all', async () => {
    let m = model();
    const leaf = m.persons.find(
      (p) => p.isBloodline && m.index.unionsOf(p.id).length === 1 && m.index.unionsOf(p.id)[0]!.spousePersonId && !m.index.childrenOf(m.index.unionsOf(p.id)[0]!.id).length,
    )!;
    const spouseId = m.index.unionsOf(leaf.id)[0]!.spousePersonId!;
    const set = deletePerson(m, leaf.id);
    expect(set.summary).toContain('kèm 1 người phối ngẫu');
    await apply(set);
    m = model();
    expect(m.get(leaf.id)).toBeUndefined();
    expect(m.get(spouseId)).toBeUndefined();

    await apply(undoGroup(m, await groupOf(set), set.summary));
    m = model();
    expect(m.get(leaf.id)?.fullName).toBe(leaf.fullName);
    expect(m.index.unionsOf(leaf.id)[0]!.spousePersonId).toBe(spouseId);
  });

  it('adds a father above the root and makes him the new root', async () => {
    let m = model();
    const oldRoot = m.rootId;
    const set = addFather(m, oldRoot, { fullName: 'Trịnh Công Tiên', gender: 'male', isBloodline: true });
    await apply(set);
    m = model();
    expect(m.rootId).not.toBe(oldRoot);
    expect(m.generationOf(oldRoot)).toBe(2);
    expect(() => addFather(m, oldRoot, { fullName: 'X', gender: 'male', isBloodline: true })).toThrow(/thủy tổ/);
    // Undo restores the old root.
    await apply(undoGroup(m, await groupOf(set), set.summary));
    expect(model().rootId).toBe(oldRoot);
  });

  it('reorders children', async () => {
    const m = model();
    const u = m.index.unionsOf(m.rootId)[0]!;
    const ids = m.index.childrenOf(u.id).map((c) => c.id);
    const reversed = [...ids].reverse();
    await apply(reorderChildren(m, u.id, reversed));
    expect(model().index.childrenOf(u.id).map((c) => c.id)).toEqual(reversed);
  });

  it('refuses an undo that would overwrite a later edit', async () => {
    let m = model();
    const p = m.get('p0010')!;
    const first = editPerson(m, p.id, { ...personContent(p), notes: 'Lần 1' });
    await apply(first);
    m = model();
    await apply(editPerson(m, p.id, { ...personContent(m.get(p.id)!), notes: 'Lần 2' }));
    expect(() => undoGroup(model(), [], '')).toThrow(AdminError);
    const entries = await groupOf(first);
    expect(() => undoGroup(model(), entries, first.summary)).toThrow(/đã được sửa sau đó/);
  });

  it('edits clan settings but keeps the root', async () => {
    const m = model();
    const set = editSettings(m, { ...m.settings, title: 'Gia Phả Họ Trịnh (đã sửa)', rootPersonId: 'khac' });
    await apply(set);
    expect(model().settings.title).toBe('Gia Phả Họ Trịnh (đã sửa)');
    expect(model().rootId).toBe(m.rootId);
  });
});

describe('reorder the families of generation 1', () => {
  const twoFounders = (): ClanModel => {
    const snap = loadDemoSnapshot();
    const extra = { id: 'f2', fullName: 'Trịnh Văn Hai', gender: 'male' as const, isBloodline: true, parentUnionId: null };
    return buildClanModel({ ...snap, persons: [...snap.persons, extra] })!;
  };

  it('puts the chosen family first and makes it the root', () => {
    const m = twoFounders();
    const [root, other] = m.founders.map((f) => f.id);
    expect(m.founders).toHaveLength(2);
    const set = reorderFounders(m, [other!, root!]);
    const settings = set.changes.find((c) => c.collection === 'settings');
    expect(settings?.after).toMatchObject({ rootPersonId: other });
    const orders = Object.fromEntries(set.changes.filter((c) => c.collection === 'persons').map((c) => [c.id, c.after?.birthOrder]));
    expect(orders[other!]).toBe(1);
    expect(orders[root!]).toBe(2);
  });

  it('refuses an unchanged or stale list', () => {
    const m = twoFounders();
    const ids = m.founders.map((f) => f.id);
    expect(() => reorderFounders(m, ids.slice(0, 1))).toThrow(AdminError);
  });
});

describe('toRoman', () => {
  it('writes birth orders as Roman numerals', async () => {
    const { toRoman } = await import('@/lib/format');
    expect([1, 2, 3, 4, 5, 9, 10, 14, 19, 40].map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'X', 'XIV', 'XIX', 'XL']);
    expect(toRoman(0)).toBe('0');
  });
});

describe('editSettings with empty couplets (D62 fix)', () => {
  it('keeps empty couplets and colophon, so the real clan settings can be saved', async () => {
    const { editSettings, settingsContent } = await import('@/lib/admin/changes');
    const { buildClanModel } = await import('@/lib/clanModel');
    const { loadDemoSnapshot } = await import('@/lib/data/demoSource');
    const snap = loadDemoSnapshot();
    const model = buildClanModel({ ...snap, settings: { ...snap.settings!, coupletLeft: '', coupletRight: '', colophon: '' } })!;
    const set = editSettings(model, { ...settingsContent(model.settings), openEditing: true });
    const after = set.changes[0]!.after as Record<string, unknown>;
    expect(after.openEditing).toBe(true);
    expect(after.coupletLeft).toBe('');
    expect(after.coupletRight).toBe('');
    expect(after.colophon).toBe('');
  });
});
