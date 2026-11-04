import { useEffect, useMemo, useState } from 'react';
import { useThemeFonts } from '@/themes/fonts';
import { SCREEN_THEME_ID, treeThemeVars } from '@/themes/treeVars';
import type { Theme } from '@/themes/types';

type Registry = typeof import('@/themes/registry');

let registry: Promise<Registry> | null = null;
/** The theme registry (with ornaments) is fetched only when someone picks a theme. */
export function loadThemes(): Promise<Registry> {
  registry ??= import('@/themes/registry');
  return registry;
}

/** The tree's theme: null for the screen theme, else the loaded print theme. */
export function useTreeTheme(id: string): Theme | null {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    if (id === SCREEN_THEME_ID) {
      setTheme(null);
      return;
    }
    let live = true;
    void loadThemes().then((r) => {
      const t = r.getTheme(id);
      if (live) setTheme(t && t.id !== SCREEN_THEME_ID ? t : null);
    });
    return () => {
      live = false;
    };
  }, [id]);
  const fonts = useMemo(() => [theme], [theme]);
  useThemeFonts(fonts);
  return theme;
}

export { treeThemeVars };
