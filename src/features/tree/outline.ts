/**
 * "Cây dọc" — the tree as an indented outline (DECISIONS D54), the phone layout of
 * "Sơ đồ". A family tree grows sideways (each generation is wider than the last)
 * while a phone scrolls up and down, so here each generation is one step of
 * indentation and brothers and sisters follow each other downwards: always readable,
 * no zooming, one-thumb scrolling. Uses the same filters as the chart (layout.ts).
 */
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import {
  countShownDescendants,
  nodeCaption,
  shownChildren,
  spousesOf,
  startingPersons,
  type TreeFilters,
  type TreeSpouse,
} from './layout';

export interface OutlineRow {
  id: string;
  person: PersonRec;
  gen: number;
  /** Indentation level: 0 for the people the outline starts from. */
  depth: number;
  parentId: string | null;
  /** "bà hai" (which mother) when the parent had children in several marriages; no birth order (D70). */
  caption: string | null;
  years: string;
  spouses: TreeSpouse[];
  hasChildren: boolean;
  open: boolean;
  /** People hidden under this row while it is closed. */
  hiddenCount: number;
  maternal: boolean;
  /** Last among its brothers and sisters (the connector stops here). */
  last: boolean;
  /**
   * One flag per ancestor level 1…depth-1: whether that ancestor has a younger
   * sibling further down, so its connector line runs past this row.
   */
  guides: boolean[];
}

/** Filters without the chart-only fields. */
export type OutlineFilters = Omit<TreeFilters, 'collapsed' | 'focusId'>;


const withCollapsed = (f: OutlineFilters): TreeFilters => ({ ...f, collapsed: new Set(), focusId: null });

/** The visible rows, top to bottom, for the people whose branches are open. */
export function buildOutline(model: ClanModel, filters: OutlineFilters, open: ReadonlySet<string>): OutlineRow[] {
  const f = withCollapsed(filters);
  const rows: OutlineRow[] = [];
  const visit = (p: PersonRec, depth: number, parentId: string | null, last: boolean, guides: boolean[]) => {
    const kids = shownChildren(model, p.id, f);
    const isOpen = kids.length > 0 && open.has(p.id);
    rows.push({
      id: p.id,
      person: p,
      gen: model.generationOf(p.id) ?? depth + 1,
      depth,
      parentId,
      // Only "bà hai" (which mother): the order of the rows already shows the birth order (D70).
      caption: nodeCaption(model, p, f, false),
      years: lifeSpan(p),
      spouses: f.showSpouses ? spousesOf(model, p) : [],
      hasChildren: kids.length > 0,
      open: isOpen,
      hiddenCount: kids.length > 0 && !isOpen ? countShownDescendants(model, p.id, f) : 0,
      maternal: model.isMaternal(p.id),
      last,
      guides,
    });
    if (!isOpen) return;
    // Children of a depth-0 row draw their connector from it, so no guide is needed for depth 0.
    const childGuides = depth === 0 ? [] : [...guides, !last];
    kids.forEach((k, i) => visit(k, depth + 1, p.id, i === kids.length - 1, childGuides));
  };
  const starts = startingPersons(model, f);
  starts.forEach((p, i) => visit(p, 0, null, i === starts.length - 1, []));
  return rows;
}

/** Open by default: the people the outline starts from, so two generations show. */
export function defaultOpenIds(model: ClanModel, filters: OutlineFilters): Set<string> {
  return new Set(startingPersons(model, withCollapsed(filters)).map((p) => p.id));
}

/** Every person with children under the current filters ("Mở hết"). */
export function allOpenIds(model: ClanModel, filters: OutlineFilters): Set<string> {
  const f = withCollapsed(filters);
  const out = new Set<string>();
  const stack = [...startingPersons(model, f)];
  while (stack.length) {
    const p = stack.pop()!;
    const kids = shownChildren(model, p.id, f);
    if (kids.length) out.add(p.id);
    stack.push(...kids);
  }
  return out;
}

/** How many people and generations the filters show, whatever is open. */
export function outlineStats(model: ClanModel, filters: OutlineFilters): { people: number; generations: number } {
  const f = withCollapsed(filters);
  const gens = new Set<number>();
  let people = 0;
  const stack = [...startingPersons(model, f)];
  while (stack.length) {
    const p = stack.pop()!;
    people++;
    const g = model.generationOf(p.id);
    if (g !== undefined) gens.add(g);
    stack.push(...shownChildren(model, p.id, f));
  }
  return { people, generations: gens.size };
}

/** The row that shows a person: spouses appear on their partner's row. */
export function rowIdFor(model: ClanModel, id: string): string | null {
  const p = model.get(id);
  if (!p) return null;
  if (p.isBloodline) return id;
  return model.index.spouseUnionsOf(id)[0]?.bloodlinePersonId ?? null;
}

/** Ancestors that must be open for a person's row to show (not the person). */
export function ancestorIds(model: ClanModel, id: string): string[] {
  return model
    .lineage(id)
    .map((p) => p.id)
    .filter((a) => a !== id);
}

