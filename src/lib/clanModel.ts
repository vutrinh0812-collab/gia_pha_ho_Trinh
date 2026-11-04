/**
 * Read model of a clan: indexes, generations and family lookups used by every
 * view. Built once per data snapshot.
 */
import type { ClanSnapshot } from './data';
import { buildFamilyIndex, computeGenerations, lineageOf, type FamilyIndex, type GenerationResult } from './generation';
import { buildSearchIndex, type SearchIndex } from './search';
import type { ClanSettings, PersonFields, UnionFields, WithId } from './types';

export type PersonRec = WithId<PersonFields>;
export type UnionRec = WithId<UnionFields>;

export interface Partnership {
  union: UnionRec;
  partner: PersonRec | undefined;
  /** Children, in birth order. */
  children: PersonRec[];
}

export interface Family {
  person: PersonRec;
  father: PersonRec | undefined;
  mother: PersonRec | undefined;
  partnerships: Partnership[];
  siblings: PersonRec[];
}

export interface ClanModel {
  settings: ClanSettings;
  rootId: string;
  /** Generation-1 people: the root plus any other family that starts the book. */
  founders: PersonRec[];
  index: FamilyIndex<PersonRec, UnionRec>;
  gens: GenerationResult;
  /** Persons connected to the root. */
  persons: PersonRec[];
  get(id: string | null | undefined): PersonRec | undefined;
  generationOf(id: string): number | undefined;
  isMaternal(id: string): boolean;
  family(id: string): Family | null;
  lineage(id: string): PersonRec[];
  /** The bloodline parent (for telling namesakes apart). */
  bloodlineParent(id: string): PersonRec | undefined;
  searchIndex(): SearchIndex;
}

export function buildClanModel(snap: ClanSnapshot): ClanModel | null {
  const settings = snap.settings;
  if (!settings) return null;
  const index = buildFamilyIndex<PersonRec, UnionRec>(snap.persons, snap.unions);
  const gens = computeGenerations(index, settings.rootPersonId);
  const persons = snap.persons.filter((p) => gens.generation.has(p.id));
  let searchIdx: SearchIndex | null = null;

  const get = (id: string | null | undefined) => (id ? index.persons.get(id) : undefined);

  const bloodlineParent = (id: string) => get(index.parentUnionOf(id)?.bloodlinePersonId);

  const family = (id: string): Family | null => {
    const person = get(id);
    if (!person) return null;
    const parentUnion = index.parentUnionOf(id);
    let father: PersonRec | undefined;
    let mother: PersonRec | undefined;
    if (parentUnion) {
      for (const p of [get(parentUnion.bloodlinePersonId), get(parentUnion.spousePersonId)]) {
        if (!p) continue;
        if (p.gender === 'male') father ??= p;
        else mother ??= p;
      }
    }
    const unions = person.isBloodline || index.unionsOf(id).length > 0 ? index.unionsOf(id) : index.spouseUnionsOf(id);
    const partnerships = unions.map((union) => ({
      union,
      partner: get(union.bloodlinePersonId === id ? union.spousePersonId : union.bloodlinePersonId),
      children: [...index.childrenOf(union.id)],
    }));
    const siblings = parentUnion ? index.childrenOf(parentUnion.id).filter((c) => c.id !== id) : [];
    return { person, father, mother, partnerships, siblings };
  };

  return {
    settings,
    rootId: settings.rootPersonId,
    founders: gens.founders.map((id) => index.persons.get(id)!),
    index,
    gens,
    persons,
    get,
    generationOf: (id) => gens.generation.get(id),
    isMaternal: (id) => gens.maternal.has(id),
    family,
    lineage: (id) => lineageOf(index, id).map((pid) => index.persons.get(pid)!),
    bloodlineParent,
    searchIndex: () =>
      (searchIdx ??= buildSearchIndex(
        persons.map((p) => ({
          id: p.id,
          name: p.fullName,
          aliases: Object.values(p.otherNames ?? {}).filter((v): v is string => Boolean(v)),
        })),
      )),
  };
}
