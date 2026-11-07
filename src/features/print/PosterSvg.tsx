/**
 * The printed sheet (SPEC §8) drawn as one SVG in millimetres: A1 landscape is
 * 841 × 594. Shared by the theme preview (/themes) and the print page (/print);
 * phase 6 adds auto-fit with vertical name boxes and the PDF/SVG/PNG export.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import type { ClanModel } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import type { FontSpec, Theme } from '@/themes/types';
import { V_PAD_X, verticalMetrics, type LayoutMetrics, type TreeLayout } from '../tree/layout';

export const A1 = { landscape: { w: 841, h: 594 }, portrait: { w: 594, h: 841 } } as const;
const SAFE = 15; // mm, printer-safe margin
const PT = 0.3528; // mm per point

export interface PosterOptions {
  orientation: 'landscape' | 'portrait';
  showYears: boolean;
  showSpouses: boolean;
  showOtherNames: boolean;
  showCouplets: boolean;
  showColophon: boolean;
  showGenerations: boolean;
}

export const DEFAULT_POSTER_OPTIONS: PosterOptions = {
  orientation: 'landscape',
  showYears: true,
  showSpouses: true,
  showOtherNames: false,
  showCouplets: true,
  showColophon: false,
  // No "Đời 1, 2…" column on the sheet (D74).
  showGenerations: false,
};

/** Builds the tree with a given spacing (the print page passes one, so the sheet can fit it). */
export type LayoutBuilder = (spacing: Partial<LayoutMetrics>) => TreeLayout;

/**
 * Spacing on the sheet (D73): generations closer together, shorter connectors and
 * sibling gaps than on screen; the room left is given to the cards' line spacing.
 */
export const PRINT_SPACING: Partial<LayoutMetrics> = { vgap: 34, barOffset: 15, siblingGap: 8, cousinGap: 18 };
/** Line spacing in the cards stays comfortable to read; beyond it, generations move apart a little. */
const MAX_LINE_SCALE = 3.0;
const MAX_PRINT_VGAP = 100;
/** Card text grows with the spacing, up to this much, so the cards read from further away. */
const MAX_TEXT_SCALE = 1.3;

interface Props {
  theme: Theme;
  model: ClanModel;
  /** A ready layout, or a builder: then the cards' line spacing is chosen to fill the sheet (D73). */
  layout: TreeLayout | LayoutBuilder;
  options?: Partial<PosterOptions>;
  /** Shown under the title when the sheet is one branch ("Chi ông …"). */
  branchLine?: string | null;
  className?: string;
  /** Typed on the print page; default: the clan's title and subtitle (D72). */
  title?: string;
  /** null/empty hides the subtitle. */
  subtitle?: string | null;
}

/** Splits an <svg …>inner</svg> string into its viewBox and inner markup, to inline it. */
function parseSvg(svg: string): { viewBox: string; inner: string; w: number; h: number } {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 100 100';
  const [, , w = 100, h = 100] = viewBox.split(/\s+/).map(Number);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { viewBox, inner, w, h };
}

function Ornament(props: { svg: string; x: number; y: number; width: number; height?: number; flip?: boolean; opacity?: number }) {
  const { viewBox, inner, w, h } = parseSvg(props.svg);
  const height = props.height ?? (props.width * h) / w;
  const content = (
    <svg
      x={props.flip ? -props.x - props.width : props.x}
      y={props.y}
      width={props.width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      opacity={props.opacity}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
  return props.flip ? <g transform="scale(-1 1)">{content}</g> : content;
}

const CHAR_W = 0.55;
function fit(text: string, maxW: number, size: number): string {
  const max = Math.floor(maxW / (size * CHAR_W));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

const ital = (f: FontSpec) => (f.italic ? 'italic' : undefined);

let measureCtx: CanvasRenderingContext2D | null | undefined;
/**
 * Widths of each letter of `text` (in units of the font size), measured by the browser
 * with the real font so letters can be laid one by one on an arc. Each letter's width
 * includes the kerning with the one before. Without a canvas (tests), an estimate.
 */
export function letterWidths(text: string, f: FontSpec): number[] {
  const letters = Array.from(text.normalize('NFC'));
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  const ctx = measureCtx;
  if (!ctx) return letters.map((l) => (l === ' ' ? 0.28 : 0.56));
  ctx.font = `${f.italic ? 'italic ' : ''}${f.weight} 100px "${f.family}"`;
  const out: number[] = [];
  let before = 0;
  let prefix = '';
  for (const l of letters) {
    prefix += l;
    const now = ctx.measureText(prefix).width / 100;
    out.push(now - before);
    before = now;
  }
  return out;
}

/** Re-renders once web fonts have loaded, so measured letter widths use the real font. */
function useFontsLoaded(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fonts) return;
    let alive = true;
    const bump = () => alive && setN((v) => v + 1);
    void fonts.ready.then(bump);
    fonts.addEventListener?.('loadingdone', bump);
    return () => {
      alive = false;
      fonts.removeEventListener?.('loadingdone', bump);
    };
  }, []);
  return n;
}

