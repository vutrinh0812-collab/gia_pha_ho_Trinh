/**
 * Semantic zoom levels (SPEC 5.3): the closer you zoom, the more each node shows.
 *
 *   L0 overview  – colour blocks, names of the first generations, branch names
 *   L1 overview  – full names
 *   L2 standard  – + years, spouses, birth order   (the size the layout is computed for)
 *   L3 detail    – + other names, lunar death anniversary
 *   L4 full      – + birth place, burial place, occupation, short notes
 *
 * Desktop (fine pointer) uses the d3-zoom scale k with the thresholds of the spec.
 * Touch screens use the on-screen size of the name text instead (SPEC 5A.1),
 * so a level only appears once its text is actually readable on a phone.
 */
export type Lod = 0 | 1 | 2 | 3 | 4;

/** Name font size at L2, in tree units. */
export const NAME_FONT = 14;

const K_THRESHOLDS = [0.35, 0.7, 1.3, 2.2] as const;
/** On-screen px of the L2 name font at which each level starts (touch). */
const PX_THRESHOLDS = [7.5, 10.5, 15, 22] as const;

export function lodFor(k: number, coarsePointer: boolean): Lod {
  const value = coarsePointer ? k * NAME_FONT : k;
  const thresholds = coarsePointer ? PX_THRESHOLDS : K_THRESHOLDS;
  let level = 0;
  for (const t of thresholds) if (value >= t) level++;
  return level as Lod;
}

/** Smallest zoom scale showing at least the given level. */
export function minScaleFor(level: Lod, coarsePointer: boolean): number {
  if (level === 0) return 0;
  const t = coarsePointer ? PX_THRESHOLDS[level - 1]! / NAME_FONT : K_THRESHOLDS[level - 1]!;
  return t * 1.0001;
}
