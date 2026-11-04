import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { search } from '@/lib/search';

const model = buildClanModel(loadDemoSnapshot())!;

describe('ClanModel', () => {
  it('builds from the sample data', () => {
    expect(model.persons.length).toBeGreaterThan(250);
    expect(model.generationOf(model.rootId)).toBe(1);
  });

  it('returns the family around a person', () => {
    const root = model.family(model.rootId)!;
    expect(root.father).toBeUndefined();
    expect(root.partnerships).toHaveLength(1);
    expect(root.partnerships[0]!.partner?.isBloodline).toBe(false);
    const firstChild = root.partnerships[0]!.children[0]!;
    const child = model.family(firstChild.id)!;
    expect(child.father?.id).toBe(model.rootId);
    expect(child.mother?.id).toBe(root.partnerships[0]!.partner?.id);
    expect(child.siblings.map((s) => s.id)).not.toContain(firstChild.id);
  });

  it("shows a married-in spouse's family through the partner", () => {
    const wife = model.family(model.rootId)!.partnerships[0]!.partner!;
    const fam = model.family(wife.id)!;
    expect(fam.partnerships[0]!.partner?.id).toBe(model.rootId);
    expect(fam.partnerships[0]!.children.length).toBeGreaterThan(0);
    expect(model.lineage(wife.id).map((p) => p.id)).toEqual([model.rootId, wife.id]);
  });

  it('groups children by wife for a man with two wives', () => {
    const twoWives = [...model.index.unions.values()].find((u) => u.order === 2)!;
    const fam = model.family(twoWives.bloodlinePersonId)!;
    expect(fam.partnerships.map((p) => p.union.order)).toEqual([1, 2]);
    expect(fam.partnerships.every((p) => p.children.length > 0)).toBe(true);
  });

  it('searches names without diacritics', () => {
    const root = model.get(model.rootId)!;
    const q = root.fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
    expect(search(model.searchIndex(), q)[0]!.id).toBe(model.rootId);
  });
});
