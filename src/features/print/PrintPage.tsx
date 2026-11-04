import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { getTheme, PRINT_THEMES } from '@/themes/registry';
import { BranchPicker } from './BranchPicker';
import { DEFAULT_POSTER_OPTIONS, PosterSvg, type PosterOptions } from './PosterSvg';
import { branchLine, usePrintLayout, useThemeFonts } from './usePrintScope';
import styles from './Print.module.css';

const TOGGLES: Array<[keyof PosterOptions, string]> = [
  ['showYears', 'Năm sinh, năm mất'],
  ['showSpouses', 'Dâu, rể'],
  ['showOtherNames', 'Tên húy'],
  ['showCouplets', 'Câu đối'],
  ['showColophon', 'Lạc khoản'],
  ['showGenerations', 'Cột đánh dấu đời'],
];

/** /print — the A1 layout (SPEC §8). Export to PDF/SVG/PNG arrives in phase 6. */
export default function PrintPage() {
  const model = useClanStore((s) => s.model)!;
  const [params, setParams] = useSearchParams();
  const focusId = params.get('goc') || null;
  const [themeId, setThemeId] = useState(() => PRINT_THEMES[0]?.id ?? '');
  const [opts, setOpts] = useState<PosterOptions>(DEFAULT_POSTER_OPTIONS);
  const theme = getTheme(themeId) ?? PRINT_THEMES[0]!;
  useThemeFonts(useMemo(() => [theme], [theme]));
  const layout = usePrintLayout(model, focusId, opts.showSpouses);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>In khổ A1</h1>
        <p>Xem trước đúng tỉ lệ A1 (841 × 594 mm). Xuất file PDF, SVG, PNG sẽ có ở giai đoạn 6.</p>
      </header>
      <div className={styles.controls}>
        <BranchPicker model={model} focusId={focusId} onChange={(id) => setParams(id ? { goc: id } : {}, { replace: true })} />
        <div className={styles.field}>
          <label htmlFor="print-theme">Giao diện</label>
          <select id="print-theme" value={theme.id} onChange={(e) => setThemeId(e.target.value)}>
            {PRINT_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="print-orientation">Hướng giấy</label>
          <select
            id="print-orientation"
            value={opts.orientation}
            onChange={(e) => setOpts((o) => ({ ...o, orientation: e.target.value as PosterOptions['orientation'] }))}
          >
            <option value="landscape">Ngang (841 × 594 mm)</option>
            <option value="portrait">Dọc (594 × 841 mm)</option>
          </select>
        </div>
        <fieldset className={styles.toggles}>
          <legend>Hiện trên bản in</legend>
          {TOGGLES.map(([k, label]) => (
            <label key={k} className={styles.check} htmlFor={`print-${k}`}>
              <input id={`print-${k}`} type="checkbox" checked={opts[k] as boolean} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      <div className={styles.preview}>
        <PosterSvg className={styles.poster} theme={theme} model={model} layout={layout} options={opts} branchLine={branchLine(model, focusId)} />
      </div>
      <p className={styles.hint}>Trên điện thoại vẫn xem trước được; nên dùng máy tính để chỉnh bố cục in.</p>
    </div>
  );
}
