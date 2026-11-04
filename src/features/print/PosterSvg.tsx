/**
 * The printed sheet (SPEC §8) drawn as one SVG in millimetres: A1 landscape is
 * 841 × 594. Shared by the theme preview (/themes) and the print page (/print);
 * phase 6 adds auto-fit with vertical name boxes and the PDF/SVG/PNG export.
 */
import { useId } from 'react';
import type { ClanModel } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import type { Theme } from '@/themes/types';
import { VGAP, type TreeLayout } from '../tree/layout';

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
  showColophon: true,
  showGenerations: true,
};

interface Props {
  theme: Theme;
  model: ClanModel;
  layout: TreeLayout;
  options?: Partial<PosterOptions>;
  /** Shown under the title when the sheet is one branch ("Chi ông …"). */
  branchLine?: string | null;
  className?: string;
  title?: string;
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

export function PosterSvg({ theme, model, layout, options, branchLine, className, title }: Props) {
  const o = { ...DEFAULT_POSTER_OPTIONS, ...options };
  const uid = useId().replace(/:/g, '');
  const { w: W, h: H } = A1[o.orientation];
  const c = theme.colors;
  const t = theme.typography;
  const s = model.settings;
  const T = theme.frame.enabled ? theme.frame.thicknessMm : 0;

  // Content box inside the frame.
  const inset = SAFE + T + 8;
  const box = { x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset };

  // ---- Header: banner + title, subtitle, root ancestor ----
  const bannerW = Math.min(box.w * 0.52, 430);
  const bannerH = theme.ornaments.titleBanner ? (bannerW * 84) / 400 : 0;
  const titleText = title ?? s.title;
  const titleSize = Math.min(t.title.sizePt * PT, (bannerW * 0.78) / (titleText.length * 0.52), 30);
  const headerTop = box.y;
  const titleY = theme.ornaments.titleBanner ? headerTop + bannerH / 2 : headerTop + titleSize * 0.8;
  const subSize = t.heading.sizePt * PT * 0.62;
  const subY = (theme.ornaments.titleBanner ? headerTop + bannerH : headerTop + titleSize * 1.3) + subSize * 1.5;
  const root = model.get(model.rootId);
  const rootSize = t.heading.sizePt * PT;
  const rootY = subY + (s.subtitle ? subSize * 1.2 : 0) + rootSize * 1.4;
  const branchY = rootY + (branchLine ? subSize * 1.5 : 0);
  const headerBottom = branchY + 8;

  // ---- Couplets (vertical, word by word) ----
  const showCouplets = o.showCouplets && theme.ornaments.showCouplets && (s.coupletLeft || s.coupletRight);
  const coupletW = showCouplets ? 30 : 0;
  const coupletTop = box.y + 6;
  const coupletH = box.h - 18;
  const coupletColumn = (text: string, x: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    // Fit the longest word inside the board, and all words inside its height.
    const longest = Math.max(1, ...words.map((w) => w.length));
    const size = Math.min(t.couplet.sizePt * PT, (coupletH - 16) / (Math.max(words.length, 1) * 1.28), (coupletW - 7) / (longest * 0.6));
    const startY = coupletTop + (coupletH - words.length * size * 1.28) / 2 + size;
    return (
      <g>
        {c.coupletBoard && c.coupletBoard !== 'transparent' && (
          <>
            <rect x={x} y={coupletTop} width={coupletW} height={coupletH} rx={2} fill={c.coupletBoard} />
            <rect x={x + 2} y={coupletTop + 2} width={coupletW - 4} height={coupletH - 4} rx={1.5} fill="none" stroke={c.frameInner ?? c.frame} strokeWidth={0.5} />
          </>
        )}
        {words.map((word, i) => (
          <text
            key={i}
            x={x + coupletW / 2}
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
  const b = layout.bounds;
  const lw = Math.max(1, b.maxX - b.minX);
  const lh = Math.max(1, b.maxY - b.minY + 30);
  const scale = Math.min(area.w / lw, area.h / lh, 0.36);
  // A wide tree is limited by the paper width and leaves the page half empty:
  // spread the generations apart (nodes keep their size) to fill the height.
  const gaps = Math.max(1, layout.rows.length - 1);
  const stretch = Math.max(0, Math.min(4 * VGAP, ((area.h * 0.96) / scale - lh) / gaps));
  const mapY = rowStretch(layout.rows, stretch);
  const treeH = lh + stretch * (layout.rows.length - 1);
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
      <text
        x={W / 2}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={t.title.family}
        fontWeight={t.title.weight}
        fontSize={titleSize}
        letterSpacing={t.title.letterSpacing ? `${t.title.letterSpacing}em` : undefined}
        fill={theme.ornaments.titleBanner ? (c.bannerText ?? c.textPrimary) : c.textPrimary}
      >
        {titleText}
      </text>
      {theme.ornaments.seal && (
        <Seal x={W / 2 + Math.min(titleText.length * titleSize * 0.27, bannerW / 2) + 10} y={titleY - 13} size={26} color={theme.ornaments.seal.color} name={s.clanName} font={t.heading.family} />
      )}
      {s.subtitle && (
        <text x={W / 2} y={subY} textAnchor="middle" fontFamily={t.heading.family} fontWeight={400} fontSize={subSize} fill={c.textSecondary}>
          {s.subtitle}
        </text>
      )}
      {root && (
        <text x={W / 2} y={rootY} textAnchor="middle" fontFamily={t.heading.family} fontWeight={t.heading.weight} fontSize={rootSize} fill={c.accent}>
          {model.founders.length > 1
            ? `Gồm ${model.founders.length} gia đình ở đời 1`
            : `Thủy tổ: ${root.fullName}${lifeSpan(root) ? ` (${lifeSpan(root)})` : ''}`}
        </text>
      )}
      {branchLine && (
        <text x={W / 2} y={branchY} textAnchor="middle" fontFamily={t.heading.family} fontWeight={400} fontStyle="italic" fontSize={subSize} fill={c.textSecondary}>
          {branchLine}
        </text>
      )}

      {/* Couplets */}
      {showCouplets && s.coupletLeft && coupletColumn(s.coupletLeft, box.x)}
      {showCouplets && s.coupletRight && coupletColumn(s.coupletRight, box.x + box.w - coupletW)}

      {/* Generation bands and labels */}
      {layout.rows.map((r, i) => {
        const y = oy + (mapY(r.top) - (VGAP + stretch) / 2) * scale;
        const h = (r.height + VGAP + stretch) * scale;
        return (
          <g key={r.gen}>
            {i % 2 === 1 && <rect x={area.x - genW} y={y} width={area.w + genW} height={h} fill={c.generationBand} />}
            {o.showGenerations && (
              <text
                x={area.x - genW / 2}
                y={oy + (mapY(r.top) + r.height / 2) * scale}
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
          {layout.families.map((f) => (
            <path key={f.parentId} d={stretch ? stretchPath(f.d, mapY) : f.d} />
          ))}
        </g>
        {layout.nodes.map((n) => {
          const p = n.person;
          const years = o.showYears ? lifeSpan(p) : '';
          const other = o.showOtherNames && p.otherNames?.huy ? `Húy ${p.otherNames.huy}` : '';
          const spouses = o.showSpouses ? n.spouses : [];
          const lines = 1 + (years ? 1 : 0) + (other ? 1 : 0) + spouses.length;
          const h = Math.max(n.h, 26 + lines * 15);
          const r = u(theme.node.radius);
          const sw = u(theme.node.borderWidth);
          let y = n.caption ? 30 : 24;
          return (
            <g key={n.id} transform={`translate(${n.x} ${mapY(n.y)})`}>
              <rect width={n.w} height={h} rx={r} fill={theme.node.fill} stroke={theme.colors.frame} strokeWidth={sw} />
              {theme.node.borderStyle === 'double' && (
                <rect x={3} y={3} width={n.w - 6} height={h - 6} rx={Math.max(0, r - 3)} fill="none" stroke={theme.colors.frame} strokeWidth={sw * 0.6} />
              )}
              {n.caption && (
                <text x={n.w / 2} y={15} textAnchor="middle" fontFamily={t.body.family} fontSize={10} fill={c.textSecondary}>
                  {fit(n.caption, n.w - 16, 10)}
                </text>
              )}
              <text x={n.w / 2} y={y} textAnchor="middle" fontFamily={t.name.family} fontWeight={t.name.weight} fontSize={15} fill={nameColor(p.gender === 'male', p.isBloodline)}>
                {fit(p.fullName, n.w - 14, 15)}
              </text>
              {other && (
                <text x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.body.family} fontStyle="italic" fontSize={11} fill={c.textSecondary}>
                  {fit(other, n.w - 14, 11)}
                </text>
              )}
              {years && (
                <text x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.body.family} fontSize={11.5} fill={c.textSecondary}>
                  {years}
                </text>
              )}
              {spouses.map((sp) => (
                <text key={sp.person.id} x={n.w / 2} y={(y += 15)} textAnchor="middle" fontFamily={t.name.family} fontWeight={600} fontSize={12} fill={c.spouse}>
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

/**
 * Monotone map of tree y-coordinates that adds `extra` units between consecutive
 * generation rows: points inside row i move down by extra·i, points in the gap
 * below it are interpolated towards row i+1.
 */
export function rowStretch(rows: ReadonlyArray<{ top: number; height: number }>, extra: number): (y: number) => number {
  if (!extra || rows.length < 2) return (y) => y;
  const sorted = [...rows].sort((a, b) => a.top - b.top);
  return (y) => {
    let i = -1;
    while (i + 1 < sorted.length && sorted[i + 1]!.top <= y) i++;
    if (i < 0) return y;
    const row = sorted[i]!;
    const bottom = row.top + row.height;
    const next = sorted[i + 1];
    if (y <= bottom || !next) return y + extra * i;
    return y + extra * i + (extra * (y - bottom)) / Math.max(1e-6, next.top - bottom);
  };
}

/** Applies `mapY` to the y-values of an "M x,y / V y / H x" connector path. */
export function stretchPath(d: string, mapY: (y: number) => number): string {
  return d.replace(/M(-?[\d.]+),(-?[\d.]+)|V(-?[\d.]+)/g, (_m, x: string, y: string, v: string) =>
    v !== undefined ? `V${mapY(Number(v))}` : `M${x},${mapY(Number(y))}`,
  );
}
