import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AdminStatus } from '@/app/AdminStatus';
import { CloseIcon, CollapseIcon, ExpandIcon } from '@/app/ui/icons';
import { useOverlays } from '@/app/useOverlays';
import { useIsDesktop } from '@/app/useMediaQuery';
import type { ClanModel } from '@/lib/clanModel';
import type { TreeLayoutPref } from '@/store/prefsStore';
import { Avatar } from '../person/Avatar';
import { allOpenIds, ancestorIds, buildOutline, defaultOpenIds, outlineStats, rowIdFor, type OutlineFilters, type OutlineRow } from './outline';
import { GenRangeSlider } from './GenRangeSlider';
import { LayoutToggle } from './LayoutToggle';
import type { TreeParams } from './useTreeParams';
import styles from './Outline.module.css';

const OPEN_KEY = 'giapha.outlineOpen.v1';

function readOpen(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(ids) ? new Set(ids.filter((x): x is string => typeof x === 'string')) : null;
  } catch {
    return null;
  }
}

function writeOpen(open: ReadonlySet<string>): void {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
  } catch {
    // Storage unavailable: the open branches only last for this visit.
  }
}

/**
 * "Cây dọc" (DECISIONS D54): "Sơ đồ" as an indented tree that scrolls up and down.
 * Same URL as the chart (see useTreeParams) so links, search and filters work in both.
 */
