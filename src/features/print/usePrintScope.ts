import { useMemo } from 'react';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { computeTreeLayout, type LayoutMetrics, type TreeLayout } from '../tree/layout';

export interface BranchOption {
  person: PersonRec;
  gen: number;
  descendants: number;
}

/** People whose branch can be printed: clan members with at least one descendant. */
export function branchOptions(model: ClanModel): BranchOption[] {
  const count = (id: string): number =>
    model.index
      .unionsOf(id)
      .flatMap((u) => model.index.childrenOf(u.id))
      .reduce((n, c) => n + 1 + count(c.id), 0);
  return model.persons
    .filter((p) => p.isBloodline && !model.isMaternal(p.id) && !(model.founders.length === 1 && p.id === model.rootId))
    .map((p) => ({ person: p, gen: model.generationOf(p.id) ?? 0, descendants: count(p.id) }))
    .filter((o) => o.descendants > 0)
    .sort((a, b) => a.gen - b.gen || b.descendants - a.descendants);
}

/** The tree to print: the whole clan, or one branch (SPEC §8 "một chi"). */
export function usePrintLayout(model: ClanModel, focusId: string | null, showSpouses: boolean): TreeLayout {
  return useMemo(
    () =>
      computeTreeLayout(model, {
        branch: null,
        fromGen: null,
        toGen: null,
        showSpouses,
        showMaternal: model.settings.showMaternalDescendants,
        collapsed: new Set(),
        focusId,
      }),
    [model, focusId, showSpouses],
  );
}

/**
 * The tree to print as a builder (D73): the sheet asks for the spacing it needs to fill
 * the paper; results are cached, so the theme thumbnails and the preview share them.
 */
export function usePrintLayoutBuilder(
  model: ClanModel,
  focusId: string | null,
  showSpouses: boolean,
): (spacing: Partial<LayoutMetrics>) => TreeLayout {
  return useMemo(() => {
    const cache = new Map<string, TreeLayout>();
    const filters = {
      branch: null,
      fromGen: null,
      toGen: null,
      showSpouses,
      showMaternal: model.settings.showMaternalDescendants,
      collapsed: new Set<string>(),
      focusId,
    };
    return (spacing) => {
      const key = JSON.stringify(spacing);
      let l = cache.get(key);
      if (!l) {
        l = computeTreeLayout(model, filters, spacing);
        cache.set(key, l);
      }
      return l;
    };
  }, [model, focusId, showSpouses]);
}

export { useThemeFonts } from '@/themes/fonts';
