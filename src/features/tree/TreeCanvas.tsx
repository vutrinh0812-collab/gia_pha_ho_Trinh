import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { VGAP, type TreeLayout } from './layout';
import { lodFor, minScaleFor, type Lod } from './lod';
import { TreeNodeView, type NodeMark } from './TreeNodeView';
import styles from './Tree.module.css';

export interface TreeCanvasApi {
  zoomBy(factor: number): void;
  /** Moves the view by screen pixels. */
  panBy(dx: number, dy: number): void;
  fit(): void;
  goTo(id: string): void;
}

interface Props {
  layout: TreeLayout;
  coarse: boolean;
  /** Lineage being highlighted (others are dimmed). */
  pathIds: ReadonlySet<string> | null;
  flashId: string | null;
  selectedId: string | null;
  /** "x,y,k" from the URL, applied once on mount. */
  initialView: string | null;
  onViewChange(view: string): void;
  onSelect(id: string): void;
  onToggle(id: string): void;
  apiRef: Ref<TreeCanvasApi>;
}

interface Win {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lod: Lod;
}

const TOP_SPACE = 76;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function parseView(v: string | null): ZoomTransform | null {
  if (!v) return null;
  const [x, y, k] = v.split(',').map(Number);
  if (![x, y, k].every((n) => Number.isFinite(n)) || !k || k <= 0) return null;
  return zoomIdentity.translate(x!, y!).scale(k);
}

/**
 * SVG tree with pan / pinch-zoom (d3-zoom). The zoom transform is applied
 * straight to the DOM; React only re-renders when the level of detail changes
 * or the viewport leaves the rendered window (virtualization, SPEC 5.3).
 */
