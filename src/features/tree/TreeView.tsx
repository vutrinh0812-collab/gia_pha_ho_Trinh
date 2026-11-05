import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminStatus } from '@/app/AdminStatus';
import { isInDialog, useHotkeys } from '@/app/useHotkeys';
import { useOverlays } from '@/app/useOverlays';
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  FilterIcon,
  FitIcon,
  HomeIcon,
  MinusIcon,
  PaletteIcon,
  PlusIcon,
} from '@/app/ui/icons';
import { useClanStore } from '@/store/clanStore';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { usePrefsStore } from '@/store/prefsStore';
import { collapseAllIds, computeTreeLayout, type TreeFilters } from './layout';
import { TreeCanvas, type TreeCanvasApi } from './TreeCanvas';
import { TreeFilterSheet } from './TreeFilterSheet';
import { TreeThemeSheet } from './TreeThemeSheet';
import { treeThemeVars, useTreeTheme } from './useTreeTheme';
import styles from './Tree.module.css';

const HINT_KEY = 'giapha.rotateHint.v1';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function intParam(v: string | null): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * "Sơ đồ" — the full tree (SPEC 5 and 5A.1 mode 2). Filters, lineage and the
 * view position live in the URL so a link reproduces the same view.
 * URL: chi (branch), tu/den (generation range), dr=0 (hide spouses),
 *      dd (highlighted lineage), f (fly to person), v (x,y,k).
 */
export default function TreeView() {
  const model = useClanStore((s) => s.model)!;
  const prefMaternal = usePrefsStore((s) => s.showMaternal);
  const setShowMaternal = usePrefsStore((s) => s.setShowMaternal);
  const showMaternal = prefMaternal ?? model.settings.showMaternalDescendants;
  const [params, setParams] = useSearchParams();
  const { open } = useOverlays();
  const api = useRef<TreeCanvasApi>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const isAdmin = useAdminStore((s) => s.status === 'admin');
  const openAdmin = useAdminUi((s) => s.open);
  const treeThemeId = usePrefsStore((s) => s.treeTheme);
  const setTreeTheme = usePrefsStore((s) => s.setTreeTheme);
  const treeTheme = useTreeTheme(treeThemeId);
  const themeStyle = useMemo(() => (treeTheme ? treeThemeVars(treeTheme) : undefined), [treeTheme]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [hintHidden, setHintHidden] = useState(() => readFlag(HINT_KEY));
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);

  const branch = params.get('chi');
  const fromGen = intParam(params.get('tu'));
  const toGen = intParam(params.get('den'));
  const showSpouses = params.get('dr') !== '0';
  const lineageId = params.get('dd');
  const focusId = params.get('f');
  const selectedId = params.get('ct');

  const filters: TreeFilters = useMemo(
    () => ({ branch, fromGen, toGen, showSpouses, showMaternal, collapsed }),
    [branch, fromGen, toGen, showSpouses, showMaternal, collapsed],
  );
  const layout = useMemo(() => computeTreeLayout(model, filters), [model, filters]);

  const pathIds = useMemo(() => {
    if (!lineageId || !model.get(lineageId)) return null;
    return new Set(model.lineage(lineageId).map((p) => p.id));
  }, [lineageId, model]);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

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
      case 'l':
      case 'L':
        setFiltersOpen(true);
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
  const activeFilters = [branch, fromGen || toGen ? 'đời' : null, showSpouses ? null : 'dâu-rể'].filter(Boolean).length;
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
        themeStyle={themeStyle}
      />

      <div className={styles.topBar}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>
            Sơ đồ
            <span className={styles.titleSub}>
              {layout.nodes.length} người · {layout.rows.filter((r) => !r.empty).length} đời
            </span>
          </h1>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setFiltersOpen(true)}
            aria-label={activeFilters ? `Lọc (đang lọc ${activeFilters})` : 'Lọc'}
          >
            <FilterIcon />
            <span className={styles.toolLabel}>Lọc</span>
            {activeFilters > 0 && <span className={styles.dot}>{activeFilters}</span>}
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setThemeOpen(true)}
            aria-label={`Giao diện: ${treeTheme?.name ?? 'Ember'}`}
          >
            <PaletteIcon />
            <span className={styles.toolLabel}>Giao diện</span>
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setCollapsed(anyCollapsed ? new Set() : collapseAllIds(model, filters))}
          >
            {anyCollapsed ? <ExpandIcon /> : <CollapseIcon />}
            <span className={styles.toolLabel}>{anyCollapsed ? 'Mở hết' : 'Thu gọn'}</span>
          </button>
        </div>
        <AdminStatus variant="chip" />
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

      {themeOpen && <TreeThemeSheet value={treeThemeId} onChange={setTreeTheme} onClose={() => setThemeOpen(false)} />}

      {filtersOpen && (
        <TreeFilterSheet
          model={model}
          branch={branch}
          fromGen={fromGen}
          toGen={toGen}
          showSpouses={showSpouses}
          showMaternal={showMaternal}
          onChange={(patch) => setParam(patch)}
          onMaternal={setShowMaternal}
          onClose={() => setFiltersOpen(false)}
          onReset={() => setParam({ chi: null, tu: null, den: null, dr: null })}
        />
      )}
    </div>
  );
}
