/**
 * Theme = one design system (SPEC §7): colours, type, node and connector style,
 * frame and ornaments. Each theme lives in src/themes/<id>/theme.ts with its
 * ornaments in src/themes/<id>/ornaments/*.svg; the registry picks up any new
 * folder by itself, so adding a theme never touches core code.
 * Print sizes are in millimetres and points (1pt = 0.3528mm).
 */
export interface FontSpec {
  family: string;
  weight: number;
  sizePt: number;
  letterSpacing?: number;
  italic?: boolean;
  /** TTF to embed in PDF exports (phase 6). */
  ttfUrl?: string;
}

export type OrnamentPosition = 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right' | 'background';

export interface Theme {
  id: string;
  name: string;
  description: string;
  usage: Array<'screen' | 'print'>;
  /** Google Fonts stylesheet with every face the theme uses (Vietnamese subset). */
  fontsCss?: string;
  colors: {
    background: string;
    surface: string;
    frame: string;
    frameInner?: string;
    line: string;
    textPrimary: string;
    textSecondary: string;
    male: string;
    female: string;
    spouse: string;
    deceased: string;
    accent: string;
    generationBand: string;
    /** Couplet boards and the title banner text (extension of the spec's palette). */
    coupletBoard?: string;
    coupletText?: string;
    bannerText?: string;
  };
  typography: {
    title: FontSpec;
    heading: FontSpec;
    name: FontSpec;
    body: FontSpec;
    couplet: FontSpec;
  };
  node: {
    radius: number;
    borderWidth: number;
    borderStyle: 'single' | 'double';
    fill: string;
    shadow?: string;
    orientation: 'horizontal' | 'vertical' | 'auto';
    paddingMm: number;
  };
  connector: { style: 'orthogonal' | 'curved'; width: number; color: string };
  frame: {
    enabled: boolean;
    /** A square tile repeated along the frame band. */
    borderSvg?: string;
    cornerSvg?: string;
    thicknessMm: number;
  };
  ornaments: {
    titleBanner?: string;
    showCouplets: boolean;
    /** A seal (con triện) beside the title, drawn with the clan's name. */
    seal?: { color: string };
    decorations?: Array<{ svg: string; position: OrnamentPosition; widthMm?: number; opacity?: number }>;
  };
  /** A tile repeated over the whole sheet (paper fibre, faint landscape…). */
  backgroundTexture?: string;
}
