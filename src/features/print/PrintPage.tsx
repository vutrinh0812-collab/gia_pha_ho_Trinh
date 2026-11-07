import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CloseIcon, PlusIcon } from '@/app/ui/icons';
import { useClanStore } from '@/store/clanStore';
import { PRINT_THEMES } from '@/themes/registry';
import type { Theme } from '@/themes/types';
import { BranchPicker } from './BranchPicker';
import { deletePack, listPacks, packFromFiles, packTheme, samplePackFile, savePack, type StoredPack } from './packs';
import { A1, DEFAULT_POSTER_OPTIONS, PosterSvg, type PosterOptions } from './PosterSvg';
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

/**
 * /print — "In ấn" (DECISIONS D62): pick a print theme or an imported frame package,
 * import packages (a JSON preset with its frame picture, kept on this device), and
 * preview the A1 sheet. Replaces the separate "Giao diện in" and "In khổ A1" pages.
 */
export default function PrintPage() {
  const model = useClanStore((s) => s.model)!;
  const [params, setParams] = useSearchParams();
  const focusId = params.get('goc') || null;
  const [packs, setPacks] = useState<StoredPack[]>([]);
  useEffect(() => {
    void listPacks().then(setPacks);
  }, []);
  const packThemes = useMemo(() => packs.map(packTheme), [packs]);
  const themes: Theme[] = useMemo(() => [...PRINT_THEMES, ...packThemes], [packThemes]);

  // The theme from the link, else the clan's default print theme (SPEC §8: truyen-thong-do).
  const [themeId, setThemeId] = useState(() => params.get('giaodien') || model.settings.defaultThemeId || 'truyen-thong-do');
  const theme = themes.find((t) => t.id === themeId) ?? PRINT_THEMES.find((t) => t.id === 'truyen-thong-do') ?? PRINT_THEMES[0]!;
  const [opts, setOpts] = useState<PosterOptions>(DEFAULT_POSTER_OPTIONS);
  // Text written on the title board (D72): starts from the clan settings, typed freely here.
  const [title, setTitle] = useState(model.settings.title);
  const [subtitle, setSubtitle] = useState(model.settings.subtitle ?? '');
  const shownTitle = title.trim() || model.settings.title;
  useThemeFonts(themes);
  const layout = usePrintLayout(model, focusId, opts.showSpouses);
  const line = branchLine(model, focusId);

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

  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const importFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      const pack = await packFromFiles([...list]);
      await savePack(pack);
      const next = await listPacks();
      setPacks(next);
      setThemeId(pack.id);
      if (pack.json.huongGiay) setOpts((o) => ({ ...o, orientation: pack.json.huongGiay === 'doc' ? 'portrait' : 'landscape' }));
      setNote({ kind: 'ok', text: `Đã nhập "${pack.json.ten}" và chọn để xem trước.` });
    } catch (e) {
      setNote({ kind: 'error', text: e instanceof Error ? e.message : 'Không nhập được gói giao diện.' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const remove = async (id: string) => {
    await deletePack(id);
    setPacks(await listPacks());
    if (themeId === id) setThemeId('truyen-thong-do');
  };
  const downloadSample = () => {
    const url = URL.createObjectURL(samplePackFile());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goi-giao-dien-mau.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          {themes.map((t) => {
            const imported = t.id.startsWith('goi-');
            return (
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
                    branchLine={line}
                    title={shownTitle}
                    subtitle={subtitle}
                  />
                  <span className={styles.themeLabel}>
                    {t.name}
                    {imported && <span className={styles.badge}>Đã nhập</span>}
                  </span>
                </button>
                {imported && (
                  <button type="button" className={styles.removePack} onClick={() => void remove(t.id)} aria-label={`Xóa gói ${t.name}`}>
                    <CloseIcon width={16} height={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className={styles.themeText}>{theme.description}</p>

        <div className={styles.packTools}>
          <button type="button" className={styles.primaryAction} onClick={() => fileInput.current?.click()}>
            <PlusIcon width={18} height={18} /> Nhập gói giao diện
          </button>
          <button type="button" className={styles.cardAction} onClick={downloadSample}>
            Tải JSON mẫu
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json,image/*"
            multiple
            hidden
            onChange={(e) => void importFiles(e.target.files)}
          />
        </div>
        <p className={styles.hint}>
          Gói gồm một ảnh khung tranh khổ A1, có thể thêm một ảnh bảng tiêu đề riêng (nền trong suốt), và một file JSON mô tả vùng đặt cây, màu
          và chữ. Tải JSON mẫu, sửa theo ý, rồi chọn cùng lúc file JSON và các ảnh. Gói được lưu trên máy này.
        </p>
        {note && (
          <p className={note.kind === 'ok' ? styles.ok : styles.error} role={note.kind === 'ok' ? 'status' : 'alert'}>
            {note.text}
          </p>
        )}
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
          branchLine={line}
          title={shownTitle}
          subtitle={subtitle}
        />
      </div>
      <p className={styles.hint}>Trên điện thoại vẫn xem trước và tải PDF được; nên dùng máy tính để chỉnh bố cục in.</p>
    </div>
  );
}
