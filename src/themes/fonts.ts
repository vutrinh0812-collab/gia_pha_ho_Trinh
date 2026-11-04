import { useEffect } from 'react';
import type { Theme } from './types';

/** Adds each theme's Google Fonts stylesheet once (Vietnamese subset). */
export function useThemeFonts(themes: ReadonlyArray<Theme | null | undefined>): void {
  useEffect(() => {
    for (const t of themes) {
      if (!t?.fontsCss || document.querySelector(`link[data-theme-font="${t.id}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = t.fontsCss;
      link.dataset.themeFont = t.id;
      document.head.appendChild(link);
    }
  }, [themes]);
}
