import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { PRINT_THEMES, printThemeOrDefault } from '@/themes/registry';
import type { Theme } from '@/themes/types';
import { BranchPicker } from './BranchPicker';
import { A1, DEFAULT_POSTER_OPTIONS, MAX_TREE_SHIFT_MM, MAX_TREE_ZOOM, MIN_TREE_ZOOM, PosterSvg, type PosterOptions } from './PosterSvg';
import { usePrintLayoutBuilder, useThemeFonts } from './usePrintScope';
import styles from './Print.module.css';

/**
 * /print — "In ấn" (DECISIONS D62): pick a print theme and preview the A1 sheet.
 * Importing frame packages (JSON + pictures) was removed in D91.
 */
export default function PrintPage() {
  const model = useClanStore((s) => s.model)!;
  const [params, setParams] = useSearchParams();
  const focusId = params.get('goc') || null;
  const themes = PRINT_THEMES;
  // The theme from the link, else the clan's default print theme, else the app's (D91).
  const [themeId, setThemeId] = useState(() => params.get('giaodien') || model.settings.defaultThemeId);
  const theme = printThemeOrDefault(themeId);
  const [opts, setOpts] = useState<PosterOptions>(DEFAULT_POSTER_OPTIONS);
  // Text written on the title board (D72): starts from the clan settings, typed freely here.
  const [title, setTitle] = useState(model.settings.title);
  // Empty by default (D73): type a line here when the sheet needs one.
  const [subtitle, setSubtitle] = useState('');
  const shownTitle = title.trim() || model.settings.title;
  useThemeFonts(themes);
  const layout = usePrintLayoutBuilder(model, focusId, opts.showSpouses);

  // Each theme's own fit is the default size of the tree (D98): back to it on a new theme.
  const pick = (t: Theme) => {
    setThemeId(t.id);
    setOpts((o) => ({ ...o, treeZoom: 1, treeShiftMm: 0, orientation: t.preferredOrientation ?? o.orientation }));
  };
  const zoomPct = Math.round(opts.treeZoom * 100);
  const setZoom = (pct: number) => setOpts((o) => ({ ...o, treeZoom: pct / 100 }));
  // Up/down (D99): positive moves the tree down the sheet.
  const shift = opts.treeShiftMm;
  const setShift = (mm: number) => setOpts((o) => ({ ...o, treeShiftMm: mm }));
  const shiftText = shift === 0 ? '0 mm' : `${shift < 0 ? 'Lên' : 'Xuống'} ${Math.abs(shift)} mm`;
  const isDefault = zoomPct === 100 && shift === 0;

  // PDF of the sheet in the preview (D72): vector text and lines, pictures at full resolution.
  const previewRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  const downloadPdf = async () => {
    const svg = previewRef.current?.querySelector('svg');
    if (!svg || pdfBusy) return;
    setPdfBusy(true);
    setPdfNote(null);
    try {
      const { exportPosterPdf } = await import('./exportPdf');
      const size = A1[opts.orientation];
      const slug = shownTitle
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await exportPosterPdf(svg, { widthMm: size.w, heightMm: size.h, fileName: `${slug || 'gia-pha'}-a1.pdf`, title: shownTitle });
    } catch (e) {
      setPdfNote(e instanceof Error ? e.message : 'Không tạo được file PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>In ấn</h1>
        <p>Chọn giao diện khung tranh, phạm vi in và xem trước đúng tỉ lệ A1 (841 × 594 mm).</p>
      </header>

      <section className={styles.section} aria-labelledby="print-themes">
        <h2 id="print-themes" className={styles.sectionTitle}>
          Giao diện khung
        </h2>
        <ul className={styles.themePicker}>
          {themes.map((t) => (
              <li key={t.id} className={styles.themeOption}>
                <button
                  type="button"
                  className={styles.themeButton}
                  aria-pressed={t.id === theme.id}
                  onClick={() => pick(t)}
                  aria-label={`Giao diện ${t.name}`}
                >
                  <PosterSvg
                    className={styles.thumb}
                    theme={t}
                    model={model}
                    layout={layout}
                    options={{ ...opts, treeZoom: 1, orientation: t.preferredOrientation ?? opts.orientation }}
                    title={shownTitle}
                    subtitle={subtitle}
                  />
                  <span className={styles.themeLabel}>{t.name}</span>
                </button>
              </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="print-options">
        <h2 id="print-options" className={styles.sectionTitle}>
          Nội dung bản in
        </h2>
        <div className={styles.controls}>
          <div className={styles.titleFields}>
            <div className={styles.field}>
              <label htmlFor="print-title">Tiêu đề</label>
              <input id="print-title" type="text" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="print-subtitle">Dòng phụ dưới tiêu đề</label>
              <input
                id="print-subtitle"
                type="text"
                value={subtitle}
                maxLength={90}
                placeholder="Ví dụ: Đời thứ nhất đến đời thứ bảy"
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
          </div>
          <BranchPicker model={model} focusId={focusId} onChange={(id) => setParams(id ? { goc: id } : {}, { replace: true })} />
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
        </div>
      </section>

      <div className={styles.exportBar}>
        <button type="button" className={styles.primaryAction} onClick={() => void downloadPdf()} disabled={pdfBusy}>
          {pdfBusy ? 'Đang tạo PDF…' : 'Tải PDF khổ A1'}
        </button>
        <span className={styles.hint}>Chữ và đường nét dạng vector, in sắc nét ở mọi cỡ; ảnh khung giữ nguyên độ phân giải gốc.</span>
      </div>
      {pdfNote && (
        <p className={styles.error} role="alert">
          {pdfNote}
        </p>
      )}
      {/* Size and place of the tree on the sheet (D98, D99); the theme's own are the default. */}
      <div className={styles.adjust} role="group" aria-label="Căn chỉnh sơ đồ">
        <div className={styles.zoomBar}>
          <label htmlFor="print-zoom">Cỡ sơ đồ</label>
          <input
            id="print-zoom"
            type="range"
            min={MIN_TREE_ZOOM * 100}
            max={MAX_TREE_ZOOM * 100}
            step={5}
            value={zoomPct}
            aria-valuetext={`${zoomPct}%${zoomPct === 100 ? ', mặc định của giao diện' : ''}`}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <output htmlFor="print-zoom" className={styles.zoomValue}>
            {zoomPct}%
          </output>
        </div>
        <div className={styles.zoomBar}>
          <label htmlFor="print-shift">Lên / xuống</label>
          <input
            id="print-shift"
            type="range"
            min={-MAX_TREE_SHIFT_MM}
            max={MAX_TREE_SHIFT_MM}
            step={5}
            value={shift}
            aria-valuetext={shift === 0 ? 'Vị trí mặc định của giao diện' : shiftText}
            onChange={(e) => setShift(Number(e.target.value))}
          />
          <output htmlFor="print-shift" className={styles.zoomValue}>
            {shiftText}
          </output>
        </div>
        <button
          type="button"
          className={styles.zoomReset}
          onClick={() => setOpts((o) => ({ ...o, treeZoom: 1, treeShiftMm: 0 }))}
          disabled={isDefault}
        >
          Mặc định
        </button>
      </div>
      {(zoomPct > 100 || shift !== 0) && (
        <p className={styles.hint}>Sơ đồ khác cỡ hoặc vị trí mặc định có thể tràn ra khung tranh hay chạm tiêu đề: xem kỹ bản xem trước trước khi in.</p>
      )}
      <div ref={previewRef} className={styles.preview}>
        <PosterSvg
          className={styles.poster}
          theme={theme}
          model={model}
          layout={layout}
          options={opts}
          title={shownTitle}
          subtitle={subtitle}
        />
      </div>
    </div>
  );
}
