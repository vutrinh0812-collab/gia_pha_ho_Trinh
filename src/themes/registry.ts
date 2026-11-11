import type { Theme } from './types';

/**
 * Every folder in src/themes with a theme.ts is a theme. Loaded eagerly here, but
 * this module is only imported by the print and theme pages (lazy chunks), so
 * viewers of the tree never download ornaments (SPEC 5A.3).
 */
const modules = import.meta.glob<{ default: Theme }>('./*/theme.ts', { eager: true });

export const THEMES: Theme[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export const PRINT_THEMES = THEMES.filter((t) => t.usage.includes('print'));

/**
 * The print theme used when none is chosen, or the chosen one no longer exists (D91: the
 * drawn themes "Truyền thống đỏ", "Sơn mài vàng", "Giấy dó mực tàu" and "Men lam" were
 * removed; the clans that had them get this one).
 */
export const DEFAULT_PRINT_THEME_ID = 'hoa-dieu-lua';

/** The print theme with this id, else the default one. */
export function printThemeOrDefault(id: string | null | undefined): Theme {
  return PRINT_THEMES.find((t) => t.id === id) ?? PRINT_THEMES.find((t) => t.id === DEFAULT_PRINT_THEME_ID) ?? PRINT_THEMES[0]!;
}

/** Older ids kept working after a theme was renamed. */
const ALIASES: Record<string, string> = { minimal: 'ember', 'son-son': 'ember' };

export function getTheme(id: string | null | undefined): Theme | undefined {
  const key = id ? (ALIASES[id] ?? id) : '';
  return THEMES.find((t) => t.id === key);
}
