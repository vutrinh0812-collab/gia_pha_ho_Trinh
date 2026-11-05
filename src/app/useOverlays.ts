import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Overlays (detail sheet, search, "Cài đặt" menu, shortcut help) live in the URL
 * query so the phone's Back button closes them.
 * Keys: ct = person detail, tk = search, them = settings menu, phim = keyboard shortcuts.
 */
export type OverlayKey = 'ct' | 'tk' | 'them' | 'phim';
const OVERLAY_KEYS: readonly OverlayKey[] = ['ct', 'tk', 'them', 'phim'];

interface NavState {
  overlay?: boolean;
}

export function useOverlays() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inAppOverlay = (location.state as NavState | null)?.overlay === true;

  const open = useCallback(
    (key: OverlayKey, value = '1') => {
      const next = new URLSearchParams(params);
      // Opening an overlay when one is already open (including switching to another
      // person in `ct`) replaces the current history entry so closing takes one step.
      const replace = OVERLAY_KEYS.some((k) => params.has(k));
      for (const k of OVERLAY_KEYS) if (k !== key) next.delete(k);
      next.set(key, value);
      const state: NavState = { overlay: replace ? inAppOverlay : true };
      navigate({ pathname: location.pathname, search: `?${next}` }, { state, replace });
    },
    [params, location.pathname, navigate, inAppOverlay],
  );

  const close = useCallback(
    (key: OverlayKey) => {
      if (inAppOverlay) {
        navigate(-1);
        return;
      }
      const next = new URLSearchParams(params);
      next.delete(key);
      const search = next.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    },
    [params, location.pathname, navigate, inAppOverlay],
  );

  /** Shows another person in the already open detail sheet. */
  const showPerson = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set('ct', id);
      navigate({ pathname: location.pathname, search: `?${next}` }, { state: location.state, replace: true });
    },
    [params, location.pathname, location.state, navigate],
  );

  /**
   * Centers the "Gia đình" view on a person (closes other overlays).
   * `openDetail` also opens their detail sheet; `replace` swaps the current
   * history entry (used from search, so Back does not reopen the search).
   */
  const goToFamily = useCallback(
    (id: string, opts: { openDetail?: boolean; replace?: boolean } = {}) => {
      const next = new URLSearchParams({ p: id });
      if (opts.openDetail) next.set('ct', id);
      navigate({ pathname: '/', search: `?${next}` }, { replace: opts.replace ?? false });
    },
    [navigate],
  );

  return { params, open, close, showPerson, goToFamily };
}
