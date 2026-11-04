import { create } from 'zustand';

/** Per-device viewing preferences, kept in localStorage. */
export type ThemeMode = 'system' | 'light' | 'dark';

interface Prefs {
  theme: ThemeMode;
  largeText: boolean;
  /** null = follow the clan setting `showMaternalDescendants`. */
  showMaternal: boolean | null;
}

interface PrefsState extends Prefs {
  setTheme(theme: ThemeMode): void;
  setLargeText(on: boolean): void;
  setShowMaternal(on: boolean | null): void;
}

const KEY = 'giapha.prefs.v1';
const DEFAULTS: Prefs = { theme: 'system', largeText: false, showMaternal: null };

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
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

/** Whether we set data-theme ourselves (so "system" only removes our own value). */
let themeSetByApp = false;

function apply(p: Prefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (p.theme === 'system') {
    if (themeSetByApp) root.removeAttribute('data-theme');
    themeSetByApp = false;
  } else {
    root.setAttribute('data-theme', p.theme);
    themeSetByApp = true;
  }
  root.setAttribute('data-large-text', String(p.largeText));
}

export const usePrefsStore = create<PrefsState>((set, get) => {
  const initial = read();
  apply(initial);
  const update = (patch: Partial<Prefs>) => {
    set(patch);
    const { theme, largeText, showMaternal } = get();
    const prefs = { theme, largeText, showMaternal };
    write(prefs);
    apply(prefs);
  };
  return {
    ...initial,
    setTheme: (theme) => update({ theme }),
    setLargeText: (largeText) => update({ largeText }),
    setShowMaternal: (showMaternal) => update({ showMaternal }),
  };
});
