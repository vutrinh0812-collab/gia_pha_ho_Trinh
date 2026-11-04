/**
 * Family graph indexing and generation ("đời") computation.
 *
 * Generations are never stored (SPEC §3): the root ancestor is generation 1,
 * a child is its bloodline parent's generation + 1 and a spouse shares the
 * generation of the bloodline partner.
 *
 * A clan may start from several families whose common ancestors are unknown
 * (a family book that begins mid-way): every bloodline person without parents
 * is a "founder" and is generation 1 like the root. Adding a common ancestor
 * above them later shifts everybody down by one.
 */
import type { Gender } from './types';

/** Minimal person shape needed for graph work. */
export interface PersonNode {
  id: string;
  gender: Gender;
  isBloodline: boolean;
  parentUnionId?: string | null;
  birthOrder?: number;
  fullName?: string;
}

/** Minimal union shape needed for graph work. */
export interface UnionLink {
  id: string;
  bloodlinePersonId: string;
  spousePersonId?: string | null;
  order: number;
}

export interface FamilyIndex<P extends PersonNode = PersonNode, U extends UnionLink = UnionLink> {
  persons: ReadonlyMap<string, P>;
  unions: ReadonlyMap<string, U>;
  /** Unions where the person is the bloodline partner, ordered by `order`. */
  unionsOf(personId: string): readonly U[];
  /** Unions where the person is the married-in partner. */
  spouseUnionsOf(personId: string): readonly U[];
  /** Children of a union, ordered by `birthOrder` (unknown order last). */
  childrenOf(unionId: string): readonly P[];
  /** The union a person was born from. */
  parentUnionOf(personId: string): U | undefined;
}

const EMPTY: readonly never[] = Object.freeze([]);

function byBirthOrder(a: PersonNode, b: PersonNode): number {
  const ao = a.birthOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.birthOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildFamilyIndex<P extends PersonNode, U extends UnionLink>(
  persons: Iterable<P>,
  unions: Iterable<U>,
): FamilyIndex<P, U> {
  const personMap = new Map<string, P>();
  for (const p of persons) personMap.set(p.id, p);

  const unionMap = new Map<string, U>();
  const unionsByBloodline = new Map<string, U[]>();
  const unionsBySpouse = new Map<string, U[]>();
  for (const u of unions) {
    unionMap.set(u.id, u);
    pushTo(unionsByBloodline, u.bloodlinePersonId, u);
    if (u.spousePersonId) pushTo(unionsBySpouse, u.spousePersonId, u);
  }
  for (const list of unionsByBloodline.values()) list.sort((a, b) => a.order - b.order);

  const childrenByUnion = new Map<string, P[]>();
  for (const p of personMap.values()) {
    if (p.parentUnionId) pushTo(childrenByUnion, p.parentUnionId, p);
  }
  for (const list of childrenByUnion.values()) list.sort(byBirthOrder);

  return {
    persons: personMap,
    unions: unionMap,
    unionsOf: (id) => unionsByBloodline.get(id) ?? EMPTY,
    spouseUnionsOf: (id) => unionsBySpouse.get(id) ?? EMPTY,
    childrenOf: (id) => childrenByUnion.get(id) ?? EMPTY,
    parentUnionOf: (id) => {
      const unionId = personMap.get(id)?.parentUnionId;
      return unionId ? unionMap.get(unionId) : undefined;
    },
  };
}

export interface GenerationResult {
  /** Generation-1 persons: the root first, then the other parentless bloodline persons in birth order. */
  founders: string[];
  /** Generation (1-based) of every person reachable from the root or a founder. */
  generation: ReadonlyMap<string, number>;
  /**
   * Persons descending from the root through a daughter (bên ngoại),
   * including their spouses. Shown only when `showMaternalDescendants` is on.
   */
  maternal: ReadonlySet<string>;
  /** Highest generation number found. */
  maxGeneration: number;
  /** Persons that cannot be reached from the root (data problems). */
  unreachable: string[];
  /** Persons reached more than once through parent links (cycles / duplicates). */
  conflicts: string[];
}

export function computeGenerations(index: FamilyIndex, rootPersonId: string): GenerationResult {
  const generation = new Map<string, number>();
  const maternal = new Set<string>();
  const conflicts: string[] = [];
  let maxGeneration = 0;

  if (!index.persons.has(rootPersonId)) {
    return {
      founders: [],
      generation,
      maternal,
      maxGeneration,
      unreachable: [...index.persons.keys()],
      conflicts,
    };
  }

  const others = [...index.persons.values()]
    .filter((p) => p.isBloodline && !p.parentUnionId && p.id !== rootPersonId)
    .sort(byBirthOrder)
    .map((p) => p.id);
  const founders = [rootPersonId, ...others];

  // Iterative BFS over bloodline persons; safe for deep trees.
  const queue: string[] = [...founders];
  for (const id of founders) generation.set(id, 1);
  for (let head = 0; head < queue.length; head++) {
    const personId = queue[head]!;
    const person = index.persons.get(personId);
    const gen = generation.get(personId)!;
    if (gen > maxGeneration) maxGeneration = gen;
    if (!person) continue;
    const isMaternal = maternal.has(personId);
    const childrenAreMaternal = isMaternal || (person.gender === 'female' && personId !== rootPersonId);

    for (const union of index.unionsOf(personId)) {
      const spouseId = union.spousePersonId;
      if (spouseId && index.persons.has(spouseId) && !generation.has(spouseId)) {
        generation.set(spouseId, gen);
        if (isMaternal) maternal.add(spouseId);
      }
      for (const child of index.childrenOf(union.id)) {
        if (generation.has(child.id)) {
          conflicts.push(child.id);
          continue;
        }
        generation.set(child.id, gen + 1);
        if (childrenAreMaternal) maternal.add(child.id);
        queue.push(child.id);
      }
    }
  }

  const unreachable = [...index.persons.keys()].filter((id) => !generation.has(id));
  return { founders, generation, maternal, maxGeneration, unreachable, conflicts };
}

/**
 * Bloodline ancestors from the root down to (and including) the given person.
 * For a married-in spouse the path goes through their first bloodline partner.
 * Returns [] when the person is not connected to a parent chain.
 */
export function lineageOf(index: FamilyIndex, personId: string): string[] {
  let current = personId;
  const person = index.persons.get(personId);
  const path: string[] = [];
  if (person && !person.parentUnionId) {
    const asSpouse = index.spouseUnionsOf(personId)[0];
    if (asSpouse && index.unionsOf(personId).length === 0) {
      path.push(personId);
      current = asSpouse.bloodlinePersonId;
    }
  }
  const seen = new Set<string>(path);
  while (index.persons.has(current) && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    const parentUnion = index.parentUnionOf(current);
    if (!parentUnion) break;
    current = parentUnion.bloodlinePersonId;
  }
  return path.reverse();
}

/** Number of descendants (children, grandchildren…, excluding spouses). */
export function countDescendants(index: FamilyIndex, personId: string): number {
  let count = 0;
  const stack = [personId];
  const seen = new Set<string>([personId]);
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const union of index.unionsOf(id)) {
      for (const child of index.childrenOf(union.id)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        count++;
        stack.push(child.id);
      }
    }
  }
  return count;
}

/** True when the person still has children recorded (blocks deletion, SPEC §3). */
export function hasChildren(index: FamilyIndex, personId: string): boolean {
  return index.unionsOf(personId).some((u) => index.childrenOf(u.id).length > 0);
}
