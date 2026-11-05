import type { CSSProperties } from 'react';
import type { Theme } from './types';

/** The screen theme (DECISIONS D51): its tokens live in styles.css. */
export const SCREEN_THEME_ID = 'ember';

/**
 * CSS custom properties that restyle the on-screen tree with a print theme's
 * colours and type (SPEC 5.1 "Chọn theme"). Frames and ornaments stay on paper:
 * the screen keeps showing the tree full size and easy to read (SPEC 5).
 */
export function treeThemeVars(theme: Theme): CSSProperties {
  const c = theme.colors;
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, ${theme.node.fill})`;
  const vars: Record<string, string> = {
    '--bg': c.background,
    '--surface': theme.node.fill,
    '--line': theme.connector.color,
    '--line-strong': c.frame,
    '--text': c.textPrimary,
    '--text-2': c.textSecondary,
    '--accent': c.accent,
    '--accent-track': tint(c.female, 45),
    '--male': c.male,
    '--female': c.female,
    '--spouse': c.spouse,
    '--male-soft': tint(c.frame, 16),
    '--female-soft': tint(c.female, 8),
    '--deceased-fill': tint(c.deceased, 6),
    '--band': c.generationBand,
    '--font-ui': `'${theme.typography.name.family}', Georgia, 'Times New Roman', serif`,
  };
  return vars as CSSProperties;
}
