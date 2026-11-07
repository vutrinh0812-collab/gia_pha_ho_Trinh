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
  /** Write the text in capitals (D78), whatever case it was typed in. */
  uppercase?: boolean;
  /** TTF to embed in PDF exports (phase 6). */
  ttfUrl?: string;
}

/**
 * Lettering that looks part of the material it sits on (D80): engraved (khắc chìm: a dark
 * rim on the upper left, a light rim on the lower right) or raised (nổi: the reverse).
 * Drawn as two offset copies under the text (no SVG filters, which the PDF export drops),
 * so it stays vector and identical on screen and on paper.
 */
export interface TextRelief {
  style: 'engraved' | 'raised';
  light: string;
  dark: string;
  /** Offset of each rim, in ems of the text (about 0.02–0.035). */
  depth: number;
  /** Opacity of the rims (default 0.8). */
  opacity?: number;
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
  /** A picture of the whole sheet (an imported frame package, D62), drawn under everything. */
  backgroundImage?: { href: string; fit: 'cover' | 'stretch' | 'contain' };
  /**
   * A picture of the title board (cuốn thư, hoành phi…) as its own layer (D72): the title
   * and subtitle, which people type on the print page, are written inside `textBox`.
   */
  titleBoard?: TitleBoard;
  /**
   * Couplet boards painted in the background picture (D74): the couplets are written
   * inside these areas (mm on the sheet) instead of on boards drawn by the app.
   * `defaultText` is used when the clan has no couplets of its own.
   */
  coupletBoxes?: {
    left: { x: number; y: number; w: number; h: number };
    right: { x: number; y: number; w: number; h: number };
    defaultText?: { left: string; right: string };
  };
  /** Where title and tree go on the sheet, in mm from each edge (default: inside the frame). */
  contentInsetMm?: { top: number; right: number; bottom: number; left: number };
  /**
   * Material of the lettering (D80): the title and subtitle (on the title board), the
   * couplets (on their boards) and the names in the tree (on the cards).
   */
  textRelief?: { title?: TextRelief; couplet?: TextRelief; name?: TextRelief };
  /** Paper direction the background picture was drawn for. */
  preferredOrientation?: 'landscape' | 'portrait';
}

/** The title board layer of a print theme (D72). */
export interface TitleBoard {
  /** The picture, with a transparent background (PNG/WebP), as a URL or data URL. */
  href: string;
  /** Height ÷ width of the picture. */
  aspect: number;
  /** Top edge and width on the A1 sheet, in mm; centred unless `leftMm` is given. */
  topMm: number;
  widthMm: number;
  leftMm?: number;
  /** Area for the text inside the picture, as fractions (0–1) of its width and height. */
  textBox: { top: number; bottom: number; left: number; right: number };
  /**
   * The board is curved (an arched scroll): the text follows an arc of this radius,
   * given as a multiple of the board's width (D73). Left out: straight text.
   */
  arcRadius?: number;
  /**
   * Where the tree may start, as a fraction (0–1) of the board's height (D78): for a
   * board whose lower part is only ornaments at the sides (ribbon tails), so the tree
   * starts below the text and not below the whole picture. Left out: below the board.
   */
  treeFrom?: number;
}
