import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { generateSampleData } from '@/lib/sampleData';
import { collapseAllIds, computeTreeLayout, NODE_W, VERTICAL_FROM_GEN, VNODE_W, verticalMetrics, type TreeFilters, type TreeLayout } from '@/features/tree/layout';
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
      expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.w - 0.01);
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

describe('branch view (in theo chi)', () => {
  // A man of generation 3 with children and siblings.
  const focus = model.persons.find(
    (p) =>
      p.isBloodline &&
      model.generationOf(p.id) === 3 &&
      model.index.unionsOf(p.id).some((u) => model.index.childrenOf(u.id).length) &&
      model.index.childrenOf(model.index.parentUnionOf(p.id)!.id).length > 1,
  )!;
  const layout = computeTreeLayout(model, { ...base, focusId: focus.id });
  const descendants = (id: string): string[] =>
    model.index.unionsOf(id).flatMap((u) => model.index.childrenOf(u.id)).flatMap((c) => (c.isBloodline && !model.isMaternal(c.id) ? [c.id, ...descendants(c.id)] : []));

  it('shows the line from the root to the person', () => {
    for (const p of model.lineage(focus.id)) {
      expect(layout.byId.get(p.id)?.collapsed ?? false).toBe(false);
    }
  });

  it('shows every descendant of the person', () => {
    for (const id of descendants(focus.id)) expect(layout.byId.has(id)).toBe(true);
  });

  it("shows the person's siblings, but not their descendants", () => {
    const sibs = model.index.childrenOf(model.index.parentUnionOf(focus.id)!.id).filter((s) => s.id !== focus.id);
    expect(sibs.length).toBeGreaterThan(0);
    for (const s of sibs) {
      const node = layout.byId.get(s.id)!;
      expect(node).toBeDefined();
      expect(node.childIds).toEqual([]);
      if (descendants(s.id).length) {
        expect(node.collapsed).toBe(true);
        expect(node.hiddenCount).toBe(descendants(s.id).length);
      }
      for (const d of descendants(s.id)) expect(layout.byId.has(d)).toBe(false);
    }
  });

  it('keeps uncles collapsed too, and the whole thing smaller than the full tree', () => {
    const grandpaUnion = model.index.parentUnionOf(model.index.parentUnionOf(focus.id)!.bloodlinePersonId);
    if (grandpaUnion) {
      for (const uncle of model.index.childrenOf(grandpaUnion.id)) {
        if (model.lineage(focus.id).some((p) => p.id === uncle.id)) continue;
        expect(layout.byId.get(uncle.id)?.childIds ?? []).toEqual([]);
      }
    }
    expect(layout.nodes.length).toBeLessThan(computeTreeLayout(model, base).nodes.length);
  });

  it("a spouse's branch is their partner's", () => {
    const wife = model.get(model.index.unionsOf(focus.id)[0]!.spousePersonId!)!;
    const viaWife = computeTreeLayout(model, { ...base, focusId: wife.id });
    expect(viaWife.nodes.map((n) => n.id).sort()).toEqual(layout.nodes.map((n) => n.id).sort());
  });
});

describe('vertical cards for the lower generations', () => {
  const layout = computeTreeLayout(model, base);

  it('uses narrow vertical cards from generation 3, full cards above', () => {
    for (const n of layout.nodes) {
      expect(n.vertical).toBe(n.gen >= VERTICAL_FROM_GEN);
      expect(n.w).toBe(n.gen >= VERTICAL_FROM_GEN ? VNODE_W : NODE_W);
    }
    expect(layout.nodes.some((n) => n.vertical)).toBe(true);
  });

  it('makes a vertical card tall enough for one word per line', () => {
    for (const n of layout.nodes.filter((x) => x.vertical)) {
      const words = n.person.fullName.trim().split(/\s+/).length;
      expect(n.h).toBeGreaterThanOrEqual(words * 18);
    }
  });

  it('stacks each spouse below the name in the same narrow column', () => {
    const married = layout.nodes.filter((x) => x.vertical && x.spouses.length > 0);
    expect(married.length).toBeGreaterThan(0);
    for (const n of married) {
      expect(n.w).toBe(VNODE_W);
      const m = verticalMetrics(n.person, n.spouses);
      expect(m.height).toBe(n.h);
      expect(m.sections).toHaveLength(n.spouses.length);
      const spouseWords = n.spouses.flatMap((s) => s.person.fullName.trim().split(/\s+/));
      expect(m.lines.filter((l) => l.kind === 'spouseWord').map((l) => l.text)).toEqual(spouseWords);
      expect(m.lines.filter((l) => l.kind === 'role').map((l) => l.text)).toEqual(n.spouses.map((s) => s.role.toLowerCase()));
      // The spouse's years follow their name, as the bloodline person's do.
      const spouseBirth = n.spouses[0]!.person.birth?.solar?.slice(0, 4);
      const firstSpouseTop = m.sections[0]!.top;
      if (spouseBirth) expect(m.lines.some((l) => l.kind === 'year' && l.y > firstSpouseTop && l.text.replace(/ –$/, '') === spouseBirth)).toBe(true);
      // Every line sits inside the card, top to bottom.
      const ys = m.lines.map((l) => l.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      expect(Math.max(...ys)).toBeLessThan(n.h);
    }
  });

  it('on screen shows only names and birth years (no birth order, no spouse roles)', () => {
    const screen = computeTreeLayout(model, base, { labels: false });
    const married = screen.nodes.filter((x) => x.vertical && x.spouses.length > 0);
    expect(married.length).toBeGreaterThan(0);
    for (const n of married) {
      const m = verticalMetrics(n.person, n.spouses, { labels: false });
      expect(m.height).toBe(n.h);
      expect(m.lines.every((l) => l.kind === 'word' || l.kind === 'spouseWord' || l.kind === 'year')).toBe(true);
    }
  });
});

describe('years on the tree (D101)', () => {
  const layout = computeTreeLayout(model, base, { labels: false });

  it('a narrow card of someone who has died shows "1890 –" and "1950" on two lines; the living, the birth year', () => {
    const dead = layout.nodes.find((n) => n.vertical && n.person.death?.isDeceased && n.person.birth?.solar && n.person.death?.solar)!;
    expect(dead).toBeDefined();
    const years = verticalMetrics(dead.person, [], { labels: false }).lines.filter((l) => l.kind === 'year').map((l) => l.text);
    expect(years).toEqual([`${dead.person.birth!.solar!.slice(0, 4)} –`, dead.person.death!.solar!.slice(0, 4)]);
    const alive = layout.nodes.find((n) => n.vertical && !n.person.death?.isDeceased && n.person.birth?.solar)!;
    expect(verticalMetrics(alive.person, [], { labels: false }).lines.filter((l) => l.kind === 'year').map((l) => l.text)).toEqual([alive.person.birth!.solar!.slice(0, 4)]);
  });
});
