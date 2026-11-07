import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { allOpenIds, buildOutline, defaultOpenIds, outlineStats, type OutlineFilters } from '@/features/tree/outline';

const model = buildClanModel(loadDemoSnapshot())!;
const f: OutlineFilters = { branch: null, fromGen: null, toGen: null, showSpouses: true, showMaternal: false };

describe('buildOutline', () => {
  it('shows two generations by default, with hidden counts on closed branches', () => {
    const rows = buildOutline(model, f, defaultOpenIds(model, f));
    expect(rows[0]!.id).toBe(model.rootId);
    expect(rows[0]!.open).toBe(true);
    expect(new Set(rows.map((r) => r.depth))).toEqual(new Set([0, 1]));
    const closed = rows.filter((r) => r.depth === 1 && r.hasChildren);
    expect(closed.length).toBeGreaterThan(0);
    for (const r of closed) expect(r.hiddenCount).toBeGreaterThan(0);
  });

  it('lists everyone once when everything is open, children right after their parent', () => {
    const rows = buildOutline(model, f, allOpenIds(model, f));
    expect(rows).toHaveLength(outlineStats(model, f).people);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    const index = new Map(rows.map((r, i) => [r.id, i]));
    for (const r of rows) if (r.parentId) expect(index.get(r.parentId)!).toBeLessThan(index.get(r.id)!);
  });

  it('draws connector guides for ancestors that have younger siblings', () => {
    const rows = buildOutline(model, f, allOpenIds(model, f));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const r of rows) {
      expect(r.guides).toHaveLength(Math.max(0, r.depth - 1));
      // Walk up: guide i belongs to the ancestor at depth i + 1.
      let a = r.parentId ? byId.get(r.parentId) : undefined;
      for (let i = r.depth - 2; i >= 0; i--) {
        expect(r.guides[i]).toBe(!a!.last);
        a = a!.parentId ? byId.get(a!.parentId) : undefined;
      }
    }
  });

  it('follows the generation filter', () => {
    const limited = { ...f, toGen: 3 };
    const rows = buildOutline(model, limited, allOpenIds(model, limited));
    expect(Math.max(...rows.map((r) => r.gen))).toBe(3);
  });
});


describe('row captions (D70)', () => {
  const rows = buildOutline(model, f, allOpenIds(model, f));

  it('shows no Roman birth order: the order of the rows already gives it', () => {
    expect(rows.some((r) => r.person.birthOrder)).toBe(true);
    for (const r of rows) expect(r.caption ?? '').not.toMatch(/^[IVXLC]+\b/);
  });

  it('keeps "bà hai" (which mother) for children of several marriages', () => {
    expect(rows.some((r) => /^(bà|ông) /.test(r.caption ?? ''))).toBe(true);
  });
});