export function TreeCanvas(props: Props) {
  const { layout, coarse, pathIds, flashId, selectedId, initialView, onViewChange, onSelect, onToggle, apiRef } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const miniView = useRef<HTMLDivElement>(null);
  const miniCanvas = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = useRef<ZoomTransform>(zoomIdentity);
  const size = useRef({ w: 1024, h: 768 });
  const frame = useRef(0);
  const winRef = useRef<Win | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  // Minimap geometry for the current layout.
  const mini = useMemo(() => {
    const W = 120;
    const H = 84;
    const b = layout.bounds;
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxY - b.minY);
    const s = Math.min((W - 8) / bw, (H - 8) / bh);
    return { W, H, s, ox: (W - bw * s) / 2 - b.minX * s, oy: (H - bh * s) / 2 - b.minY * s };
  }, [layout.bounds]);
  const miniRef = useRef(mini);
  miniRef.current = mini;

  /** Imperative per-frame updates: rail labels, minimap viewport, virtualization window. */
  const update = useCallback(
    (force = false) => {
      const t = tRef.current;
      const { w, h } = size.current;
      // Generation rail.
      const rail = railRef.current;
      if (rail) {
        // Hide the rail when generations are too close on screen to label legibly.
        const rowGap = ((layoutRef.current.rows[0]?.height ?? 60) + VGAP) * t.k;
        rail.style.opacity = rowGap < 34 ? '0' : '1';
        for (const el of Array.from(rail.children) as HTMLElement[]) {
          const top = Number(el.dataset.top);
          const rh = Number(el.dataset.h);
          const y = t.y + (top + rh / 2) * t.k;
          el.style.transform = `translateY(${y}px) translateY(-50%)`;
          el.style.visibility = y < -40 || y > h + 40 ? 'hidden' : 'visible';
        }
      }
      // Minimap viewport.
      const mv = miniView.current;
      if (mv) {
        const m = miniRef.current;
        const x0 = -t.x / t.k;
        const y0 = -t.y / t.k;
        mv.style.left = `${m.ox + x0 * m.s}px`;
        mv.style.top = `${m.oy + y0 * m.s}px`;
        mv.style.width = `${(w / t.k) * m.s}px`;
        mv.style.height = `${(h / t.k) * m.s}px`;
      }
      const svgEl = svgRef.current;
      if (svgEl) {
        svgEl.style.setProperty('--ik', String(1 / t.k));
        // Far-out names of the first generations only when nodes are wide enough not to collide.
        svgEl.dataset.farNames = t.k * 176 >= 70 ? 'on' : 'off';
      }

      // Virtualization window, with a buffer around the viewport.
      const lod = lodFor(t.k, coarse);
      const vx0 = -t.x / t.k;
      const vy0 = -t.y / t.k;
      const vw = w / t.k;
      const vh = h / t.k;
      const cur = winRef.current;
      const inside = cur && vx0 >= cur.x0 && vy0 >= cur.y0 && vx0 + vw <= cur.x1 && vy0 + vh <= cur.y1;
      if (force || !cur || cur.lod !== lod || !inside) {
        const buf = coarse ? 0.5 : 1;
        const next = { x0: vx0 - vw * buf, y0: vy0 - vh * buf, x1: vx0 + vw * (1 + buf), y1: vy0 + vh * (1 + buf), lod };
        winRef.current = next;
        setWin(next);
      }
    },
    [coarse],
  );

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      update();
    });
  }, [update]);

  // Set up zoom once.
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const measure = () => {
      const r = wrap.current?.getBoundingClientRect();
      size.current = { w: r && r.width > 0 ? r.width : 1024, h: r && r.height > 0 ? r.height : 768 };
    };
    measure();
    let persistTimer = 0;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.02, 4])
      // Explicit viewport (the default reads svg.width.baseVal, unreliable in some browsers).
      .extent(() => [
        [0, 0],
        [size.current.w, size.current.h],
      ])
      .on('start', () => svg.setAttribute('data-moving', 'true'))
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        tRef.current = e.transform;
        gRef.current?.setAttribute('transform', e.transform.toString());
        schedule();
      })
      .on('end', () => {
        svg.removeAttribute('data-moving');
        window.clearTimeout(persistTimer);
        persistTimer = window.setTimeout(() => {
          const t = tRef.current;
          onViewChangeRef.current(`${Math.round(t.x)},${Math.round(t.y)},${t.k.toFixed(3)}`);
        }, 400);
      });
    zoomRef.current = z;
    const sel = select(svg);
    sel.call(z);

    // Initial view: from the URL, else the root ancestor at a readable size.
    const fromUrl = parseView(initialView);
    if (fromUrl) {
      sel.call(z.transform, fromUrl);
    } else {
      const first = layoutRef.current.nodes[0];
      const k = Math.max(minScaleFor(2, coarse), 1);
      const cx = first ? first.x + first.w / 2 : 0;
      const cy = first ? first.y : 0;
      sel.call(z.transform, zoomIdentity.translate(size.current.w / 2 - cx * k, TOP_SPACE - cy * k + 8).scale(k));
    }

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      measure();
      update(true);
    }) : null;
    if (ro && wrap.current) ro.observe(wrap.current);
    update(true);
    return () => {
      ro?.disconnect();
      sel.on('.zoom', null);
      window.clearTimeout(persistTimer);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layout changed (filters / collapse): nodes move, so keep the node nearest the
  // screen centre at the same screen position, then re-evaluate what is visible.
  const prevLayout = useRef(layout);
  useLayoutEffect(() => {
    const prev = prevLayout.current;
    prevLayout.current = layout;
    if (prev === layout) return;
    const t = tRef.current;
    const { w, h } = size.current;
    const cx = (w / 2 - t.x) / t.k;
    const cy = (h / 2 - t.y) / t.k;
    let anchor: { dx: number; dy: number; dist: number } | null = null;
    for (const n of prev.nodes) {
      const moved = layout.byId.get(n.id);
      if (!moved) continue;
      const dist = Math.hypot(n.x + n.w / 2 - cx, n.y + n.h / 2 - cy);
      if (!anchor || dist < anchor.dist) anchor = { dx: moved.x - n.x, dy: moved.y - n.y, dist };
    }
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (anchor && svg && z && (anchor.dx || anchor.dy)) {
      select(svg).call(z.translateBy, -anchor.dx, -anchor.dy);
    }
    update(true);
  }, [layout, update]);

  // Draw the minimap.
  useEffect(() => {
    const canvas = miniCanvas.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = mini.W * dpr;
    canvas.height = mini.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(canvas);
    const colors = { male: css.getPropertyValue('--mm-male'), female: css.getPropertyValue('--mm-female') };
    ctx.clearRect(0, 0, mini.W, mini.H);
    for (const n of layout.nodes) {
      ctx.fillStyle = (n.person.gender === 'male' ? colors.male : colors.female) || '#888';
      ctx.fillRect(mini.ox + n.x * mini.s, mini.oy + n.y * mini.s, Math.max(1, n.w * mini.s), Math.max(1, n.h * mini.s));
    }
  }, [layout, mini]);

  const transitionTo = useCallback((t: ZoomTransform) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const sel = select(svg);
    if (prefersReducedMotion()) sel.call(z.transform, t);
    else sel.transition().duration(550).call(z.transform, t);
  }, []);

  useImperativeHandle(
    apiRef,
    () => ({
      zoomBy(factor) {
        const svg = svgRef.current;
        const z = zoomRef.current;
        if (svg && z) select(svg).transition().duration(prefersReducedMotion() ? 0 : 200).call(z.scaleBy, factor);
      },
      panBy(dx, dy) {
        const svg = svgRef.current;
        const z = zoomRef.current;
        if (!svg || !z) return;
        const k = tRef.current.k;
        select(svg).transition().duration(prefersReducedMotion() ? 0 : 150).call(z.translateBy, dx / k, dy / k);
      },
      fit() {
        const b = layoutRef.current.bounds;
        const { w, h } = size.current;
        const bw = Math.max(1, b.maxX - b.minX);
        const bh = Math.max(1, b.maxY - b.minY);
        const availW = w - 48 - 16;
        const availH = h - TOP_SPACE - 24;
        const k = Math.min(1.2, Math.max(0.02, Math.min(availW / bw, availH / bh)));
        // Centre the whole tree in the free area (right of the rail, below the top bar).
        const x = 48 + (availW - bw * k) / 2 - b.minX * k;
        const y = TOP_SPACE + (availH - bh * k) / 2 - b.minY * k;
        transitionTo(zoomIdentity.translate(x, y).scale(k));
      },
      goTo(id) {
        const n = layoutRef.current.byId.get(id);
        if (!n) return;
        const { w, h } = size.current;
        const k = Math.min(1.6, Math.max(tRef.current.k, minScaleFor(2, coarse) * 1.1));
        const cx = n.x + n.w / 2;
        const cy = n.y + n.h / 2;
        transitionTo(zoomIdentity.translate(w / 2 - cx * k, h / 2 - cy * k).scale(k));
      },
    }),
    [coarse, transitionTo],
  );

  // Minimap: tap or drag to move the view.
  const miniPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const m = miniRef.current;
    const x = (e.clientX - rect.left - m.ox) / m.s;
    const y = (e.clientY - rect.top - m.oy) / m.s;
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).call(z.translateTo, x, y);
  };

  const visible = useMemo(() => {
    if (!win) return { nodes: [], families: [], lod: 2 as Lod };
    const nodes = layout.nodes.filter((n) => n.x + n.w >= win.x0 && n.x <= win.x1 && n.y + n.h + VGAP >= win.y0 && n.y <= win.y1);
    const families = layout.families.filter((f) => f.maxX >= win.x0 && f.minX <= win.x1 && f.maxY >= win.y0 && f.minY <= win.y1);
    return { nodes, families, lod: win.lod };
  }, [layout, win]);

  // Lineage connectors: parent → child segments along the highlighted path.
  const pathD = useMemo(() => {
    if (!pathIds) return '';
    let d = '';
    for (const id of pathIds) {
      const c = layout.byId.get(id);
      const p = c?.parentId ? layout.byId.get(c.parentId) : undefined;
      if (!c || !p || !pathIds.has(p.id)) continue;
      const px = p.x + p.w / 2;
      const cx = c.x + c.w / 2;
      const barY = c.y - 26;
      d += `M${px},${p.y + p.h}V${barY}H${cx}V${c.y}`;
    }
    return d;
  }, [layout, pathIds]);

  const b = layout.bounds;
  const lod = visible.lod;
  const markOf = (id: string): NodeMark =>
    id === flashId ? 'flash' : id === selectedId ? 'selected' : pathIds?.has(id) ? 'path' : 'none';
  // Raised (L3/L4 expanded) cards are drawn last so they overlay their neighbours' connectors.
  const ordered = lod >= 3 ? [...visible.nodes].sort((a, z) => a.y - z.y) : visible.nodes;

  return (
    <div ref={wrap} className={styles.canvas}>
      <svg ref={svgRef} className={styles.svg} data-lod={lod} aria-label="Sơ đồ gia phả" role="group">
        <g ref={gRef}>
          <g aria-hidden="true">
            {layout.rows.map((r, i) => (
              <rect
                key={r.gen}
                className={i % 2 ? styles.bandAlt : styles.band}
                x={b.minX - 5000}
                y={r.top - VGAP / 2}
                width={b.maxX - b.minX + 10000}
                height={r.height + VGAP}
              />
            ))}
          </g>
          <g className={styles.links} data-dimmed={pathIds ? true : undefined} aria-hidden="true">
            {visible.families.map((f) => (
              <path key={f.parentId} d={f.d} />
            ))}
          </g>
          {pathD && <path className={styles.pathLink} d={pathD} aria-hidden="true" />}
          <g>
            {ordered.map((n) => (
              <TreeNodeView
                key={n.id}
                node={n}
                lod={lod}
                dim={Boolean(pathIds && !pathIds.has(n.id))}
                mark={markOf(n.id)}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </g>
          {lod === 0 && (
            <g aria-hidden="true">
              {layout.branchLabels.map((l) => (
                <text key={l.label} className={styles.branchLabel} x={l.x} y={l.y}>
                  {l.label}
                </text>
              ))}
            </g>
          )}
        </g>
      </svg>

      <div ref={railRef} className={styles.rail} aria-hidden="true">
        {layout.rows.map((r) => (
          <div key={r.gen} className={styles.railLabel} data-top={r.top} data-h={r.height}>
            <span>Đời</span>
            <strong>{r.gen}</strong>
          </div>
        ))}
      </div>

      <div
        className={styles.minimap}
        style={{ width: mini.W, height: mini.H }}
        onPointerDown={miniPointer}
        onPointerMove={miniPointer}
        role="img"
        aria-label="Bản đồ thu nhỏ: chạm để di chuyển"
      >
        <canvas ref={miniCanvas} style={{ width: mini.W, height: mini.H }} />
        <div ref={miniView} className={styles.miniView} />
      </div>
    </div>
  );
}
