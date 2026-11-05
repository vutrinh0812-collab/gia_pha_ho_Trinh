import { create } from 'zustand';

/**
 * Per-device viewing preferences, kept in localStorage.
 * The screen always uses the Ember theme (no light/dark choice, no other
 * themes on screen); print themes are picked on the print pages only.
 */
interface Prefs {
  largeText: boolean;
  /** null = follow the clan setting `showMaternalDescendants`. */
  showMaternal: boolean | null;
}

interface PrefsState extends Prefs {
  setLargeText(on: boolean): void;
  setShowMaternal(on: boolean | null): void;
}

const KEY = 'giapha.prefs.v1';
const DEFAULTS: Prefs = { largeText: false, showMaternal: null };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      largeText: p.largeText === true,
      showMaternal: typeof p.showMaternal === 'boolean' ? p.showMaternal : null,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage may be unavailable (private mode, embedded browsers): prefs stay in memory.
  }
}

function apply(p: Prefs): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-large-text', String(p.largeText));
}

export const usePrefsStore = create<PrefsState>((set, get) => {
  const initial = read();
  apply(initial);
  const update = (patch: Partial<Prefs>) => {
    set(patch);
    const { largeText, showMaternal } = get();
    const prefs = { largeText, showMaternal };
    write(prefs);
    apply(prefs);
  };
  return {
    ...initial,
    setLargeText: (largeText) => update({ largeText }),
    setShowMaternal: (showMaternal) => update({ showMaternal }),
  };
});
