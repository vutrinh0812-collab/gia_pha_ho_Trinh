import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { PRINT_THEMES, printThemeOrDefault } from '@/themes/registry';
import type { Theme } from '@/themes/types';
import { BranchPicker } from './BranchPicker';
import { A1, DEFAULT_POSTER_OPTIONS, PosterSvg, type PosterOptions } from './PosterSvg';
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

  const pick = (t: Theme) => {
    setThemeId(t.id);
    if (t.preferredOrientation) setOpts((o) => ({ ...o, orientation: t.preferredOrientation! }));
  };

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
                    options={{ ...opts, orientation: t.preferredOrientation ?? opts.orientation }}
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
