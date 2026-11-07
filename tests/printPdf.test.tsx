import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { FALLBACK_FAMILY, PDF_FONTS, nearestFont, preparePosterSvg, styleKey } from '@/features/print/exportPdf';
import { PRINT_SPACING, PosterSvg } from '@/features/print/PosterSvg';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { computeTreeLayout } from '@/features/tree/layout';
import { PRINT_THEMES, getTheme } from '@/themes/registry';

const model = buildClanModel(loadDemoSnapshot())!;
const filters = {
  branch: null,
  fromGen: null,
  toGen: null,
  showSpouses: true,
  showMaternal: false,
  collapsed: new Set<string>(),
};
const layout = computeTreeLayout(model, filters);

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

  it('bends the typed title and subtitle along the scroll, inside the board (D73)', () => {
    const { container } = render(
      <PosterSvg theme={theme} model={model} layout={layout} title="GIA PHẢ HỌ TRỊNH" subtitle="Đời thứ nhất đến đời thứ bảy" />,
    );
    const board = container.querySelector(`image[href="${theme.titleBoard!.href}"]`)!;
    expect(board).not.toBeNull();
    const bx = Number(board.getAttribute('x'));
    const bw = Number(board.getAttribute('width'));
    const top = 36.9;
    const bottom = top + bw * theme.titleBoard!.aspect;
    for (const text of ['GIA PHẢ HỌ TRỊNH', 'Đời thứ nhất đến đời thứ bảy']) {
      const line = container.querySelector(`g[aria-label="${text}"]`)!;
      expect(line, text).not.toBeNull();
      const letters = Array.from(line.querySelectorAll('text'));
      expect(letters[0]!.getAttribute('font-family')).toBe('Water Brush');
      expect(letters.map((l) => l.textContent).join('')).toBe(text.replace(/ /g, ''));
      const xs = letters.map((l) => Number(l.getAttribute('x')));
      const ys = letters.map((l) => Number(l.getAttribute('y')));
      for (let i = 0; i < letters.length; i++) {
        expect(xs[i]).toBeGreaterThan(bx);
        expect(xs[i]).toBeLessThan(bx + bw);
        expect(ys[i]).toBeGreaterThan(top);
        expect(ys[i]).toBeLessThan(bottom);
      }
      // An arch: the middle letters sit higher than the ends, which lean outwards.
      const mid = ys[Math.floor(ys.length / 2)]!;
      expect(ys[0]!).toBeGreaterThan(mid);
      expect(ys[ys.length - 1]!).toBeGreaterThan(mid);
      expect(letters[0]!.getAttribute('transform')).toMatch(/^rotate\(-/);
      expect(letters[letters.length - 1]!.getAttribute('transform')).toMatch(/^rotate\([0-9]/);
    }
  });

  it('writes no "Thủy tổ" line under the title (D73)', () => {
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
    expect(container.textContent).not.toMatch(/Thủy tổ|gia đình ở đời 1/);
  });

  it('hides the subtitle when it is left empty', () => {
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" subtitle="" />);
    expect(Array.from(container.querySelectorAll('text')).some((t) => t.textContent === model.settings.subtitle)).toBe(false);
  });
});

describe('print sheet details (D74)', () => {
  it('shows no generation labels ("Đời 1…") on any print theme', () => {
    for (const theme of PRINT_THEMES) {
      const { container, unmount } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
      const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent ?? '');
      expect(texts.some((t) => /^Đời \d+$/.test(t)), theme.id).toBe(false);
      unmount();
    }
  });

  it('"Sơn mài rồng vàng" writes the couplets in brush calligraphy on the painted boards', () => {
    const theme = getTheme('son-mai-rong-vang')!;
    expect(theme.typography.couplet.family).toBe('Water Brush');
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
    const { left, right } = theme.coupletBoxes!;
    const inBoards = (x: number) => (x > left.x && x < left.x + left.w) || (x > right.x && x < right.x + right.w);
    const words = Array.from(container.querySelectorAll('text[font-family="Water Brush"]')).filter((w) =>
      inBoards(Number(w.getAttribute('x'))),
    );
    const wanted = [model.settings.coupletLeft, model.settings.coupletRight].join(' ').split(/\s+/).filter(Boolean);
    expect(words.map((w) => w.textContent)).toEqual(wanted);
    for (const w of words) {
      const x = Number(w.getAttribute('x'));
      const y = Number(w.getAttribute('y'));
      const b = x < 420 ? left : right;
      expect(x).toBeCloseTo(b.x + b.w / 2, 5);
      expect(y).toBeGreaterThan(b.y);
      expect(y).toBeLessThan(b.y + b.h);
    }
  });
});

describe('fuller print layout (D73)', () => {
  const theme = getTheme('son-mai-rong-vang')!;
  const build = (spacing: Parameters<typeof computeTreeLayout>[2]) => computeTreeLayout(model, filters, spacing);

  it('keeps generations closer than on screen, with shorter connector bars', () => {
    const screen = computeTreeLayout(model, filters);
    const print = build({ ...PRINT_SPACING, lineScale: 1 });
    expect(print.metrics.vgap).toBeLessThan(screen.metrics.vgap);
    const gap = (l: typeof screen) => l.rows[1]!.top - (l.rows[0]!.top + l.rows[0]!.height);
    expect(gap(print)).toBeLessThan(gap(screen));
  });

  it('fills a wide tree with taller cards instead of long lines', () => {
    const { container } = render(<PosterSvg theme={theme} model={model} layout={build} title="Gia phả" />);
    const cards = Array.from(container.querySelectorAll('g[transform^="translate"] > rect')).map((r) => Number(r.getAttribute('height')));
    const flat = build({ ...PRINT_SPACING, lineScale: 1 });
    const flatTallest = Math.max(...flat.nodes.filter((n) => n.vertical).map((n) => n.h));
    expect(Math.max(...cards)).toBeGreaterThan(flatTallest * 1.5);
  });
});
