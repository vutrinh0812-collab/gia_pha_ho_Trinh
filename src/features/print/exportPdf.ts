/**
 * PDF export of the A1 sheet (SPEC §8 "PDF vector", DECISIONS D72).
 *
 * The poster is already an SVG in millimetres, so it is converted as is with svg2pdf:
 * text, boxes and lines stay vector (sharp at any zoom), pictures (frame, title board)
 * are embedded at their full resolution. Vietnamese text needs real fonts in the PDF, so
 * the print themes' fonts are bundled as TTF (public/fonts/pdf, Latin + Vietnamese only,
 * fetched only when someone exports) and each is embedded as a subset of the glyphs used.
 * jsPDF and svg2pdf are loaded on demand too: nobody pays for them until they export.
 */

/** Font files bundled for the print themes: family → available weights (and italics). */
export const PDF_FONTS: Record<string, Array<{ weight: number; italic?: boolean; file: string }>> = {
  'Cormorant Garamond': [
    { weight: 400, file: 'cormorant-garamond-400.ttf' },
    { weight: 500, file: 'cormorant-garamond-500.ttf' },
    { weight: 600, file: 'cormorant-garamond-600.ttf' },
    { weight: 700, file: 'cormorant-garamond-700.ttf' },
    { weight: 600, italic: true, file: 'cormorant-garamond-600-italic.ttf' },
  ],
  'Noto Serif': [
    { weight: 400, file: 'noto-serif-400.ttf' },
    { weight: 600, file: 'noto-serif-600.ttf' },
    { weight: 700, file: 'noto-serif-700.ttf' },
  ],
  'Noto Serif Display': [{ weight: 800, file: 'noto-serif-display-800.ttf' }],
  Prata: [{ weight: 400, file: 'prata-400.ttf' }],
  Literata: [
    { weight: 400, file: 'literata-400.ttf' },
    { weight: 600, file: 'literata-600.ttf' },
    { weight: 700, file: 'literata-700.ttf' },
  ],
  'Playfair Display': [
    { weight: 400, file: 'playfair-display-400.ttf' },
    { weight: 600, file: 'playfair-display-600.ttf' },
    { weight: 700, file: 'playfair-display-700.ttf' },
  ],
  Lora: [
    { weight: 400, file: 'lora-400.ttf' },
    { weight: 600, file: 'lora-600.ttf' },
    { weight: 700, file: 'lora-700.ttf' },
    { weight: 400, italic: true, file: 'lora-400-italic.ttf' },
    { weight: 600, italic: true, file: 'lora-600-italic.ttf' },
    { weight: 700, italic: true, file: 'lora-700-italic.ttf' },
  ],
  'Dancing Script': [
    { weight: 400, file: 'dancing-script-400.ttf' },
    { weight: 600, file: 'dancing-script-600.ttf' },
    { weight: 700, file: 'dancing-script-700.ttf' },
  ],
  'Water Brush': [{ weight: 400, file: 'water-brush-400.ttf' }],
};

/** Used for any family that is not bundled (an imported pack's own font): it has every Vietnamese letter. */
export const FALLBACK_FAMILY = 'Noto Serif';

/** The style key svg2pdf asks jsPDF for, for a weight and slant (see combineFontStyleAndFontWeight in svg2pdf). */
export function styleKey(weight: number, italic: boolean): string {
  if (weight === 400) return italic ? 'italic' : 'normal';
  if (weight === 700) return italic ? 'bolditalic' : 'bold';
  return `${weight}${italic ? 'italic' : 'normal'}`;
}

/** The bundled file closest to a weight and slant (same slant first, then nearest weight). */
export function nearestFont(family: string, weight: number, italic: boolean): string {
  const faces = PDF_FONTS[family] ?? PDF_FONTS[FALLBACK_FAMILY]!;
  const sameSlant = faces.filter((f) => Boolean(f.italic) === italic);
  const pool = sameSlant.length ? sameSlant : faces;
  return pool.reduce((best, f) => (Math.abs(f.weight - weight) < Math.abs(best.weight - weight) ? f : best)).file;
}

const firstFamily = (value: string) => value.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');

/**
 * Adjusts a copy of the poster for svg2pdf: it ignores `dominant-baseline` (the poster
 * centres text with it) but reads `alignment-baseline`; families that are not bundled
 * are switched to the fallback so Vietnamese letters never come out blank.
 * Returns the families the copy uses.
 */
export function preparePosterSvg(svg: SVGSVGElement): Set<string> {
  const families = new Set<string>();
  for (const el of Array.from(svg.querySelectorAll('[dominant-baseline]'))) {
    el.setAttribute('alignment-baseline', el.getAttribute('dominant-baseline')!);
  }
  for (const el of Array.from(svg.querySelectorAll('[font-family]'))) {
    const fam = firstFamily(el.getAttribute('font-family')!);
    const use = PDF_FONTS[fam] ? fam : FALLBACK_FAMILY;
    el.setAttribute('font-family', use);
    families.add(use);
  }
  families.add(FALLBACK_FAMILY);
  return families;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export interface PdfExportOptions {
  widthMm: number;
  heightMm: number;
  fileName: string;
  title: string;
}

/** Builds the PDF of a rendered poster SVG and starts the download. */
export async function exportPosterPdf(svg: SVGSVGElement, o: PdfExportOptions): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);

  // Work on a copy attached off-screen (svg2pdf reads computed geometry of real nodes).
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;width:841px;height:594px;overflow:hidden;';
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(o.widthMm));
  copy.setAttribute('height', String(o.heightMm));
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    const families = preparePosterSvg(copy);
    const pdf = new jsPDF({
      orientation: o.widthMm > o.heightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [o.widthMm, o.heightMm],
      compress: true,
    });

    // Register every family the sheet uses, for every weight/slant svg2pdf may ask for,
    // each pointing at the nearest bundled file (fetched once).
    const base = import.meta.env.BASE_URL;
    const loaded = new Map<string, Promise<string>>();
    const load = (file: string) => {
      if (!loaded.has(file)) {
        loaded.set(
          file,
          fetch(`${base}fonts/pdf/${file}`).then(async (r) => {
            if (!r.ok) throw new Error(`Không tải được phông chữ ${file}.`);
            return toBase64(await r.arrayBuffer());
          }),
        );
      }
      return loaded.get(file)!;
    };
    for (const family of families) {
      for (const italic of [false, true]) {
        for (let weight = 100; weight <= 900; weight += 100) {
          const file = nearestFont(family, weight, italic);
          const data = await load(file);
          if (!pdf.existsFileInVFS(file)) pdf.addFileToVFS(file, data);
          pdf.addFont(file, family, styleKey(weight, italic));
        }
      }
    }

    await svg2pdf(copy, pdf, { x: 0, y: 0, width: o.widthMm, height: o.heightMm });
    pdf.setProperties({ title: o.title, subject: 'Gia phả', creator: 'Gia phả dòng họ' });
    pdf.save(o.fileName);
  } finally {
    holder.remove();
  }
}
