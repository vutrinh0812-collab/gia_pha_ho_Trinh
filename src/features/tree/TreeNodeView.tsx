import { memo, useLayoutEffect, useRef } from 'react';
import { formatDateInfo, lifeSpan, visibleNotes } from '@/lib/format';
import { VGAP, V_PAD_X, verticalMetrics, type TreeNode, type VerticalLineKind } from './layout';
import type { Lod } from './lod';
import styles from './Tree.module.css';

export type NodeMark = 'none' | 'path' | 'flash' | 'selected';

interface Props {
  node: TreeNode;
  lod: Lod;
  dim: boolean;
  mark: NodeMark;
  onSelect(id: string): void;
  onToggle(id: string): void;
}

const CHAR_W = 0.53;

/** Truncates to roughly fit `maxW` units at `size` font (no DOM measuring). */
function fit(text: string, maxW: number, size: number): string {
  const max = Math.floor(maxW / (size * CHAR_W));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

function extraLines(node: TreeNode, lod: Lod): string[] {
  if (lod < 3 || node.vertical) return [];
  const p = node.person;
  const lines: string[] = [];
  const o = p.otherNames;
  const names = [o?.huy && `Húy ${o.huy}`, o?.tu && `Tự ${o.tu}`, o?.hieu && `Hiệu ${o.hieu}`].filter(Boolean).join(' · ');
  if (names) lines.push(names);
  if (p.deathAnniversaryLunar) lines.push(`Giỗ ${p.deathAnniversaryLunar.day}/${p.deathAnniversaryLunar.month} âm lịch`);
  if (lod >= 4) {
    if (p.birth?.place) lines.push(`Sinh tại ${p.birth.place}`);
    const birth = formatDateInfo(p.birth);
    if (birth && p.birth?.solar && p.birth.solar.length > 4) lines.push(`Sinh ${birth}`);
    if (p.burialPlace) lines.push(`An táng: ${p.burialPlace}`);
    if (p.occupation) lines.push(`Nghề: ${p.occupation}`);
    const notes = visibleNotes(p.notes);
    if (notes) lines.push(notes);
  }
  return lines;
}

const V_CLASS: Record<VerticalLineKind, string | undefined> = {
  caption: styles.vCaption,
  word: styles.vWord,
  year: styles.vYear,
  role: styles.vRole,
  spouseWord: styles.vSpouse,
};

/** Fonts load after the first paint; re-fit words once they have. */
const fontsReady: Promise<unknown> =
  typeof document !== 'undefined' && document.fonts?.ready ? document.fonts.ready : Promise.resolve();

/**
 * A centred word that never crosses the card's frame: measured in the browser, and if
 * wider than `maxW` (a long syllable such as "Nguyễn", or "Chữ lớn"), condensed to fit.
 */
function FitText({ className, x, y, maxW, children }: { className?: string; x: number; y: number; maxW: number; children: string }) {
  const ref = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    let alive = true;
    const fitNow = () => {
      const el = ref.current;
      if (!alive || !el || typeof el.getComputedTextLength !== 'function') return;
      el.removeAttribute('textLength');
      el.removeAttribute('lengthAdjust');
      if (el.getComputedTextLength() > maxW) {
        el.setAttribute('textLength', String(maxW));
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    };
    fitNow();
    void fontsReady.then(fitNow);
    return () => {
      alive = false;
    };
  }, [children, maxW]);
  return (
    <text ref={ref} className={className} x={x} y={y}>
      {children}
    </text>
  );
}

/** Bottom part of a card from `top` down, with the card's rounded corners. */
function sectionPath(w: number, top: number, h: number, r: number): string {
  return `M0,${top}H${w}V${h - r}Q${w},${h} ${w - r},${h}H${r}Q0,${h} 0,${h - r}Z`;
}

/**
 * Couple column: birth order, the name one word per line, the years; below a divider,
 * on a tinted section, each spouse's role and name the same way.
 */
