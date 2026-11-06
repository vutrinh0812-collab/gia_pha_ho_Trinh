import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminStatus } from '@/app/AdminStatus';
import { isInDialog, useHotkeys } from '@/app/useHotkeys';
import { useOverlays } from '@/app/useOverlays';
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  FitIcon,
  HomeIcon,
  MinusIcon,
  PlusIcon,
} from '@/app/ui/icons';
import { useIsDesktop } from '@/app/useMediaQuery';
import type { ClanModel } from '@/lib/clanModel';
import { useClanStore } from '@/store/clanStore';
import { useCanEdit } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { usePrefsStore, type TreeLayoutPref } from '@/store/prefsStore';
import { collapseAllIds, computeTreeLayout, type TreeFilters } from './layout';
import { TreeCanvas, type TreeCanvasApi } from './TreeCanvas';
import { OutlineView } from './OutlineView';
import { GenRangeSlider } from './GenRangeSlider';
import { LayoutToggle } from './LayoutToggle';
import { useTreeParams, type TreeParams } from './useTreeParams';
import styles from './Tree.module.css';

const HINT_KEY = 'giapha.rotateHint.v1';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * "Sơ đồ" (SPEC 5 and 5A.1 mode 2) in one of two layouts (DECISIONS D54):
 * "Cây dọc", an indented tree that scrolls up and down (phones), or the chart
 * (wide screens). `xem=doc|ngang` in the URL picks one; else the last choice on
 * this device; else by screen size.
 */
export default function TreeView() {
  const model = useClanStore((s) => s.model)!;
  const tp = useTreeParams(model);
  const desktop = useIsDesktop();
  const pref = usePrefsStore((s) => s.treeLayout);
  const setTreeLayout = usePrefsStore((s) => s.setTreeLayout);
  const fromUrl = tp.params.get('xem');
  const layout: TreeLayoutPref = fromUrl === 'doc' || fromUrl === 'ngang' ? fromUrl : (pref ?? (desktop ? 'ngang' : 'doc'));
  const switchTo = (next: TreeLayoutPref) => {
    setTreeLayout(next);
    tp.setParam({ xem: null, v: null });
  };
  return layout === 'doc' ? (
    <OutlineView model={model} tp={tp} onLayout={switchTo} />
  ) : (
    <ChartView model={model} tp={tp} onLayout={switchTo} />
  );
}

/**
 * The chart: generations in rows, pan and pinch zoom with semantic zoom. Filters,
 * lineage and the view position live in the URL so a link reproduces the same view
 * (see useTreeParams; v = x,y,k).
 */
