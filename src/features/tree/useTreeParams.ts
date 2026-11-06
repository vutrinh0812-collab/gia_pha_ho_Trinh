import { useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { ClanModel } from '@/lib/clanModel';
import { usePrefsStore } from '@/store/prefsStore';

function intParam(v: string | null): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The view state "Sơ đồ" keeps in the URL, shared by the chart and the outline so a
 * link or a search result shows the same people in either layout.
 * URL: tu/den (generation range, the only filter — D56), dd (highlighted lineage),
 *      f (go to person), ct (open detail), xem (layout).
 */
export function useTreeParams(model: ClanModel) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const stateRef = useRef(location.state);
  stateRef.current = location.state;
  const prefMaternal = usePrefsStore((s) => s.showMaternal);
  const setShowMaternal = usePrefsStore((s) => s.setShowMaternal);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true, state: stateRef.current },
      );
    },
    [setParams],
  );

  const maxGen = model.gens.maxGeneration;
  const fromGen = intParam(params.get('tu'));
  const toGen = intParam(params.get('den'));
  /** Sets the shown generations; the full range clears the filter. */
  const setGenRange = useCallback(
    (from: number, to: number) => setParam({ tu: from > 1 ? String(from) : null, den: to < maxGen ? String(to) : null }),
    [setParam, maxGen],
  );

  return {
    params,
    maxGen,
    fromGen,
    toGen,
    setGenRange,
    // Fixed since D56: the whole clan, with spouses. "Bên ngoại" is a setting (Cài đặt).
    branch: null,
    showSpouses: true,
    showMaternal: prefMaternal ?? model.settings.showMaternalDescendants,
    lineageId: params.get('dd'),
    focusId: params.get('f'),
    selectedId: params.get('ct'),
    setParam,
    setShowMaternal,
  };
}

export type TreeParams = ReturnType<typeof useTreeParams>;
