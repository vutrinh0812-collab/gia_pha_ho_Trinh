import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { generateSampleData } from '@/lib/sampleData';
import { collapseAllIds, computeTreeLayout, NODE_W, type TreeFilters, type TreeLayout } from '@/features/tree/layout';
import { lodFor, minScaleFor } from '@/features/tree/lod';

const model = buildClanModel(loadDemoSnapshot())!;
const base: TreeFilters = {
  branch: null,
  fromGen: null,
  toGen: null,
  showSpouses: true,
  showMaternal: false,
  collapsed: new Set(),
};

function assertNoOverlap(layout: TreeLayout) {
  const byRow = new Map<number, typeof layout.nodes>();
  for (const n of layout.nodes) byRow.set(n.gen, [...(byRow.get(n.gen) ?? []), n]);
  for (const row of byRow.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + NODE_W - 0.01);
    }
  }
}

describe('computeTreeLayout', () => {
  const layout = computeTreeLayout(model, base);

  it('shows every bloodline person except the maternal line, one row per generation', () => {
    const expected = model.persons.filter((p) => p.isBloodline && !model.isMaternal(p.id)).length;
    expect(layout.nodes).toHaveLength(expected);
    expect(layout.rows.map((r) => r.gen)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const n of layout.nodes) {
      const row = layout.rows.find((r) => r.gen === n.gen)!;
      expect(n.y).toBe(row.top);
      expect(n.h).toBeLessThanOrEqual(row.height);
    }
  });

  it('never overlaps nodes and keeps children below their parent', () => {
    assertNoOverlap(layout);
    for (const n of layout.nodes) {
      if (!n.parentId) continue;
      expect(n.y).toBeGreaterThan(layout.byId.get(n.parentId)!.y);
    }
    expect(layout.bounds.minX).toBe(0);
  });

  it('keeps siblings in birth order from left to right', () => {
    for (const n of layout.nodes) {
      const kids = n.childIds.map((id) => layout.byId.get(id)!);
      const sameUnion = kids.filter((k) => k.person.parentUnionId === kids[0]?.person.parentUnionId);
      for (let i = 1; i < sameUnion.length; i++) {
        expect(sameUnion[i]!.x).toBeGreaterThan(sameUnion[i - 1]!.x);
      }
    }
  });

  it('lists spouses in the node and labels children of a second wife', () => {
    const union = [...model.index.unions.values()].find((u) => u.order === 2)!;
    const node = layout.byId.get(union.bloodlinePersonId)!;
    expect(node.spouses.map((s) => s.role)).toEqual(['Vợ cả', 'Vợ hai']);
    const kidOfSecond = model.index.childrenOf(union.id)[0]!;
    expect(layout.byId.get(kidOfSecond.id)!.caption).toMatch(/bà hai/);
  });

  it('builds one orthogonal connector per family', () => {
    const parents = layout.nodes.filter((n) => n.childIds.length > 0);
    expect(layout.families).toHaveLength(parents.length);
    expect(layout.families[0]!.d).toMatch(/^M[\d.]+,[\d.]+V[\d.]+M/);
  });

  it('places the branch names', () => {
    expect(layout.branchLabels.map((b) => b.label).sort()).toEqual(['Chi Giáp', 'Chi Ất']);
  });

  it('collapses a branch and counts the hidden descendants', () => {
    const son = layout.nodes.find((n) => n.gen === 2 && n.hasChildren)!;
    const collapsed = computeTreeLayout(model, { ...base, collapsed: new Set([son.id]) });
    const node = collapsed.byId.get(son.id)!;
    expect(node.collapsed).toBe(true);
    expect(node.childIds).toEqual([]);
    expect(collapsed.nodes.length + node.hiddenCount).toBe(layout.nodes.length);
  });

  it('collapse-all leaves two generations', () => {
    const ids = collapseAllIds(model, base);
    const l = computeTreeLayout(model, { ...base, collapsed: ids });
    expect(new Set(l.nodes.map((n) => n.gen))).toEqual(new Set([1, 2]));
  });

  it('filters by branch and generation range', () => {
    const giap = computeTreeLayout(model, { ...base, branch: 'Chi Giáp' });
    expect(giap.nodes.every((n) => n.person.branchLabel === 'Chi Giáp')).toBe(true);
    const range = computeTreeLayout(model, { ...base, fromGen: 3, toGen: 5 });
    expect(range.rows.map((r) => r.gen)).toEqual([3, 4, 5]);
    assertNoOverlap(range);
  });

  it('can show the maternal line and hide spouses', () => {
    const withMaternal = computeTreeLayout(model, { ...base, showMaternal: true });
    expect(withMaternal.nodes.length).toBeGreaterThan(layout.nodes.length);
    const noSpouses = computeTreeLayout(model, { ...base, showSpouses: false });
    expect(noSpouses.nodes.every((n) => n.spouses.length === 0)).toBe(true);
  });

  it('lays out about 3,000 people quickly', () => {
    const big = buildClanModel({ ...generateSampleData({ targetSize: 3000, generations: 8 }), source: 'demo', fromCache: false })!;
    const start = performance.now();
    const l = computeTreeLayout(big, base);
    const ms = performance.now() - start;
    expect(big.persons.length).toBeGreaterThan(2700);
    expect(l.nodes.length).toBeGreaterThan(1200); // spouses live inside their partner's node
    expect(ms).toBeLessThan(1500);
    assertNoOverlap(l);
  });
});

describe('lod', () => {
  it('follows the spec thresholds with a mouse', () => {
    expect([0.2, 0.5, 1, 1.5, 3].map((k) => lodFor(k, false))).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses on-screen text size on touch screens (stricter)', () => {
    expect(lodFor(0.4, true)).toBe(0); // 5.6px names are unreadable
    expect(lodFor(0.6, true)).toBe(1);
    expect(lodFor(1, true)).toBe(2);
    expect(lodFor(minScaleFor(3, true), true)).toBe(3);
    expect(lodFor(minScaleFor(2, false), false)).toBe(2);
  });
});
