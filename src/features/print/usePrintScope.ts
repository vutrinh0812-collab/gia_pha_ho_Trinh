import { useMemo } from 'react';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import type { Theme } from '@/themes/types';
import { computeTreeLayout, type TreeLayout } from '../tree/layout';

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
    .filter((p) => p.isBloodline && !model.isMaternal(p.id) && p.id !== model.rootId)
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

export function branchLine(model: ClanModel, focusId: string | null): string | null {
  const p = focusId ? model.get(focusId) : undefined;
  if (!p) return null;
  const gen = model.generationOf(p.id);
  return `Chi ${p.gender === 'male' ? 'ông' : 'bà'} ${p.fullName}${gen ? ` (đời ${gen})` : ''}: đầy đủ con cháu; các nhánh khác thu gọn`;
}

export { useThemeFonts } from '@/themes/fonts';