function ChartView({ model, tp, onLayout }: { model: ClanModel; tp: TreeParams; onLayout(next: TreeLayoutPref): void }) {
  const { params, branch, fromGen, toGen, showSpouses, showMaternal, couple, setParam, setShowMaternal } = tp;
  const { open } = useOverlays();
  const desktop = useIsDesktop();
  const api = useRef<TreeCanvasApi>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const isAdmin = useCanEdit();
  const openAdmin = useAdminUi((s) => s.open);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [hintHidden, setHintHidden] = useState(() => readFlag(HINT_KEY));
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);

  const { lineageId, focusId, selectedId } = tp;

  const filters: TreeFilters = useMemo(
    () => ({ branch, fromGen, toGen, showSpouses, showMaternal, collapsed, couple }),
    [branch, fromGen, toGen, showSpouses, showMaternal, collapsed, couple],
  );
  const layout = useMemo(() => computeTreeLayout(model, filters), [model, filters]);

  const pathIds = useMemo(() => {
    if (!lineageId || !model.get(lineageId)) return null;
    return new Set(model.lineage(lineageId).map((p) => p.id));
  }, [lineageId, model]);

  // The node that shows a person (spouses are drawn inside their partner's node).
  const nodeIdFor = useCallback(
    (id: string) => {
      const p = model.get(id);
      if (!p) return null;
      if (p.isBloodline) return id;
      return model.index.spouseUnionsOf(id)[0]?.bloodlinePersonId ?? null;
    },
    [model],
  );

  // Fly to a person (from search or "Xem trên sơ đồ"): un-collapse / un-filter as needed.
  const attempts = useRef(0);
  useEffect(() => {
    if (!focusId) {
      attempts.current = 0;
      return;
    }
    const nodeId = nodeIdFor(focusId);
    if (!nodeId) {
      setParam({ f: null });
      return;
    }
    if (layout.byId.has(nodeId)) {
      api.current?.goTo(nodeId);
      setFlashId(nodeId);
      setParam({ f: null });
      return;
    }
    attempts.current++;
    if (attempts.current > 3) {
      setParam({ f: null });
      return;
    }
    const ancestors = model.lineage(nodeId).map((p) => p.id);
    if (ancestors.some((a) => collapsed.has(a))) {
      setCollapsed((prev) => new Set([...prev].filter((id) => !ancestors.includes(id))));
      return;
    }
    if (model.isMaternal(nodeId) && !showMaternal) setShowMaternal(true);
    setParam({ chi: null, tu: null, den: null });
  }, [focusId, layout, nodeIdFor, model, collapsed, showMaternal, setShowMaternal, setParam]);

  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 2600);
    return () => window.clearTimeout(t);
  }, [flashId]);

  const onSelect = useCallback((id: string) => open('ct', id), [open]);
  const onToggle = useCallback(
    (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const onViewChange = useCallback((v: string) => setParam({ v }), [setParam]);
  // Read once: later changes come from the canvas itself.
  const [initialView] = useState(() => params.get('v'));

  const anyCollapsed = collapsed.size > 0;

  // Sơ đồ shortcuts (see ShortcutHelp).
  useHotkeys((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isInDialog(e.target)) return;
    const a = api.current;
    const step = 120;
    switch (e.key) {
      case '+':
      case '=':
        a?.zoomBy(1.25);
        return true;
      case '-':
      case '_':
        a?.zoomBy(0.8);
        return true;
      case '0':
        a?.fit();
        return true;
      case 'h':
      case 'H': {
        const first = layout.nodes[0];
        if (first) a?.goTo(first.id);
        return true;
      }
      case 'c':
      case 'C':
        setCollapsed(collapsed.size > 0 ? new Set() : collapseAllIds(model, filters));
        return true;
      case 'ArrowLeft':
        a?.panBy(step, 0);
        return true;
      case 'ArrowRight':
        a?.panBy(-step, 0);
        return true;
      case 'ArrowUp':
        a?.panBy(0, step);
        return true;
      case 'ArrowDown':
        a?.panBy(0, -step);
        return true;
    }
  });
  const lineagePerson = lineageId ? model.get(lineageId) : undefined;
  const showHint = coarse && !hintHidden;

  return (
    <div className={styles.view}>
      <TreeCanvas
        layout={layout}
        coarse={coarse}
        pathIds={pathIds}
        flashId={flashId}
        selectedId={selectedId ? nodeIdFor(selectedId) : null}
        initialView={initialView}
        onViewChange={onViewChange}
        onSelect={onSelect}
        onToggle={onToggle}
        apiRef={api}
      />

      <div className={styles.topBar}>
        {/* The bottom bar already says "Sơ đồ"; the heading is for screen readers. */}
        <h1 className="visually-hidden">
          Sơ đồ, {layout.nodes.length} người · {layout.rows.filter((r) => !r.empty).length} đời
        </h1>
        <div className={styles.filterRow}>
          <GenRangeSlider max={tp.maxGen} from={fromGen ?? 1} to={toGen ?? tp.maxGen} onChange={tp.setGenRange} />
          <LayoutToggle value="ngang" onChange={onLayout} />
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setCollapsed(anyCollapsed ? new Set() : collapseAllIds(model, filters))}
            aria-label={anyCollapsed ? 'Mở hết' : 'Thu gọn'}
          >
            {anyCollapsed ? <ExpandIcon /> : <CollapseIcon />}
          </button>
        </div>
        {!desktop && <AdminStatus variant="header" />}
        {isAdmin && (
          <button type="button" className={styles.chipButton} onClick={() => openAdmin('generations', '')}>
            <PlusIcon width={18} height={18} /> Thêm đời trên / dưới
          </button>
        )}
        {lineagePerson && (
          <div className={styles.chip} role="status">
            Dòng dõi: <strong>{lineagePerson.fullName}</strong>
            <button type="button" className={styles.chipClose} onClick={() => setParam({ dd: null })} aria-label="Bỏ tô sáng dòng dõi">
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        )}
      </div>

      {showHint && (
        <div className={`${styles.chip} ${styles.hint}`}>
          Xoay ngang điện thoại để xem rộng hơn. Dùng hai ngón tay để phóng to.
          <button
            type="button"
            className={styles.chipClose}
            onClick={() => {
              setHintHidden(true);
              try {
                localStorage.setItem(HINT_KEY, '1');
              } catch {
                /* ignore */
              }
            }}
            aria-label="Ẩn gợi ý"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
      )}

      <div className={styles.zoomBar} role="toolbar" aria-label="Phóng to, thu nhỏ">
        <button type="button" className={styles.roundButton} onClick={() => api.current?.zoomBy(1.5)} aria-label="Phóng to">
          <PlusIcon />
        </button>
        <button type="button" className={styles.roundButton} onClick={() => api.current?.zoomBy(1 / 1.5)} aria-label="Thu nhỏ">
          <MinusIcon />
        </button>
        <button type="button" className={styles.roundButton} onClick={() => api.current?.fit()} aria-label="Vừa màn hình">
          <FitIcon />
        </button>
        <button
          type="button"
          className={styles.roundButton}
          onClick={() => {
            const first = layout.nodes[0];
            if (first) api.current?.goTo(first.id);
          }}
          aria-label="Về thủy tổ"
        >
          <HomeIcon />
        </button>
      </div>
    </div>
  );
}
