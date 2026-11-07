import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { FALLBACK_FAMILY, PDF_FONTS, nearestFont, preparePosterSvg, styleKey } from '@/features/print/exportPdf';
import { PosterSvg } from '@/features/print/PosterSvg';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { computeTreeLayout } from '@/features/tree/layout';
import { PRINT_THEMES, getTheme } from '@/themes/registry';

const model = buildClanModel(loadDemoSnapshot())!;
const layout = computeTreeLayout(model, {
  branch: null,
  fromGen: null,
  toGen: null,
  showSpouses: true,
  showMaternal: false,
  collapsed: new Set(),
});

describe('PDF export (D72)', () => {
  it('bundles a font file for every family a print theme uses', () => {
    for (const t of PRINT_THEMES) {
      for (const spec of Object.values(t.typography)) {
        expect(PDF_FONTS[spec.family], `${t.id}: ${spec.family}`).toBeDefined();
      }
    }
    for (const faces of Object.values(PDF_FONTS)) {
      for (const f of faces) expect(existsSync(join('public/fonts/pdf', f.file)), f.file).toBe(true);
    }
  });

  it('asks jsPDF for the same style keys svg2pdf uses, and picks the nearest weight', () => {
    expect(styleKey(400, false)).toBe('normal');
    expect(styleKey(700, false)).toBe('bold');
    expect(styleKey(600, false)).toBe('600normal');
    expect(styleKey(600, true)).toBe('600italic');
    expect(nearestFont('Lora', 800, false)).toBe('lora-700.ttf');
    expect(nearestFont('Cormorant Garamond', 600, true)).toBe('cormorant-garamond-600-italic.ttf');
    expect(nearestFont('Prata', 700, true)).toBe('prata-400.ttf'); // only one face: used for everything
    expect(nearestFont('Phông lạ', 400, false)).toBe(nearestFont(FALLBACK_FAMILY, 400, false));
  });

  it('prepares the sheet: centred text keeps its baseline, unknown fonts fall back to one with Vietnamese', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML =
      '<text dominant-baseline="central" font-family="Playfair Display">A</text><text font-family="\'Phông lạ\', serif">B</text>';
    const families = preparePosterSvg(svg);
    const [a, b] = Array.from(svg.querySelectorAll('text'));
    expect(a!.getAttribute('alignment-baseline')).toBe('central');
    expect(b!.getAttribute('font-family')).toBe(FALLBACK_FAMILY);
    expect([...families].sort()).toEqual([FALLBACK_FAMILY, 'Playfair Display'].sort());
  });
});

describe('"Sơn mài rồng vàng": frame preset with its own title board (D72)', () => {
  const theme = getTheme('son-mai-rong-vang')!;

  it('is a print theme: frame picture, separate title board, A1 landscape', () => {
    expect(PRINT_THEMES.map((t) => t.id)).toContain('son-mai-rong-vang');
    expect(theme.backgroundImage?.href).toBeTruthy();
    expect(theme.titleBoard).toMatchObject({ topMm: 36.9, widthMm: 306.7 });
    expect(theme.preferredOrientation).toBe('landscape');
    expect(theme.frame.enabled).toBe(false);
  });

  it('writes the typed title and subtitle inside the board', () => {
    const { container } = render(
      <PosterSvg theme={theme} model={model} layout={layout} title="GIA PHẢ HỌ TRỊNH" subtitle="Đời thứ nhất đến đời thứ bảy" />,
    );
    const board = container.querySelector(`image[href="${theme.titleBoard!.href}"]`)!;
    expect(board).not.toBeNull();
    const bx = Number(board.getAttribute('x'));
    const bw = Number(board.getAttribute('width'));
    const texts = Array.from(container.querySelectorAll('text'));
    const title = texts.find((t) => t.textContent === 'GIA PHẢ HỌ TRỊNH')!;
    const sub = texts.find((t) => t.textContent === 'Đời thứ nhất đến đời thứ bảy')!;
    for (const t of [title, sub]) {
      const x = Number(t.getAttribute('x'));
      const y = Number(t.getAttribute('y'));
      expect(x).toBeCloseTo(bx + bw / 2, 1); // centred on the board
      expect(y).toBeGreaterThan(36.9);
      expect(y).toBeLessThan(36.9 + bw * theme.titleBoard!.aspect);
    }
    expect(Number(sub.getAttribute('y'))).toBeGreaterThan(Number(title.getAttribute('y')));
  });

  it('hides the subtitle when it is left empty', () => {
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" subtitle="" />);
    expect(Array.from(container.querySelectorAll('text')).some((t) => t.textContent === model.settings.subtitle)).toBe(false);
  });
});
