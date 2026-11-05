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

/** Older ids kept working after a theme was renamed. */
const ALIASES: Record<string, string> = { minimal: 'ember', 'son-son': 'ember' };

export function getTheme(id: string | null | undefined): Theme | undefined {
  const key = id ? (ALIASES[id] ?? id) : '';
  return THEMES.find((t) => t.id === key);
}