/**
 * A line of text bent along an arc (D73), letter by letter: each letter is placed at its
 * distance along the arc and turned to follow it. Built from plain rotated <text>
 * elements, which every renderer and the PDF export understand (unlike <textPath>).
 * The arc's highest point is at (cx, y); its centre is `radius` below.
 */
function ArcText(props: { text: string; cx: number; y: number; radius: number; size: number; font: FontSpec; fill: string }) {
  const { text, cx, y, radius, size, font, fill } = props;
  const letters = Array.from(text.normalize('NFC'));
  const widths = letterWidths(text, font).map((w) => w * size);
  const total = widths.reduce((a, b) => a + b, 0);
  let along = -total / 2;
  return (
    <g aria-label={text}>
      {letters.map((l, i) => {
        const mid = along + widths[i]! / 2;
        along += widths[i]!;
        if (l === ' ') return null;
        const a = mid / radius;
        const x = cx + radius * Math.sin(a);
        const ly = y + radius - radius * Math.cos(a);
        return (
          <text
            key={i}
            x={x}
            y={ly}
            transform={`rotate(${(a * 180) / Math.PI} ${x} ${ly})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={font.family}
            fontWeight={font.weight}
            fontStyle={ital(font)}
            fontSize={size}
            fill={fill}
            aria-hidden="true"
          >
            {l}
          </text>
        );
      })}
    </g>
  );
}

export function PosterSvg({ theme, model, layout, options, branchLine, className, title, subtitle }: Props) {
  const o = { ...DEFAULT_POSTER_OPTIONS, ...options };
  const uid = useId().replace(/:/g, '');
  const { w: W, h: H } = A1[o.orientation];
  const c = theme.colors;
  const t = theme.typography;
  const s = model.settings;
  const T = theme.frame.enabled ? theme.frame.thicknessMm : 0;

  // Content box inside the frame, or the area a frame package's picture leaves free (D62).
  const inset = SAFE + T + 8;
  const ci = theme.contentInsetMm;
  const box = ci
    ? { x: ci.left, y: ci.top, w: Math.max(100, W - ci.left - ci.right), h: Math.max(100, H - ci.top - ci.bottom) }
    : { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset };

  // ---- Header: banner + title, subtitle, root ancestor ----
  // A title board (D72) is a picture placed in mm on the sheet; the title and subtitle
  // are fitted inside its text box. Otherwise the theme's SVG banner or plain text.
  useFontsLoaded();
  const board = theme.titleBoard;
  const titleText = title ?? s.title;
  const subText = subtitle !== undefined ? subtitle?.trim() || null : s.subtitle;
  const bannerW = board ? board.widthMm : Math.min(box.w * 0.52, 430);
  const bannerH = board ? board.widthMm * board.aspect : theme.ornaments.titleBanner ? (bannerW * 84) / 400 : 0;
  const bannerX = board?.leftMm ?? (W - bannerW) / 2;
  const headerTop = board ? board.topMm : box.y;
  const tb = board && {
    x: bannerX + board.textBox.left * bannerW,
    y: headerTop + board.textBox.top * bannerH,
    w: (board.textBox.right - board.textBox.left) * bannerW,
    h: (board.textBox.bottom - board.textBox.top) * bannerH,
  };
  const titleZoneH = tb ? (subText ? tb.h * 0.62 : tb.h) : 0;
  const em = (text: string, f: FontSpec) => Math.max(0.5, letterWidths(text, f).reduce((a, b) => a + b, 0));
  const titleSize = tb
    ? Math.min(t.title.sizePt * PT, (tb.w * 0.94) / em(titleText, t.title), titleZoneH * 0.72)
    : Math.min(t.title.sizePt * PT, (bannerW * 0.78) / (titleText.length * 0.52), 30);
  const titleY = tb ? tb.y + titleZoneH / 2 : theme.ornaments.titleBanner ? headerTop + bannerH / 2 : headerTop + titleSize * 0.8;
  const subSize = tb && subText
    ? Math.min(titleSize * 0.5, (tb.w * 0.94) / em(subText, t.heading), (tb.h - titleZoneH) * 0.6)
    : t.heading.sizePt * PT * 0.62;
  const subY = tb
    ? tb.y + titleZoneH + (tb.h - titleZoneH) / 2
    : (theme.ornaments.titleBanner ? headerTop + bannerH : headerTop + titleSize * 1.3) + subSize * 1.5;
  // No "Thủy tổ: …" line under the title any more (D73): the tree starts with the founder.
  const headerEnd = board ? headerTop + bannerH : subText ? subY + subSize * 0.4 : titleY + titleSize * 0.5;
  const branchY = headerEnd + subSize * 1.6;
  const headerBottom = (branchLine ? branchY : headerEnd) + 8;

  // ---- Couplets (vertical, word by word) ----
  // Either on boards the app draws beside the tree, or written into boards painted in
  // the theme's picture (`coupletBoxes`, D74).
  const painted = theme.coupletBoxes;
  const coupletLeft = s.coupletLeft || (painted ? painted.defaultText?.left : undefined);
  const coupletRight = s.coupletRight || (painted ? painted.defaultText?.right : undefined);
  const showCouplets = Boolean(o.showCouplets && theme.ornaments.showCouplets && (coupletLeft || coupletRight));
  const coupletW = showCouplets && !painted ? 30 : 0;
  const drawnBox = (x: number) => ({ x, y: box.y + 6, w: coupletW, h: box.h - 18 });
  const coupletColumn = (text: string, b: { x: number; y: number; w: number; h: number }, drawBoard: boolean) => {
    const words = text.split(/\s+/).filter(Boolean);
    // Fit the widest word (measured) inside the board, and all words inside its height.
    const pad = drawBoard ? 7 : 2;
    const widest = Math.max(0.5, ...words.map((w) => letterWidths(w, t.couplet).reduce((a, x) => a + x, 0)));
    const size = Math.min(t.couplet.sizePt * PT, (b.h - 16) / (Math.max(words.length, 1) * 1.28), (b.w - pad) / widest);
    const startY = b.y + (b.h - words.length * size * 1.28) / 2 + size;
    return (
      <g>
        {drawBoard && c.coupletBoard && c.coupletBoard !== 'transparent' && (
          <>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={c.coupletBoard} />
            <rect x={b.x + 2} y={b.y + 2} width={b.w - 4} height={b.h - 4} rx={1.5} fill="none" stroke={c.frameInner ?? c.frame} strokeWidth={0.5} />
          </>
        )}
        {words.map((word, i) => (
          <text
            key={i}
            x={b.x + b.w / 2}
            y={startY + i * size * 1.28}
            textAnchor="middle"
            fontFamily={t.couplet.family}
            fontWeight={t.couplet.weight}
            fontStyle={t.couplet.italic ? 'italic' : undefined}
            fontSize={size}
            fill={c.coupletText ?? c.textPrimary}
          >
            {word}
          </text>
        ))}
      </g>
    );
  };

  // ---- Tree area ----
  const genW = o.showGenerations ? 16 : 0;
  const colophonH = o.showColophon && s.colophon ? 14 : 0;
  const area = {
    x: box.x + (showCouplets ? coupletW + 10 : 0) + genW,
    y: headerBottom,
    w: box.w - (showCouplets ? 2 * (coupletW + 10) : 0) - genW,
    h: box.y + box.h - headerBottom - colophonH - 4,
  };
  // A wide tree is limited by the paper width and would leave the sheet half empty.
  // Rather than spreading the generations apart (long connector lines), open up the
  // line spacing inside the cards until the tree fills the height (D73). The tree's
  // height grows linearly with the line spacing, so two trial layouts find it.
  const fitted = useMemo(() => {
    if (typeof layout !== 'function') return layout;
    const at = (lineScale: number, vgap = PRINT_SPACING.vgap!) => layout({ ...PRINT_SPACING, vgap, lineScale });
    const size = (l: TreeLayout) => ({ w: Math.max(1, l.bounds.maxX - l.bounds.minX), h: Math.max(1, l.bounds.maxY - l.bounds.minY + 30) });
    const one = at(1);
    const s1 = size(one);
    const widthScale = Math.min(area.w / s1.w, 0.36);
    const room = (area.h * 0.97) / widthScale;
    if (s1.h >= room) return one;
    // 1. Open up the cards' line spacing (the tree's height grows linearly with it).
    const slope = size(at(2)).h - s1.h;
    const k = slope > 0 ? Math.min(MAX_LINE_SCALE, 1 + (room - s1.h) / slope) : 1;
    const lineScale = k > 1.05 ? Math.floor(k * 20) / 20 : 1;
    const filled = at(lineScale);
    const left = room - size(filled).h;
    const gaps = filled.rows.length - 1;
    if (left <= 0 || gaps < 1) return filled;
    // 2. Still room: a little more space between generations, never as long as on screen.
    const vgap = Math.min(MAX_PRINT_VGAP, PRINT_SPACING.vgap! + Math.floor(left / gaps));
    return vgap > PRINT_SPACING.vgap! ? at(lineScale, vgap) : filled;
  }, [layout, area.w, area.h]);
  const lineScale = fitted.metrics?.lineScale ?? 1;
  const textScale = Math.min(MAX_TEXT_SCALE, lineScale);
  const vgap = fitted.metrics?.vgap ?? 76;
  const b = fitted.bounds;
  const lw = Math.max(1, b.maxX - b.minX);
  const lh = Math.max(1, b.maxY - b.minY + 30);
  const scale = Math.min(area.w / lw, area.h / lh, 0.36);
  const treeH = lh;
  const ox = area.x + (area.w - lw * scale) / 2 - b.minX * scale;
  const oy = area.y + (area.h - treeH * scale) / 2 + 6 * scale;
  const u = (mm: number) => mm / scale; // mm → tree units

  const nameColor = (male: boolean, blood: boolean) => (!blood ? c.spouse : male ? c.male : c.female);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Bản in ${titleText}, giao diện ${theme.name}`}
    >
      <defs>
        {theme.backgroundTexture && (
          <pattern id={`${uid}-tex`} width={30} height={30} patternUnits="userSpaceOnUse">
            <Ornament svg={theme.backgroundTexture} x={0} y={0} width={30} height={30} />
          </pattern>
        )}
        {theme.frame.borderSvg && (
          <pattern id={`${uid}-border`} width={T} height={T} patternUnits="userSpaceOnUse" x={SAFE} y={SAFE}>
            <Ornament svg={theme.frame.borderSvg} x={0} y={0} width={T} height={T} />
          </pattern>
        )}
      </defs>

      {/* Sheet and paper */}
      <rect width={W} height={H} fill={c.background} />
      {theme.backgroundImage && (
        <image
          href={theme.backgroundImage.href}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio={
            theme.backgroundImage.fit === 'stretch' ? 'none' : theme.backgroundImage.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
          }
        />
      )}
      {theme.backgroundTexture && <rect width={W} height={H} fill={`url(#${uid}-tex)`} />}
      {theme.ornaments.decorations
        ?.filter((d) => d.position === 'background')
        .map((d, i) => (
          <Ornament key={`bg${i}`} svg={d.svg} x={SAFE + T} y={H - SAFE - T - (W - 2 * (SAFE + T)) * 0.28} width={W - 2 * (SAFE + T)} opacity={d.opacity} />
        ))}

      {/* Frame */}
      {theme.frame.enabled &&
        (theme.frame.borderSvg ? (
          <path
            d={`M${SAFE},${SAFE}h${W - 2 * SAFE}v${H - 2 * SAFE}h${-(W - 2 * SAFE)}Z M${SAFE + T},${SAFE + T}v${H - 2 * (SAFE + T)}h${W - 2 * (SAFE + T)}v${-(H - 2 * (SAFE + T))}Z`}
            fill={`url(#${uid}-border)`}
            fillRule="evenodd"
          />
        ) : (
          <>
            <rect x={SAFE} y={SAFE} width={W - 2 * SAFE} height={H - 2 * SAFE} fill="none" stroke={c.frame} strokeWidth={1.4} />
            <rect x={SAFE + T * 0.6} y={SAFE + T * 0.6} width={W - 2 * (SAFE + T * 0.6)} height={H - 2 * (SAFE + T * 0.6)} fill="none" stroke={c.frame} strokeWidth={0.5} />
          </>
        ))}
      {theme.frame.enabled && theme.frame.cornerSvg && (
        <>
          <Ornament svg={theme.frame.cornerSvg} x={SAFE} y={SAFE} width={T} height={T} />
          <Ornament svg={theme.frame.cornerSvg} x={W - SAFE - T} y={SAFE} width={T} height={T} />
          <Ornament svg={theme.frame.cornerSvg} x={SAFE} y={H - SAFE - T} width={T} height={T} />
          <Ornament svg={theme.frame.cornerSvg} x={W - SAFE - T} y={H - SAFE - T} width={T} height={T} />
        </>
      )}
      {theme.frame.enabled && c.frameInner && theme.frame.borderSvg && (
        <rect x={SAFE + T + 2} y={SAFE + T + 2} width={W - 2 * (SAFE + T + 2)} height={H - 2 * (SAFE + T + 2)} fill="none" stroke={c.frameInner} strokeWidth={0.6} />
      )}

      {/* Corner decorations */}
      {theme.ornaments.decorations
        ?.filter((d) => d.position !== 'background')
        .map((d, i) => {
          const dw = d.widthMm ?? 90;
          const { w: vw, h: vh } = parseSvg(d.svg);
          const dh = (dw * vh) / vw;
          const yTop = SAFE + T + 3;
          switch (d.position) {
            case 'top-left':
              return <Ornament key={i} svg={d.svg} x={SAFE + T + 3} y={yTop} width={dw} opacity={d.opacity} />;
            case 'top-right':
              return <Ornament key={i} svg={d.svg} x={W - SAFE - T - 3 - dw} y={yTop} width={dw} flip opacity={d.opacity} />;
            case 'bottom':
              return <Ornament key={i} svg={d.svg} x={(W - dw) / 2} y={H - SAFE - T - 3 - dh} width={dw} opacity={d.opacity ?? 0.9} />;
            case 'bottom-left':
              return <Ornament key={i} svg={d.svg} x={SAFE + T + 3} y={H - SAFE - T - 3 - dh} width={dw} opacity={d.opacity} />;
            case 'bottom-right':
              return <Ornament key={i} svg={d.svg} x={W - SAFE - T - 3 - dw} y={H - SAFE - T - 3 - dh} width={dw} opacity={d.opacity} />;
            default:
              return null;
          }
        })}

      {/* Title */}
      {theme.ornaments.titleBanner && (
        <Ornament svg={theme.ornaments.titleBanner} x={(W - bannerW) / 2} y={headerTop} width={bannerW} height={bannerH} />
      )}
      {board && <image href={board.href} x={bannerX} y={headerTop} width={bannerW} height={bannerH} preserveAspectRatio="none" />}
      {board?.arcRadius && tb ? (
        <ArcText
          text={titleText}
          cx={tb.x + tb.w / 2}
          y={titleY}
          radius={board.arcRadius * bannerW}
          size={titleSize}
          font={t.title}
          fill={c.bannerText ?? c.textPrimary}
        />
      ) : (
      <text
        x={tb ? tb.x + tb.w / 2 : W / 2}
        y={titleY}
        fontStyle={ital(t.title)}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={t.title.family}
        fontWeight={t.title.weight}
        fontSize={titleSize}
        letterSpacing={t.title.letterSpacing ? `${t.title.letterSpacing}em` : undefined}
        fill={theme.ornaments.titleBanner || board ? (c.bannerText ?? c.textPrimary) : c.textPrimary}
      >
        {titleText}
      </text>
      )}
      {theme.ornaments.seal && (
        <Seal x={W / 2 + Math.min(titleText.length * titleSize * 0.27, bannerW / 2) + 10} y={titleY - 13} size={26} color={theme.ornaments.seal.color} name={s.clanName} font={t.heading.family} />
      )}
      {subText && board?.arcRadius && tb && (
        // Same centre as the title's arc, so the two lines curve together.
        <ArcText
          text={subText}
          cx={tb.x + tb.w / 2}
          y={subY}
          radius={board.arcRadius * bannerW - (subY - titleY)}
          size={subSize}
          font={{ ...t.heading, weight: 400 }}
          fill={c.bannerText ?? c.textSecondary}
        />
      )}
      {subText && !board?.arcRadius && (
        <text
          x={tb ? tb.x + tb.w / 2 : W / 2}
          fontStyle={ital(t.heading)}
          y={subY}
          textAnchor="middle"
          dominantBaseline={tb ? 'central' : undefined}
          fontFamily={t.heading.family}
          fontWeight={400}
          fontSize={subSize}
          fill={tb ? (c.bannerText ?? c.textSecondary) : c.textSecondary}
        >
          {subText}
        </text>
      )}
      {branchLine && (
        <text x={W / 2} y={branchY} textAnchor="middle" fontFamily={t.heading.family} fontWeight={400} fontStyle="italic" fontSize={subSize} fill={c.textSecondary}>
          {branchLine}
        </text>
      )}

      {/* Couplets */}
      {showCouplets && coupletLeft && coupletColumn(coupletLeft, painted ? painted.left : drawnBox(box.x), !painted)}
      {showCouplets && coupletRight && coupletColumn(coupletRight, painted ? painted.right : drawnBox(box.x + box.w - coupletW), !painted)}

      {/* Generation bands and labels */}
      {fitted.rows.map((r, i) => {
        const y = oy + (r.top - vgap / 2) * scale;
        const h = (r.height + vgap) * scale;
        return (
          <g key={r.gen}>
            {i % 2 === 1 && <rect x={area.x - genW} y={y} width={area.w + genW} height={h} fill={c.generationBand} />}
            {o.showGenerations && (
              <text
                x={area.x - genW / 2}
                y={oy + (r.top + r.height / 2) * scale}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={t.heading.family}
                fontWeight={t.heading.weight}
                fontSize={Math.min(5, h * 0.35)}
                fill={c.accent}
              >
                Đời {r.gen}
              </text>
            )}
          </g>
        );
      })}

      {/* Tree */}
      <g transform={`translate(${ox} ${oy}) scale(${scale})`}>
        <g fill="none" stroke={theme.connector.color} strokeWidth={u(theme.connector.width)}>
          {fitted.families.map((f) => (
            <path key={f.parentId} d={f.d} />
          ))}
        </g>
        {fitted.nodes.map((n) => {
          const p = n.person;
          if (n.vertical) {
            // Lower generations: couple column, the person's name then each spouse's, top to bottom.
            const vm = verticalMetrics(p, o.showSpouses ? n.spouses : [], { years: o.showYears, lineScale });
            const vh = vm.height;
            const vr = u(theme.node.radius);
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <rect width={n.w} height={vh} rx={vr} fill={theme.node.fill} stroke={theme.colors.frame} strokeWidth={u(theme.node.borderWidth)} />
                {vm.sections.map((sec) => (
                  <line key={sec.spouseId} x1={2} x2={n.w - 2} y1={sec.top} y2={sec.top} stroke={theme.colors.frame} strokeWidth={u(theme.node.borderWidth) * 0.6} strokeDasharray="2 2" />
                ))}
                {vm.lines.map((l, i) => {
                  const big = l.kind === 'word' || l.kind === 'spouseWord';
                  const size = (l.kind === 'word' ? 14 : l.kind === 'spouseWord' ? 12.5 : 10) * textScale;
                  // Condense only a word measured wider than the card (never stretch a short one).
                  const maxW = n.w - 2 * V_PAD_X;
                  const spec = big ? t.name : t.body;
                  const squeeze = letterWidths(l.text, spec).reduce((a, w) => a + w, 0) * size > maxW;
                  const fill =
                    l.kind === 'word' ? nameColor(p.gender === 'male', p.isBloodline) : l.kind === 'spouseWord' ? c.spouse : c.textSecondary;
                  return (
                    <text
                      key={i}
                      x={n.w / 2}
                      y={l.y}
                      textAnchor="middle"
                      fontFamily={big ? t.name.family : t.body.family}
                      fontWeight={l.kind === 'word' ? t.name.weight : l.kind === 'spouseWord' ? 600 : undefined}
                      fontStyle={l.kind === 'role' || (big ? t.name.italic : t.body.italic) ? 'italic' : undefined}
                      fontSize={size}
                      fill={fill}
                      textLength={squeeze ? maxW : undefined}
                      lengthAdjust={squeeze ? 'spacingAndGlyphs' : undefined}
                    >
                      {l.text}
                    </text>
                  );
                })}
                {n.collapsed && n.hiddenCount > 0 && (
                  <text x={n.w / 2} y={vh + 14} textAnchor="middle" fontFamily={t.body.family} fontStyle="italic" fontSize={10} fill={c.accent}>
                    +{n.hiddenCount}
                  </text>
                )}
              </g>
            );
          }
          const years = o.showYears ? lifeSpan(p) : '';
          const other = o.showOtherNames && p.otherNames?.huy ? `Húy ${p.otherNames.huy}` : '';
          const spouses = o.showSpouses ? n.spouses : [];
          const lines = 1 + (years ? 1 : 0) + (other ? 1 : 0) + spouses.length;
          const h = Math.max(n.h, 26 + lines * 15);
          const r = u(theme.node.radius);
          const sw = u(theme.node.borderWidth);
          let y = n.caption ? 30 : 24;
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <rect width={n.w} height={h} rx={r} fill={theme.node.fill} stroke={theme.colors.frame} strokeWidth={sw} />
              {theme.node.borderStyle === 'double' && (
                <rect x={3} y={3} width={n.w - 6} height={h - 6} rx={Math.max(0, r - 3)} fill="none" stroke={theme.colors.frame} strokeWidth={sw * 0.6} />
              )}
              {n.caption && (
                <text x={n.w / 2} y={15} textAnchor="middle" fontFamily={t.body.family} fontSize={10} fill={c.textSecondary}>
                  {fit(n.caption, n.w - 16, 10)}
                </text>
              )}
              <text x={n.w / 2} y={y} textAnchor="middle" fontFamily={t.name.family} fontWeight={t.name.weight} fontStyle={ital(t.name)} fontSize={15} fill={nameColor(p.gender === 'male', p.isBloodline)}>
                {fit(p.fullName, n.w - 14, 15)}
              </text>
              {other && (
                <text x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.body.family} fontStyle="italic" fontSize={11} fill={c.textSecondary}>
                  {fit(other, n.w - 14, 11)}
                </text>
              )}
              {years && (
                <text x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.body.family} fontStyle={ital(t.body)} fontSize={11.5} fill={c.textSecondary}>
                  {years}
                </text>
              )}
              {spouses.map((sp) => (
                <text key={sp.person.id} x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.name.family} fontWeight={600} fontStyle={ital(t.name)} fontSize={12} fill={c.spouse}>
                  {fit(`${sp.role}: ${sp.person.fullName}`, n.w - 12, 12)}
                </text>
              ))}
              {n.collapsed && n.hiddenCount > 0 && (
                <text x={n.w / 2} y={h + 16} textAnchor="middle" fontFamily={t.body.family} fontStyle="italic" fontSize={11} fill={c.accent}>
                  +{n.hiddenCount} con cháu
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Colophon */}
      {o.showColophon && s.colophon && (
        <text x={box.x + box.w - (showCouplets ? coupletW + 10 : 0)} y={box.y + box.h - 3} textAnchor="end" fontFamily={t.body.family} fontStyle="italic" fontSize={t.body.sizePt * PT * 1.4} fill={c.textSecondary}>
          {s.colophon}
        </text>
      )}
    </svg>
  );
}

/** Con triện: a square red seal with the clan name cut in white, vertically. */
function Seal({ x, y, size, color, name, font }: { x: number; y: number; size: number; color: string; name: string; font: string }) {
  const letters = name.toUpperCase().split('');
  const fs = Math.min(size * 0.3, (size - 8) / Math.max(letters.length, 1) / 1.05);
  return (
    <g transform={`translate(${x} ${y}) rotate(-3 ${size / 2} ${size / 2})`}>
      <rect width={size} height={size} rx={1.5} fill={color} />
      <rect x={2} y={2} width={size - 4} height={size - 4} rx={1} fill="none" stroke="#fff6ee" strokeWidth={0.8} />
      {letters.map((ch, i) => (
        <text
          key={i}
          x={size / 2}
          y={size / 2 + (i - (letters.length - 1) / 2) * fs * 1.05}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={font}
          fontWeight={700}
          fontSize={fs}
          fill="#fff6ee"
        >
          {ch}
        </text>
      ))}
    </g>
  );
}
