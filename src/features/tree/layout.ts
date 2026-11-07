/**
 * Tree layout for the "Sơ đồ" view (SPEC 5.2–5.3).
 *
 * One node per bloodline person, with their spouses listed inside the node.
 * Horizontal placement comes from d3-flextree (Reingold–Tilford for nodes of
 * different sizes); vertical placement is one row per generation so the
 * generation rail lines up. Sizes are fixed at the L2 level of detail and the
 * layout is computed once per data/filter change — zooming never moves nodes.
 */
import { flextree, type FlexHierarchyNode } from 'd3-flextree';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { spouseRole, toRoman } from '@/lib/format';

export const NODE_W = 176;
/**
 * From this generation down, each person is a narrow "couple column": the name written
 * top to bottom, one word per line (as in a traditional family book), and below it,
 * in a tinted section of the same card, each spouse the same way. The crowded lower
 * generations take about a third of the width, and the couple still reads as one unit:
 * width is what a family tree lacks, height it has to spare.
 */
export const VERTICAL_FROM_GEN = 3;
export const VNODE_W = 64;
/** Minimum space between a word and the left/right frame of a vertical card. */
export const V_PAD_X = 6;
/** Line heights inside a vertical card (tree units). */
export const V = {
  padTop: 10,
  caption: 15,
  word: 18,
  year: 14,
  padBottom: 10,
  /** Space above a spouse section (the divider sits in the middle of it). */
  spouseGap: 10,
  /** "vợ", "vợ hai", "chồng". */
  spouseRole: 13,
  spouseWord: 16,
} as const;
/** Vertical gap between generations; L3/L4 cards expand into it. */
export const VGAP = 76;
/** Default number of generation rows on a full tree (the app starts with 4 generations). */
export const MIN_GENERATIONS = 4;
const SIBLING_GAP = 14;
const COUSIN_GAP = 34;
const BASE_H = 62;
export const SPOUSE_LINE = 15;
/** Distance of the children bar above the child row. */
const BAR_OFFSET = 26;

const ORDINALS = ['cả', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];

export interface TreeFilters {
  /** Show only one branch ("Chi …"). */
  branch: string | null;
  fromGen: number | null;
  toGen: number | null;
  showSpouses: boolean;
  showMaternal: boolean;
  collapsed: ReadonlySet<string>;
  /**
   * Branch view ("in theo chi"): show the line from the root ancestor down to this
   * person and ALL of their descendants; everyone else along the way (siblings,
   * uncles…) is shown but kept collapsed, with the count of hidden descendants.
   */
  focusId?: string | null;
}

export interface TreeSpouse {
  person: PersonRec;
  role: string;
}

export interface TreeNode {
  id: string;
  person: PersonRec;
  gen: number;
  spouses: TreeSpouse[];
  /** "II · bà hai". */
  caption: string | null;
  /** Narrow card with the name written top to bottom (generation ≥ VERTICAL_FROM_GEN). */
  vertical: boolean;
  /** Top-left corner and size, in tree units. */
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
  childIds: string[];
  /** Has children that the current filters would show. */
  hasChildren: boolean;
  collapsed: boolean;
  /** Descendants hidden by collapsing this node. */
  hiddenCount: number;
  maternal: boolean;
}

