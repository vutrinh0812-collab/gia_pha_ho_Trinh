import {
  buildFamilyIndex,
  computeGenerations,
  countDescendants,
  hasChildren,
  lineageOf,
  type PersonNode,
  type UnionLink,
} from '@/lib/generation';

/*
 * Fixture:
 *   A (root, m) ═ Aw
 *   ├── B (m, order 2) ═ Bw1 (u2, order 1)  ── D (m)
 *   │                  ═ Bw2 (u3, order 2)  ── E (f) ═ Eh ── F (m, maternal)
 *   └── C (f, order 1) ═ Ch
 */
const persons: PersonNode[] = [
  { id: 'A', gender: 'male', isBloodline: true, parentUnionId: null },
  { id: 'Aw', gender: 'female', isBloodline: false },
  { id: 'B', gender: 'male', isBloodline: true, parentUnionId: 'u1', birthOrder: 2 },
  { id: 'C', gender: 'female', isBloodline: true, parentUnionId: 'u1', birthOrder: 1 },
  { id: 'Bw1', gender: 'female', isBloodline: false },
  { id: 'Bw2', gender: 'female', isBloodline: false },
  { id: 'Ch', gender: 'male', isBloodline: false },
  { id: 'D', gender: 'male', isBloodline: true, parentUnionId: 'u2', birthOrder: 1 },
  { id: 'E', gender: 'female', isBloodline: true, parentUnionId: 'u3', birthOrder: 1 },
  { id: 'Eh', gender: 'male', isBloodline: false },
  { id: 'F', gender: 'male', isBloodline: true, parentUnionId: 'u5', birthOrder: 1 },
  { id: 'X', gender: 'male', isBloodline: true, parentUnionId: 'missing' },
];
const unions: UnionLink[] = [
  { id: 'u1', bloodlinePersonId: 'A', spousePersonId: 'Aw', order: 1 },
  { id: 'u3', bloodlinePersonId: 'B', spousePersonId: 'Bw2', order: 2 },
  { id: 'u2', bloodlinePersonId: 'B', spousePersonId: 'Bw1', order: 1 },
  { id: 'u4', bloodlinePersonId: 'C', spousePersonId: 'Ch', order: 1 },
  { id: 'u5', bloodlinePersonId: 'E', spousePersonId: 'Eh', order: 1 },
];

const index = buildFamilyIndex(persons, unions);

describe('buildFamilyIndex', () => {
  it('orders children by birthOrder and unions by order', () => {
    expect(index.childrenOf('u1').map((p) => p.id)).toEqual(['C', 'B']);
    expect(index.unionsOf('B').map((u) => u.id)).toEqual(['u2', 'u3']);
    expect(index.spouseUnionsOf('Bw2').map((u) => u.id)).toEqual(['u3']);
    expect(index.parentUnionOf('D')?.id).toBe('u2');
    expect(index.childrenOf('nope')).toEqual([]);
  });
});

describe('computeGenerations', () => {
  const result = computeGenerations(index, 'A');

  it('assigns generations from the root; spouses share their partner generation', () => {
    const g = result.generation;
    expect(g.get('A')).toBe(1);
    expect(g.get('Aw')).toBe(1);
    expect(g.get('B')).toBe(2);
    expect(g.get('C')).toBe(2);
    expect(g.get('Ch')).toBe(2);
    expect(g.get('Bw2')).toBe(2);
    expect(g.get('D')).toBe(3);
    expect(g.get('E')).toBe(3);
    expect(g.get('Eh')).toBe(3);
    expect(g.get('F')).toBe(4);
    expect(result.maxGeneration).toBe(4);
  });

  it("marks daughters' descendants (and their spouses) as maternal", () => {
    expect([...result.maternal].sort()).toEqual(['F']);
    expect(result.maternal.has('E')).toBe(false); // the daughter herself is not maternal
  });

  it('reports unreachable persons', () => {
    expect(result.unreachable).toEqual(['X']);
    expect(result.conflicts).toEqual([]);
  });

  it('handles a missing root', () => {
    const r = computeGenerations(index, 'nobody');
    expect(r.generation.size).toBe(0);
    expect(r.unreachable).toHaveLength(persons.length);
  });

  it('survives cycles in bad data', () => {
    const cyclic = buildFamilyIndex(
      [
        { id: 'R', gender: 'male', isBloodline: true, parentUnionId: 'u2' },
        { id: 'S', gender: 'male', isBloodline: true, parentUnionId: 'u1' },
      ],
      [
        { id: 'u1', bloodlinePersonId: 'R', order: 1 },
        { id: 'u2', bloodlinePersonId: 'S', order: 1 },
      ],
    );
    const r = computeGenerations(cyclic, 'R');
    expect(r.generation.get('S')).toBe(2);
    expect(r.conflicts).toEqual(['R']);
    expect(lineageOf(cyclic, 'S')).toEqual(['R', 'S']);
  });

  it('is fast for 3,000 persons in a deep chain', () => {
    const many: PersonNode[] = [{ id: 'p0', gender: 'male', isBloodline: true }];
    const links: UnionLink[] = [];
    for (let i = 1; i < 3000; i++) {
      links.push({ id: `u${i}`, bloodlinePersonId: `p${i - 1}`, order: 1 });
      many.push({ id: `p${i}`, gender: 'male', isBloodline: true, parentUnionId: `u${i}` });
    }
    const big = buildFamilyIndex(many, links);
    const start = performance.now();
    const r = computeGenerations(big, 'p0');
    expect(performance.now() - start).toBeLessThan(200);
    expect(r.maxGeneration).toBe(3000);
    expect(lineageOf(big, 'p2999')).toHaveLength(3000);
  });
});

describe('lineage and descendants', () => {
  it('returns the bloodline path from the root', () => {
    expect(lineageOf(index, 'F')).toEqual(['A', 'B', 'E', 'F']);
    expect(lineageOf(index, 'A')).toEqual(['A']);
  });

  it('routes spouses through their partner', () => {
    expect(lineageOf(index, 'Eh')).toEqual(['A', 'B', 'E', 'Eh']);
  });

  it('counts descendants and detects children', () => {
    expect(countDescendants(index, 'A')).toBe(5); // B, C, D, E, F
    expect(countDescendants(index, 'B')).toBe(3);
    expect(hasChildren(index, 'C')).toBe(false);
    expect(hasChildren(index, 'E')).toBe(true);
  });
});