export function OutlineView({ model, tp, onLayout }: { model: ClanModel; tp: TreeParams; onLayout(next: TreeLayoutPref): void }) {
  const { branch, fromGen, toGen, showSpouses, showMaternal, lineageId, focusId, selectedId, setParam, setShowMaternal } = tp;
  const { open: openOverlay } = useOverlays();
  const desktop = useIsDesktop();
  const [flashId, setFlashId] = useState<string | null>(null);

  const filters: OutlineFilters = useMemo(
    () => ({ branch, fromGen, toGen, showSpouses, showMaternal }),
    [branch, fromGen, toGen, showSpouses, showMaternal],
  );
  const [open, setOpen] = useState<Set<string>>(() => readOpen() ?? defaultOpenIds(model, filters));
  // The people the outline starts from stay open when the filters change.
  useEffect(() => {
    setOpen((prev) => {
      const starts = defaultOpenIds(model, filters);
      if ([...starts].every((id) => prev.has(id))) return prev;
      return new Set([...prev, ...starts]);
    });
  }, [model, filters]);
  useEffect(() => writeOpen(open), [open]);

  const rows = useMemo(() => buildOutline(model, filters, open), [model, filters, open]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const stats = useMemo(() => outlineStats(model, filters), [model, filters]);

  const pathIds = useMemo(() => {
    if (!lineageId || !model.get(lineageId)) return null;
    return new Set(model.lineage(lineageId).map((p) => p.id));
  }, [lineageId, model]);
  // "Xem dòng dõi" opens the whole line so it can be followed.
  useEffect(() => {
    if (!lineageId) return;
    const id = rowIdFor(model, lineageId);
    if (!id) return;
    setOpen((prev) => {
      const need = ancestorIds(model, id);
      return need.every((a) => prev.has(a)) ? prev : new Set([...prev, ...need]);
    });
  }, [lineageId, model]);

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const listRef = useRef<HTMLOListElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const rowEl = (id: string) => listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`) ?? null;

  /** Scrolls a row to just under the sticky header. */
  const scrollToRow = useCallback((id: string, behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
    if (!el) return;
    const headH = headRef.current?.getBoundingClientRect().height ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  // Go to a person (from search or "Trên sơ đồ"): open their line, lift filters that hide them.
  const attempts = useRef(0);
  useEffect(() => {
    if (!focusId) {
      attempts.current = 0;
      return;
    }
    const id = rowIdFor(model, focusId);
    if (!id) {
      setParam({ f: null });
      return;
    }
    if (byId.has(id)) {
      // After the rows have rendered.
      requestAnimationFrame(() => {
        const el = rowEl(id);
        if (el) {
          const headH = headRef.current?.getBoundingClientRect().height ?? 0;
          const top = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight - headH) / 2;
          window.scrollTo({ top: Math.max(0, top) });
        }
      });
      setFlashId(id);
      setParam({ f: null });
      return;
    }
    attempts.current++;
    if (attempts.current > 3) {
      setParam({ f: null });
      return;
    }
    const need = ancestorIds(model, id);
    if (need.some((a) => !open.has(a))) {
      setOpen((prev) => new Set([...prev, ...need]));
      return;
    }
    if (model.isMaternal(id) && !showMaternal) setShowMaternal(true);
    setParam({ chi: null, tu: null, den: null });
  }, [focusId, byId, model, open, showMaternal, setShowMaternal, setParam]);

  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 2600);
    return () => window.clearTimeout(t);
  }, [flashId]);

  // The line of ancestors of the first row under the header ("Chín › Đình Quang").
  const [topRowId, setTopRowId] = useState<string | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const list = listRef.current;
      if (!list) return;
      const limit = (headRef.current?.getBoundingClientRect().bottom ?? 0) + 4;
      const items = list.querySelectorAll<HTMLElement>('[data-row]');
      // Binary search: rows are in document order.
      let lo = 0;
      let hi = items.length - 1;
      let found: HTMLElement | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const el = items[mid]!;
        if (el.getBoundingClientRect().bottom > limit) {
          found = el;
          hi = mid - 1;
        } else lo = mid + 1;
      }
      setTopRowId(found?.dataset.row ?? null);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rows]);
  const crumbs = useMemo(() => {
    const out: OutlineRow[] = [];
    let id = topRowId ? (byId.get(topRowId)?.parentId ?? null) : null;
    while (id) {
      const r = byId.get(id);
      if (!r) break;
      out.unshift(r);
      id = r.parentId;
    }
    return out;
  }, [topRowId, byId]);

  const everythingOpen = useMemo(() => {
    const all = allOpenIds(model, filters);
    return all.size > 0 && [...all].every((id) => open.has(id));
  }, [model, filters, open]);
  const lineagePerson = lineageId ? model.get(lineageId) : undefined;
  const selectedRow = selectedId ? rowIdFor(model, selectedId) : null;

  return (
    <div className={styles.view}>
      <div ref={headRef} className={styles.head}>
        {/* The bottom bar already says "Sơ đồ"; the heading is for screen readers. */}
        <h1 className="visually-hidden">
          Sơ đồ, {stats.people} người · {stats.generations} đời
        </h1>
        <div className={styles.filterRow}>
          <GenRangeSlider max={tp.maxGen} from={fromGen ?? 1} to={toGen ?? tp.maxGen} onChange={tp.setGenRange} />
          <LayoutToggle value="doc" onChange={onLayout} />
          <button
            type="button"
            className={styles.tool}
            onClick={() => setOpen(everythingOpen ? defaultOpenIds(model, filters) : allOpenIds(model, filters))}
            aria-label={everythingOpen ? 'Thu gọn' : 'Mở hết'}
          >
            {everythingOpen ? <CollapseIcon width={20} height={20} /> : <ExpandIcon width={20} height={20} />}
          </button>
        </div>
        {lineagePerson && (
          <div className={styles.chips}>
            {lineagePerson && (
              <div className={styles.chip} role="status">
                Dòng dõi: <strong>{lineagePerson.fullName}</strong>
                <button type="button" className={styles.chipClose} onClick={() => setParam({ dd: null })} aria-label="Bỏ tô sáng dòng dõi">
                  <CloseIcon width={18} height={18} />
                </button>
              </div>
            )}
          </div>
        )}
        <div className={styles.infoRow}>
        <nav className={styles.crumbs} aria-label="Đang xem nhánh">
          {crumbs.length === 0 ? (
            <span className={styles.crumbHint}>
              {stats.people} người · {stats.generations} đời
            </span>
          ) : (
            crumbs.map((c, i) => (
              <span key={c.id} className={styles.crumbItem}>
                {i > 0 && <span aria-hidden="true">›</span>}
                <button type="button" className={styles.crumb} onClick={() => scrollToRow(c.id)}>
                  {c.person.fullName}
                </button>
              </span>
            ))
          )}
        </nav>
        {!desktop && <AdminStatus variant="header" />}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>Không có ai trong các đời đã chọn.</p>
          <button type="button" className={styles.chipButton} onClick={() => tp.setGenRange(1, tp.maxGen)}>
            Hiện tất cả các đời
          </button>
        </div>
      ) : (
        <div className={styles.treeCard}>
          <div className={styles.cardHeader} aria-hidden="true">
            <span className={styles.diamond}>◆</span>
            <span className={styles.cardTitle}>Cây gia phả</span>
            <span className={styles.diamond}>◆</span>
          </div>
          <ol ref={listRef} className={styles.list} aria-label="Cây gia phả">
            {rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                mark={
                  r.id === flashId
                    ? 'flash'
                    : r.id === selectedRow
                      ? 'selected'
                      : pathIds?.has(r.id)
                        ? 'path'
                        : null
                }
                dim={pathIds !== null && !pathIds.has(r.id)}
                onToggle={toggle}
                onSelect={(id) => openOverlay('ct', id)}
              />
            ))}
          </ol>
        </div>
      )}

    </div>
  );
}

interface RowProps {
  row: OutlineRow;
  mark: 'flash' | 'selected' | 'path' | null;
  dim: boolean;
  onToggle(id: string): void;
  onSelect(id: string): void;
}

function Row({ row: r, mark, dim, onToggle, onSelect }: RowProps) {
  const p = r.person;
  const role = p.gender === 'female' ? 'female' : 'male';
  const meta: { key: string; text: string }[] = [
    // The vertical tree shows no years (D87): names and spouses only; years are in the profile.
    ...r.spouses.map((s) => ({ key: s.person.id, text: `${s.role}: ${s.person.fullName}` })),
  ];
  const isRoot = r.depth === 0;
  return (
    <li
      className={styles.row}
      data-row={r.id}
      data-root={isRoot || undefined}
      data-open={r.open && r.hasChildren ? 'true' : undefined}
      data-mark={mark ?? undefined}
      data-dim={dim || undefined}
      data-role={role}
      data-deceased={p.death?.isDeceased || undefined}
    >
      {r.guides.map((on, i) => (
        <span key={i} className={styles.guide} data-on={on || undefined} aria-hidden="true" />
      ))}
      {r.depth > 0 && <span className={styles.elbow} data-last={r.last || undefined} aria-hidden="true" />}
      {r.hasChildren ? (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={r.open}
          aria-label={`${r.open ? 'Thu nhánh' : 'Mở nhánh'} ${p.fullName}${
            !r.open && r.hiddenCount > 0 ? `, ${r.hiddenCount} người trong nhánh` : ''
          }`}
          onClick={() => onToggle(r.id)}
        >
          <span className={styles.chevron} aria-hidden="true" />
          {/* People in a closed branch: a small figure under the arrow, leaving the right side to the name. */}
          {!r.open && r.hiddenCount > 0 && (
            <span className={styles.count} aria-hidden="true">
              +{r.hiddenCount}
            </span>
          )}
        </button>
      ) : (
        <span className={styles.leaf} aria-hidden="true" />
      )}
      <button type="button" className={styles.person} onClick={() => onSelect(r.id)}>
        {p.photoUrl ? (
          <Avatar person={p} size={isRoot ? 56 : 38} ring={isRoot} />
        ) : (
          isRoot && (
            <span className={styles.rootSeal} aria-hidden="true">
              <span className={styles.rootSealLabel}>Đời</span>
              <span className={styles.rootSealNum}>{r.gen}</span>
            </span>
          )
        )}
        <span className={styles.personContent}>
          <span className={styles.line1}>
            {r.caption && <span className={styles.caption}>{r.caption}</span>}
            <span className={styles.name}>{p.fullName}</span>
          </span>
          {meta.length > 0 && (
            // Each spouse; each part wraps whole, the "·" only shows between two parts on one line.
            <span className={styles.line2}>
              {meta.map((m) => (
                <span key={m.key} className={styles.spouse}>
                  {m.text}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