export interface TreeFamily {
  parentId: string;
  childIds: string[];
  /** Orthogonal connector path (SVG "d"). */
  d: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TreeRow {
  gen: number;
  /** A generation shown as a placeholder: nobody recorded yet. */
  empty?: boolean;
  top: number;
  /** Height of the node band (without the gap below). */
  height: number;
}

export interface BranchLabel {
  label: string;
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  byId: ReadonlyMap<string, TreeNode>;
  families: TreeFamily[];
  rows: TreeRow[];
  branchLabels: BranchLabel[];
  bounds: Bounds;
}

interface Datum {
  id: string;
  gen: number;
  w: number;
  h: number;
  children: Datum[];
}

const VIRTUAL_ROOT = '__root__';

export function isVerticalGen(gen: number): boolean {
  return gen >= VERTICAL_FROM_GEN;
}

export type VerticalLineKind = 'caption' | 'word' | 'year' | 'role' | 'spouseWord';

export interface VerticalLine {
  kind: VerticalLineKind;
  text: string;
  /** Text baseline, from the top of the card (tree units). */
  y: number;
}

export interface VerticalSection {
  /** Top of the spouse section, where the divider is drawn. */
  top: number;
  spouseId: string;
}

export interface VerticalMetrics {
  lines: VerticalLine[];
  sections: VerticalSection[];
  height: number;
}

function yearsOf(p: PersonRec): string[] {
  const years: string[] = [];
  const b = p.birth?.solar?.slice(0, 4) ?? (p.birth?.lunar?.year ? String(p.birth.lunar.year) : null);
  const d = p.death?.solar?.slice(0, 4) ?? (p.death?.lunar?.year ? String(p.death.lunar.year) : null);
  if (b) years.push(b);
  if (p.death?.isDeceased) years.push(d ?? '?');
  return years;
}

const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/**
 * What a vertical card shows, top to bottom, with each line's position: birth order,
 * the name word by word, the years; then one section per spouse with the role ("vợ hai")
 * and the spouse's name word by word. Shared by the screen tree and the printed poster.
 */
export function verticalMetrics(
  p: PersonRec,
  spouses: readonly TreeSpouse[],
  opts: { years?: boolean } = {},
): VerticalMetrics {
  const lines: VerticalLine[] = [];
  const sections: VerticalSection[] = [];
  let y = V.padTop;
  if (p.birthOrder) {
    lines.push({ kind: 'caption', text: toRoman(p.birthOrder), y: y + 10 });
    y += V.caption;
  }
  for (const w of words(p.fullName)) lines.push({ kind: 'word', text: w, y: (y += V.word) - 4 });
  if (opts.years !== false) for (const yr of yearsOf(p)) lines.push({ kind: 'year', text: yr, y: (y += V.year) - 2 });
  for (const s of spouses) {
    y += V.spouseGap / 2;
    sections.push({ top: y, spouseId: s.person.id });
    y += V.spouseGap / 2;
    lines.push({ kind: 'role', text: s.role.toLowerCase(), y: (y += V.spouseRole) - 3 });
    for (const w of words(s.person.fullName)) lines.push({ kind: 'spouseWord', text: w, y: (y += V.spouseWord) - 4 });
  }
  return { lines, sections, height: y + V.padBottom };
}

export function isShown(model: ClanModel, p: PersonRec, f: TreeFilters): boolean {
  if (!p.isBloodline) return false;
  if (!f.showMaternal && model.isMaternal(p.id)) return false;
  const gen = model.generationOf(p.id);
  if (gen === undefined) return false;
  if (f.toGen !== null && gen > f.toGen) return false;
  return true;
}

/** Children shown under a person (all marriages, in order), ignoring collapse. */
export function shownChildren(model: ClanModel, id: string, f: TreeFilters): PersonRec[] {
  const out: PersonRec[] = [];
  for (const u of model.index.unionsOf(id)) {
    for (const c of model.index.childrenOf(u.id)) if (isShown(model, c, f)) out.push(c);
  }
  return out;
}

export function countShownDescendants(model: ClanModel, id: string, f: TreeFilters): number {
  let n = 0;
  const stack = [id];
  while (stack.length) {
    for (const c of shownChildren(model, stack.pop()!, f)) {
      n++;
      stack.push(c.id);
    }
  }
  return n;
}

/** Persons the layout starts from (forest), according to the branch and from-generation filters. */
export function startingPersons(model: ClanModel, f: TreeFilters): PersonRec[] {
  let starts: PersonRec[] = model.founders;
  if (f.branch) {
    starts = model.persons.filter((p) => {
      if (!isShown(model, p, f) || p.branchLabel !== f.branch) return false;
      const parent = model.bloodlineParent(p.id);
      return !parent || parent.branchLabel !== f.branch;
    });
  }
  if (f.fromGen !== null) {
    const from = f.fromGen;
    const result: PersonRec[] = [];
    const stack = [...starts].reverse();
    while (stack.length) {
      const p = stack.pop()!;
      const gen = model.generationOf(p.id)!;
      if (gen >= from) result.push(p);
      else stack.push(...shownChildren(model, p.id, f).reverse());
    }
    starts = result;
  }
  return starts;
}

/**
 * "II · bà hai": birth order, and which mother when the parent had children in several
 * marriages. `withOrder: false` leaves out the birth order (the vertical tree, where the
 * order of the rows already shows it; D70).
 */
export function nodeCaption(model: ClanModel, p: PersonRec, f: TreeFilters, withOrder = true): string | null {
  const parts: string[] = [];
  if (withOrder && p.birthOrder) parts.push(toRoman(p.birthOrder));
  const parentUnion = model.index.parentUnionOf(p.id);
  if (parentUnion) {
    const unionsWithKids = model.index
      .unionsOf(parentUnion.bloodlinePersonId)
      .filter((u) => model.index.childrenOf(u.id).some((c) => isShown(model, c, f)));
    if (unionsWithKids.length > 1) {
      const other = model.get(parentUnion.spousePersonId);
      const title = other?.gender === 'male' ? 'ông' : 'bà';
      parts.push(`${title} ${ORDINALS[parentUnion.order - 1] ?? parentUnion.order}`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export function spousesOf(model: ClanModel, p: PersonRec): TreeSpouse[] {
  const unions = model.index.unionsOf(p.id);
  return unions
    .map((u) => ({ u, person: model.get(u.spousePersonId) }))
    .filter((x): x is { u: (typeof unions)[number]; person: PersonRec } => Boolean(x.person))
    .map(({ u, person }) => ({ person, role: spouseRole(person.gender, u.order, unions.length) }));
}

/** The ids kept open in a branch view: the line from the root to the focus person, and their descendants. */
export function branchOpenIds(model: ClanModel, focusId: string, f: TreeFilters): Set<string> {
  const person = model.get(focusId);
  // A spouse's branch is their partner's.
  const anchor = person && !person.isBloodline ? model.index.spouseUnionsOf(focusId)[0]?.bloodlinePersonId : focusId;
  const open = new Set<string>();
  if (!anchor || !model.get(anchor)) return open;
  for (const p of model.lineage(anchor)) open.add(p.id);
  const stack = [anchor];
  while (stack.length) {
    const id = stack.pop()!;
    open.add(id);
    for (const c of shownChildren(model, id, f)) stack.push(c.id);
  }
  return open;
}

export function computeTreeLayout(model: ClanModel, f: TreeFilters): TreeLayout {
  const info = new Map<string, { spouses: TreeSpouse[]; shownKids: PersonRec[] }>();
  const rowH = new Map<number, number>();
  const branchOpen = f.focusId ? branchOpenIds(model, f.focusId, f) : null;
  const isCollapsed = (id: string) => f.collapsed.has(id) || (branchOpen !== null && !branchOpen.has(id));

  const build = (p: PersonRec): Datum => {
    const gen = model.generationOf(p.id)!;
    const spouses = f.showSpouses ? spousesOf(model, p) : [];
    const kids = shownChildren(model, p.id, f);
    info.set(p.id, { spouses, shownKids: kids });
    const vertical = isVerticalGen(gen);
    const h = vertical ? verticalMetrics(p, spouses).height : BASE_H + spouses.length * SPOUSE_LINE;
    rowH.set(gen, Math.max(rowH.get(gen) ?? 0, h));
    return { id: p.id, gen, w: vertical ? VNODE_W : NODE_W, h, children: isCollapsed(p.id) ? [] : kids.map(build) };
  };

  const starts = startingPersons(model, f);
  const virtual: Datum = { id: VIRTUAL_ROOT, gen: 0, w: 0, h: 0, children: starts.map(build) };

  const gens = [...rowH.keys()].sort((a, b) => a - b);
  const rows: TreeRow[] = [];
  let top = 0;
  for (const gen of gens) {
    const height = rowH.get(gen)!;
    rows.push({ gen, top, height });
    top += height + VGAP;
  }
  const rowTop = new Map(rows.map((r) => [r.gen, r.top]));
  // A new clan shows at least MIN_GENERATIONS rows so the next generation is visibly waiting to be filled.
  const padRows = !f.branch && f.fromGen === null && f.toGen === null && !f.focusId;
  while (padRows && rows.length > 0 && rows[rows.length - 1]!.gen < MIN_GENERATIONS) {
    const last = rows[rows.length - 1]!;
    rows.push({ gen: last.gen + 1, empty: true, top: last.top + last.height + VGAP, height: BASE_H });
  }

  const layout = flextree<Datum>({
    nodeSize: (n) => (n.data.id === VIRTUAL_ROOT ? [0, 0] : [n.data.w, (rowH.get(n.data.gen) ?? 0) + VGAP]),
    spacing: (a, b) => (a.parent === b.parent ? SIBLING_GAP : COUSIN_GAP),
  });
  const root = layout.hierarchy(virtual, (d) => d.children);
  layout(root);

  let minX = Infinity;
  root.each((n) => {
    if (n.data.id !== VIRTUAL_ROOT) minX = Math.min(minX, n.x - n.data.w / 2);
  });
  if (!Number.isFinite(minX)) minX = 0;

  const nodes: TreeNode[] = [];
  const byId = new Map<string, TreeNode>();
  root.each((n: FlexHierarchyNode<Datum>) => {
    const d = n.data;
    if (d.id === VIRTUAL_ROOT) return;
    const person = model.get(d.id)!;
    const meta = info.get(d.id)!;
    const collapsed = isCollapsed(d.id) && meta.shownKids.length > 0;
    const parentId = n.parent && n.parent.data.id !== VIRTUAL_ROOT ? n.parent.data.id : null;
    const node: TreeNode = {
      id: d.id,
      person,
      gen: d.gen,
      spouses: meta.spouses,
      caption: nodeCaption(model, person, f),
      x: n.x - d.w / 2 - minX,
      y: rowTop.get(d.gen) ?? 0,
      w: d.w,
      vertical: isVerticalGen(d.gen),
      h: d.h,
      parentId,
      childIds: (n.children ?? []).map((c) => c.data.id),
      hasChildren: meta.shownKids.length > 0,
      collapsed,
      hiddenCount: collapsed ? countShownDescendants(model, d.id, f) : 0,
      maternal: model.isMaternal(d.id),
    };
    nodes.push(node);
    byId.set(node.id, node);
  });

  const families: TreeFamily[] = [];
  for (const p of nodes) {
    if (p.childIds.length === 0) continue;
    const kids = p.childIds.map((id) => byId.get(id)!);
    const px = p.x + p.w / 2;
    const childTop = kids[0]!.y;
    const barY = childTop - BAR_OFFSET;
    const centers = kids.map((k) => k.x + k.w / 2);
    const lo = Math.min(px, ...centers);
    const hi = Math.max(px, ...centers);
    let d = `M${px},${p.y + p.h}V${barY}M${lo},${barY}H${hi}`;
    for (const c of centers) d += `M${c},${barY}V${childTop}`;
    families.push({
      parentId: p.id,
      childIds: p.childIds,
      d,
      minX: Math.min(lo, p.x),
      maxX: Math.max(hi, p.x + p.w),
      minY: p.y,
      maxY: childTop,
    });
  }

  // Branch names, shown when zoomed far out: above the first node of each branch.
  const branchLabels: BranchLabel[] = [];
  for (const n of nodes) {
    const label = n.person.branchLabel;
    if (!label) continue;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent?.person.branchLabel === label) continue;
    let lo = n.x;
    let hi = n.x + n.w;
    const stack = [...n.childIds];
    while (stack.length) {
      const c = byId.get(stack.pop()!)!;
      lo = Math.min(lo, c.x);
      hi = Math.max(hi, c.x + c.w);
      stack.push(...c.childIds);
    }
    branchLabels.push({ label, x: (lo + hi) / 2, y: n.y - VGAP / 2 });
  }

  const bounds: Bounds = nodes.length
    ? {
        minX: Math.min(...nodes.map((n) => n.x)),
        minY: 0,
        maxX: Math.max(...nodes.map((n) => n.x + n.w)),
        maxY: rows.length ? rows[rows.length - 1]!.top + rows[rows.length - 1]!.height : 0,
      }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return { nodes, byId, families, rows, branchLabels, bounds };
}

/** Collapses every node below the top shown generation, so only two generations remain. */
export function collapseAllIds(model: ClanModel, f: TreeFilters): Set<string> {
  const layout = computeTreeLayout(model, { ...f, collapsed: new Set() });
  const minGen = layout.rows[0]?.gen ?? 1;
  return new Set(layout.nodes.filter((n) => n.gen > minGen && n.hasChildren).map((n) => n.id));
}