function VerticalContent({ node, lod }: { node: TreeNode; lod: Lod }) {
  const m = verticalMetrics(node.person, node.spouses);
  const cx = node.w / 2;
  const showSmall = lod >= 2;
  return (
    <>
      {m.sections.map((s) => (
        <g key={s.spouseId}>
          <path className={styles.vSection} d={sectionPath(node.w, s.top, node.h, 8)} />
          <path className={styles.vDivider} d={`M0,${s.top}H${node.w}`} />
        </g>
      ))}
      {m.sections.length > 0 && (
        // Redraw the card edge over the tinted section (marks and focus still style `.box`).
        <rect className={styles.box} style={{ fill: 'none' }} width={node.w} height={node.h} rx={8} />
      )}
      {m.lines.map((l, i) =>
        (l.kind === 'caption' || l.kind === 'year' || l.kind === 'role') && !showSmall ? null : (
          <FitText key={i} className={V_CLASS[l.kind]} x={cx} y={l.y} maxW={node.w - 2 * V_PAD_X}>
            {l.text}
          </FitText>
        ),
      )}
    </>
  );
}

/** One family box: bloodline person (+ spouses below), content by level of detail. */
export const TreeNodeView = memo(function TreeNodeView({ node, lod, dim, mark, onSelect, onToggle }: Props) {
  const p = node.person;
  const role = p.gender === 'male' ? 'male' : 'female';
  const deceased = p.death?.isDeceased === true;
  const years = lifeSpan(p) || (deceased ? 'đã mất' : '');
  const w = node.w;
  const textW = w - 22;

  const extraFont = lod >= 4 ? 8 : 10.5;
  const extraLine = lod >= 4 ? 10 : 13;
  const maxExtra = Math.floor((VGAP - 18) / extraLine);
  const extras = extraLines(node, lod).slice(0, maxExtra);
  const cardH = extras.length ? node.h + extras.length * extraLine + 6 : node.h;

  const label = `${p.fullName}, đời ${node.gen}${node.collapsed ? `, đang thu gọn ${node.hiddenCount} người` : ''}`;

  return (
    <g
      className={styles.node}
      data-role={role}
      data-deceased={deceased || undefined}
      data-dim={dim || undefined}
      data-mark={mark === 'none' ? undefined : mark}
      data-raised={extras.length > 0 || undefined}
      transform={`translate(${node.x},${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <rect className={styles.box} width={w} height={cardH} rx={8} />
      <g key={lod} className={styles.content}>
        {node.vertical ? (
          lod >= 1 && <VerticalContent node={node} lod={lod} />
        ) : lod === 0 ? (
          node.gen <= 2 && (
            <text className={styles.farName} x={w / 2} y={node.h / 2}>
              {p.fullName}
            </text>
          )
        ) : lod === 1 ? (
          <text className={styles.nameL1} x={w / 2} y={node.h / 2 + 6}>
            {fit(p.fullName, textW, 17)}
          </text>
        ) : (
          <>
            {node.caption && (
              <text className={styles.caption} x={12} y={17}>
                {fit(node.caption, textW, 12)}
              </text>
            )}
            <text className={styles.name} x={12} y={36}>
              {fit(p.fullName, textW, 14)}
            </text>
            {years && (
              <text className={styles.years} x={12} y={53}>
                {years}
              </text>
            )}
            {node.spouses.map((s, i) => (
              <text key={s.person.id} className={styles.spouse} x={12} y={53 + 15 * (i + 1)}>
                {fit(`${s.role}: ${s.person.fullName}`, textW, 13)}
              </text>
            ))}
            {extras.map((line, i) => (
              <text
                key={i}
                className={styles.extra}
                style={{ fontSize: extraFont }}
                x={12}
                y={node.h + 4 + extraLine * (i + 1) - 3}
              >
                {fit(line, textW, extraFont)}
              </text>
            ))}
          </>
        )}
      </g>
      {node.hasChildren && (lod >= 1 || node.collapsed) && (
        <g
          className={styles.toggle}
          transform={`translate(${w / 2},${cardH})`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggle(node.id);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={node.collapsed ? `Mở rộng nhánh (${node.hiddenCount} người)` : 'Thu gọn nhánh'}
          aria-expanded={!node.collapsed}
        >
          <circle className={styles.hit} r={22} />
          {node.collapsed ? (
            <>
              <rect
                className={styles.badge}
                x={-(14 + String(node.hiddenCount).length * 4)}
                y={-10}
                width={28 + String(node.hiddenCount).length * 8}
                height={20}
                rx={10}
              />
              <text className={styles.badgeText} y={4}>
                +{node.hiddenCount}
              </text>
            </>
          ) : (
            <>
              <circle className={styles.knob} r={9} />
              <path className={styles.knobMark} d="M-4,0H4" />
            </>
          )}
        </g>
      )}
    </g>
  );
});
