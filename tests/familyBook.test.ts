import { addFather, type ChangeSet } from '@/lib/admin/changes';
import { buildClanModel, type ClanModel } from '@/lib/clanModel';
import type { ClanSnapshot } from '@/lib/data/types';
import { convertPrivateFile, inferGender, type PrivateClanFile } from '@/lib/import/giaPhaSo';
import { computeTreeLayout, MIN_GENERATIONS, type TreeFilters } from '@/features/tree/layout';
import { validatePersonFields, validateSettings, validateUnionFields } from '@/lib/validators';
import file from './fixtures/book-sample.json';

// A fictitious family book with the same shape as the real one (which stays out of Git).
const clan = convertPrivateFile(file as PrivateClanFile);
const snap = (c = clan): ClanSnapshot => ({ settings: c.settings, persons: c.persons, unions: c.unions, source: 'demo', fromCache: false });
const model = buildClanModel(snap())!;
const byName = (m: ClanModel, name: string) => m.persons.find((p) => p.fullName === name)!;
const filters: TreeFilters = { branch: null, fromGen: null, toGen: null, showSpouses: true, showMaternal: true, collapsed: new Set() };

describe('family book import', () => {
  it('has valid documents', () => {
    for (const { id: _id, ...p } of clan.persons) expect(validatePersonFields(p)).toEqual([]);
    for (const { id: _id, ...u } of clan.unions) expect(validateUnionFields(u)).toEqual([]);
    expect(validateSettings(clan.settings)).toEqual([]);
  });

  it('has three families at generation 1, then two more generations', () => {
    expect(model.founders.map((p) => p.fullName)).toEqual(['Lê Văn Một', 'Lê Thị Mười', 'Lê Văn Mười Một']);
    expect(model.rootId).toBe(model.founders[0]!.id);
    expect(model.gens.maxGeneration).toBe(3);
    expect(model.gens.unreachable).toEqual([]);
    expect(model.gens.conflicts).toEqual([]);
    expect(model.persons).toHaveLength(clan.persons.length);
    expect(model.generationOf(byName(model, 'Mai Văn Tám').id)).toBe(2);
    expect(model.generationOf(byName(model, 'Lê Minh Năm').id)).toBe(3);
  });

  it("treats daughters' children as bên ngoại and keeps the sons' line", () => {
    expect(model.isMaternal(byName(model, 'Mai Lê Chín').id)).toBe(true);
    expect(model.isMaternal(byName(model, 'Hoàng Lê Chi').id)).toBe(true);
    expect(model.isMaternal(byName(model, 'Lê Minh Năm').id)).toBe(false);
    expect(model.isMaternal(byName(model, 'Lê Thị Bảy').id)).toBe(false);
  });

  it('keeps aliases and the doubts from the book as notes, without the page numbers (D61)', () => {
    expect(byName(model, 'Lê Văn Mười Một').otherNames?.thuong).toBe('Tí, Tèo');
    expect(byName(model, 'Lê Văn Mười Một').notes ?? '').not.toContain('trang 7');
    expect(byName(model, 'Lê Thu Sáu').notes).toContain('Sáu / Sấu');
    expect(byName(model, 'Lê Văn Một').notes).toContain('làm mờ');
    expect(byName(model, 'Hoàng Lê Chi').notes).toContain('giới tính');
  });

  it('puts a parent without a spouse under a marriage with no spouse', () => {
    const binh = byName(model, 'Hoàng Lê Bình');
    const unions = model.index.unionsOf(binh.id);
    expect(unions).toHaveLength(1);
    expect(unions[0]!.spousePersonId ?? null).toBeNull();
    expect(model.index.childrenOf(unions[0]!.id).map((c) => c.fullName)).toEqual(['Hoàng Lê Chi', 'Hoàng Lê Dũng']);
  });

  it('infers gender from "Thị" and "Văn" only, and refuses to guess the rest', () => {
    expect(inferGender('Lê Thị Hoa')).toBe('female');
    expect(inferGender('Lê Văn Trai')).toBe('male');
    expect(inferGender('Smith Tom')).toBeUndefined();
    const noTable = { ...(file as PrivateClanFile), gioi_tinh: {} };
    expect(() => convertPrivateFile(noTable)).toThrow(/giới tính/);
  });
});

describe('tree with several families', () => {
  it('draws one tree for all families and a waiting fourth generation', () => {
    const layout = computeTreeLayout(model, filters);
    expect(layout.rows.map((r) => r.gen)).toEqual([1, 2, 3, 4]);
    expect(layout.rows.map((r) => Boolean(r.empty))).toEqual([false, false, false, true]);
    expect(MIN_GENERATIONS).toBe(4);
    expect(layout.nodes.filter((n) => n.gen === 1)).toHaveLength(3);
    expect(layout.nodes.every((n) => n.y === layout.rows.find((r) => r.gen === n.gen)!.top)).toBe(true);
  });

  it('hides bên ngoại unless asked', () => {
    const hidden = computeTreeLayout(model, { ...filters, showMaternal: false });
    expect(hidden.byId.has(byName(model, 'Mai Lê Chín').id)).toBe(false);
    expect(hidden.byId.has(byName(model, 'Lê Minh Năm').id)).toBe(true);
  });
});

function applyTo(set: ChangeSet): ClanSnapshot {
  const persons = new Map(clan.persons.map((p) => [p.id, p as unknown as Record<string, unknown>]));
  const unions = new Map(clan.unions.map((u) => [u.id, u as unknown as Record<string, unknown>]));
  let settings = { ...clan.settings } as unknown as Record<string, unknown>;
  for (const c of set.changes) {
    const after = { ...(c.after as Record<string, unknown>) };
    if (c.collection === 'persons') persons.set(c.id, { id: c.id, ...after });
    else if (c.collection === 'unions') unions.set(c.id, { id: c.id, ...after });
    else settings = after;
  }
  return { settings, persons: [...persons.values()], unions: [...unions.values()], source: 'demo', fromCache: false } as unknown as ClanSnapshot;
}

describe('extending upward (thêm cha chung)', () => {
  it('makes one common ancestor of every family and shifts each generation by one', () => {
    const set = addFather(model, model.founders[1]!.id, { fullName: 'Lê Công Tổ', gender: 'male', isBloodline: true });
    expect(set.changes.filter((c) => c.collection === 'persons' && c.action === 'update')).toHaveLength(3);
    const after = buildClanModel(applyTo(set))!;
    expect(after.founders).toHaveLength(1);
    expect(after.founders[0]!.fullName).toBe('Lê Công Tổ');
    expect(after.gens.maxGeneration).toBe(4);
    expect(after.gens.unreachable).toEqual([]);
    expect(after.generationOf(byName(after, 'Lê Thị Mười').id)).toBe(2);
    expect(after.generationOf(byName(after, 'Lê Minh Năm').id)).toBe(4);
    const u = after.index.unionsOf(after.rootId)[0]!;
    expect(after.index.childrenOf(u.id).map((c) => c.fullName)).toEqual(['Lê Văn Một', 'Lê Thị Mười', 'Lê Văn Mười Một']);
  });

  it('refuses a person who already has parents', () => {
    expect(() => addFather(model, byName(model, 'Lê Văn Ba').id, { fullName: 'X', gender: 'male', isBloodline: true })).toThrow(/đời 1/);
  });
});
