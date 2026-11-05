import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';
import { PRINT_THEMES } from '@/themes/registry';
import type { Theme } from '@/themes/types';
import { BranchPicker } from './BranchPicker';
import { PosterSvg } from './PosterSvg';
import { branchLine, branchOptions, usePrintLayout, useThemeFonts } from './usePrintScope';
import styles from './Print.module.css';

/** /themes — every print theme on the same sample sheet (SPEC §7). */
export default function ThemesPage() {
  const model = useClanStore((s) => s.model)!;
  const [params, setParams] = useSearchParams();
  useThemeFonts(PRINT_THEMES);
  // Default to a generation-3 branch: readable at preview size and shows the branch rule.
  const defaultFocus = useMemo(() => branchOptions(model).find((o) => o.gen === 3)?.person.id ?? null, [model]);
  const focusId = params.has('goc') ? params.get('goc') || null : defaultFocus;
  const layout = usePrintLayout(model, focusId, true);
  const [enlarged, setEnlarged] = useState<Theme | null>(null);
  const treeTheme = usePrefsStore((s) => s.treeTheme);
  const setTreeTheme = usePrefsStore((s) => s.setTreeTheme);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Giao diện in</h1>
        <p>Cùng một bản gia phả khổ A1, trình bày theo {PRINT_THEMES.length} giao diện. Bấm vào bản in để xem lớn.</p>
      </header>
      <BranchPicker model={model} focusId={focusId} onChange={(id) => setParams(id ? { goc: id } : { goc: '' }, { replace: true })} />
      <ul className={styles.themeGrid}>
        {PRINT_THEMES.map((theme) => (
          <li key={theme.id} className={styles.themeCard}>
            <button type="button" className={styles.posterButton} onClick={() => setEnlarged(theme)} aria-label={`Xem lớn: ${theme.name}`}>
              <PosterSvg className={styles.poster} theme={theme} model={model} layout={layout} branchLine={branchLine(model, focusId)} />
            </button>
            <h2 className={styles.themeName}>{theme.name}</h2>
            <p className={styles.themeText}>{theme.description}</p>
            <div className={styles.cardActions}>
              <Link className={styles.cardAction} to={`/print?giaodien=${theme.id}${focusId ? `&goc=${encodeURIComponent(focusId)}` : ''}`}>
                In với giao diện này
              </Link>
              <button
                type="button"
                className={styles.cardAction}
                aria-pressed={treeTheme === theme.id}
                onClick={() => setTreeTheme(treeTheme === theme.id ? 'ember' : theme.id)}
              >
                {treeTheme === theme.id ? '✓ Đang dùng cho sơ đồ' : 'Dùng cho sơ đồ'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {enlarged && (
        <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={`Xem lớn: ${enlarged.name}`}>
          <div className={styles.viewerBar}>
            <span>{enlarged.name}</span>
            <button type="button" className={styles.viewerClose} onClick={() => setEnlarged(null)}>
              Đóng
            </button>
          </div>
          <div className={styles.viewerScroll}>
            <PosterSvg className={styles.posterLarge} theme={enlarged} model={model} layout={layout} branchLine={branchLine(model, focusId)} />
          </div>
        </div>
      )}
    </div>
  );
}
