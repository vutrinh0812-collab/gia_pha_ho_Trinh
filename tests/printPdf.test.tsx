import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { FALLBACK_FAMILY, PDF_FONTS, nearestFont, preparePosterSvg, styleKey } from '@/features/print/exportPdf';
import { PRINT_SPACING, PosterSvg, Relief, fitBoardText, placeTree, type BoardLine } from '@/features/print/PosterSvg';
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

describe('"Đỏ son sen vàng": relief Buddha above a gold silk ribbon (D78)', () => {
  const theme = getTheme('do-son-sen-vang')!;

  it('is a print theme: frame picture, title layer, no couplets, A1 landscape', () => {
    expect(PRINT_THEMES.map((t) => t.id)).toContain('do-son-sen-vang');
    expect(theme.backgroundImage?.href).toBeTruthy();
    expect(theme.titleBoard).toMatchObject({ topMm: 8, widthMm: 400, arcRadius: -2.0 });
    expect(theme.ornaments.showCouplets).toBe(false);
    expect(theme.preferredOrientation).toBe('landscape');
  });

  it('writes the title in spaced capitals, bent along the ribbon\'s sag, in bronze on its face', () => {
    const { container } = render(
      <PosterSvg theme={theme} model={model} layout={layout} title="Gia Phả Họ Trịnh" subtitle="Đời thứ nhất đến đời thứ bảy" />,
    );
    const b = theme.titleBoard!;
    const h = b.widthMm * b.aspect;
    const x0 = (841 - b.widthMm) / 2;
    const face = {
      left: x0 + b.textBox.left * b.widthMm,
      right: x0 + b.textBox.right * b.widthMm,
      top: b.topMm + b.textBox.top * h,
      bottom: b.topMm + b.textBox.bottom * h,
    };
    const lines = [
      ['GIA PHẢ HỌ TRỊNH', 'Noto Serif Display'],
      ['Đời thứ nhất đến đời thứ bảy', 'Prata'],
    ] as const;
    for (const [text, family] of lines) {
      const line = container.querySelector(`g[aria-label="${text}"]`)!;
      expect(line, text).not.toBeNull();
      const letters = Array.from(line.querySelectorAll('text'));
      expect(letters.map((l) => l.textContent).join('')).toBe(text.replace(/ /g, ''));
      expect(letters[0]!.getAttribute('font-family')).toBe(family);
      expect(letters[0]!.getAttribute('fill')).toBe('#4a2a0c');
      const xs = letters.map((l) => Number(l.getAttribute('x')));
      const ys = letters.map((l) => Number(l.getAttribute('y')));
      for (let i = 0; i < letters.length; i++) {
        expect(xs[i]).toBeGreaterThan(face.left);
        expect(xs[i]).toBeLessThan(face.right);
        expect(ys[i]).toBeGreaterThan(face.top);
        expect(ys[i]).toBeLessThan(face.bottom);
      }
      // A sag: the middle letters sit lower than the ends, which lean inwards.
      const mid = ys[Math.floor(ys.length / 2)]!;
      expect(ys[0]!).toBeLessThan(mid);
      expect(ys[ys.length - 1]!).toBeLessThan(mid);
      expect(letters[0]!.getAttribute('transform')).toMatch(/^rotate\([0-9]/);
      expect(letters[letters.length - 1]!.getAttribute('transform')).toMatch(/^rotate\(-/);
    }
  });

  it('starts the tree below the ribbon, beside its tails, not below the whole picture', () => {
    const b = theme.titleBoard!;
    const h = b.widthMm * b.aspect;
    const treeTop = (t: typeof theme) => {
      const { container, unmount } = render(<PosterSvg theme={t} model={model} layout={layout} title="Gia phả" />);
      const g = Array.from(container.querySelectorAll('g[transform*="scale("]')).find((e) => /^translate\([^)]*\) scale\(/.test(e.getAttribute('transform')!))!;
      const [, , oy, k] = g.getAttribute('transform')!.match(/translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
      const ys = Array.from(g.children).map((c) => c.getAttribute('transform')?.match(/translate\([-\d.e]+ ([-\d.e]+)\)/)?.[1]).filter(Boolean).map(Number);
      unmount();
      return oy! + Math.min(...ys) * k!;
    };
    const top = treeTop(theme);
    expect(top).toBeGreaterThan(b.topMm + h * b.treeFrom!);
    // Without it the tree area begins under the tails: the (centred) tree sits lower.
    expect(top).toBeLessThan(treeTop({ ...theme, titleBoard: { ...b, treeFrom: undefined } }));
  });
});

describe('title fitted from its ink inside the board (D79)', () => {
  const font = { family: 'X', weight: 700, sizePt: 80 };
  // Capitals with tone marks reach high above the baseline (Ả, Ị).
  const title: BoardLine = { text: 'GIA PHẢ HỌ TRỊNH', font, em: 9, above: 1.0, below: 0.22 };
  const sub: BoardLine = { text: 'Đời thứ nhất đến đời thứ bảy', font, em: 14, above: 0.95, below: 0.25 };
  const tb = { x: 100, y: 50, w: 150, h: 28 };
  const rise = (r: number, w: number) => Math.abs(r) - Math.sqrt(r * r - (w / 2) ** 2);

  for (const radius of [null, -800, 800]) {
    it(`keeps every line, tone marks and arc included, inside the box with a margin (arc ${radius ?? 'none'})`, () => {
      const f = fitBoardText(tb, title, sub, 80 * 0.3528, radius);
      const tRise = radius ? rise(radius, f.titleSize * title.em) : 0;
      const sRise = radius ? rise(radius, f.subSize * sub.em) : 0;
      const inkTop = f.titleY - f.titleSize * title.above - (radius && radius < 0 ? tRise : 0);
      const inkBottom = f.subY + f.subSize * sub.below + (radius && radius > 0 ? sRise : 0);
      expect(inkTop).toBeGreaterThanOrEqual(tb.y + tb.h * 0.07 - 1e-6);
      expect(inkBottom).toBeLessThanOrEqual(tb.y + tb.h * 0.93 + 1e-6);
      // Centred: the same room above and below the block.
      expect(inkTop - tb.y).toBeCloseTo(tb.y + tb.h - inkBottom, 5);
      // The two lines do not touch, and both fit the width.
      expect(f.subY - f.subSize * sub.above).toBeGreaterThan(f.titleY + f.titleSize * title.below);
      expect(f.titleSize * title.em).toBeLessThanOrEqual(tb.w * 0.92 + 1e-6);
      expect(f.subSize * sub.em).toBeLessThanOrEqual(tb.w * 0.92 + 1e-6);
      expect(f.subSize).toBeLessThanOrEqual(f.titleSize * 0.5 + 1e-6);
    });
  }
});

describe('the PDF draws what the screen shows (D82)', () => {
  it('narrows long words with a transform the PDF export understands, never textLength', () => {
    for (const theme of PRINT_THEMES) {
      const { container, unmount } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
      expect(container.querySelector('[textLength], [lengthAdjust]'), theme.id).toBeNull();
      // Narrowed words keep their centre: x stays at the card's middle under a pure x-scale.
      for (const t of Array.from(container.querySelectorAll('text[transform^="matrix("]'))) {
        const [k, b, c, d, e, f] = t.getAttribute('transform')!.slice(7, -1).split(' ').map(Number);
        expect(k).toBeGreaterThan(0);
        expect(k).toBeLessThan(1);
        expect([b, c, d, f]).toEqual([0, 0, 1, 0]);
        const x = Number(t.getAttribute('x'));
        expect(k! * x + e!).toBeCloseTo(x, 6);
      }
      unmount();
    }
  });
});

describe('the founder on the sheet\'s axis (D81)', () => {
  const area = { x: 38, w: 765 };
  const axis = 420.5;

  it('shrinks a slightly lopsided tree a little so the founder sits under the title', () => {
    // Founder at 550 of a 0–1000 tree: needs about 9% shrink to stand on the axis.
    const p = placeTree(area, { minX: 0, maxX: 1000 }, 550, 0.765, axis);
    expect(p.scale).toBeLessThan(0.765);
    expect(axis - 550 * p.scale - p.ox).toBeCloseTo(0, 6);
    expect(p.ox).toBeGreaterThanOrEqual(area.x - 1e-6); // left edge inside
    expect(p.ox + 1000 * p.scale).toBeLessThanOrEqual(area.x + area.w + 1e-6);
    expect(p.scale).toBeGreaterThanOrEqual(0.765 * 0.9 - 1e-9);
  });

  it('a very lopsided tree keeps its size and stays inside, the founder as near the axis as it can', () => {
    const p = placeTree(area, { minX: 0, maxX: 1000 }, 900, 0.765, axis);
    expect(p.scale).toBe(0.765);
    expect(p.ox).toBeCloseTo(area.x, 6);
  });

  it('a narrow tree is simply centred on the founder', () => {
    const p = placeTree(area, { minX: 0, maxX: 400 }, 100, 0.36, axis);
    expect(p.scale).toBe(0.36);
    expect(p.ox + 100 * 0.36).toBeCloseTo(axis, 6);
  });

  it('on the A1 sheet the founder card is under the middle of the title board', () => {
    const theme = getTheme('do-son-sen-vang')!;
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
    const g = Array.from(container.querySelectorAll('g[transform*="scale("]')).find((e) => /^translate\([^)]*\) scale\(/.test(e.getAttribute('transform')!))!;
    const [, ox, , k] = g.getAttribute('transform')!.match(/translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
    const top = Math.min(...layout.nodes.map((n) => n.y));
    const roots = layout.nodes.filter((n) => n.y === top);
    const rootCx = (Math.min(...roots.map((n) => n.x)) + Math.max(...roots.map((n) => n.x + n.w))) / 2;
    expect(ox! + rootCx * k!).toBeCloseTo(841 / 2, 0);
  });
});

describe('lettering in the material of its board (D80)', () => {
  it('engraved: a dark rim to the upper left and a light one to the lower right, under the text', () => {
    const fx = { style: 'engraved' as const, light: '#ffffff', dark: '#000000', depth: 0.02, opacity: 0.8 };
    const { container } = render(
      <svg>
        <Relief fx={fx} size={50} draw={(fill) => <text fill={fill ?? '#4a2a0c'}>Gia phả</text>} />
      </svg>,
    );
    const texts = Array.from(container.querySelectorAll('text'));
    expect(texts.map((t) => t.getAttribute('fill'))).toEqual(['#000000', '#ffffff', '#4a2a0c']);
    const [up, down] = Array.from(container.querySelectorAll('g'));
    expect(up!.getAttribute('transform')).toBe('translate(-1 -1)');
    expect(down!.getAttribute('transform')).toBe('translate(1 1)');
    expect(up!.getAttribute('aria-hidden')).toBe('true');
    expect(up!.getAttribute('opacity')).toBe('0.8');
  });

  it('raised: the light rim to the upper left; no relief, just the text', () => {
    const fx = { style: 'raised' as const, light: '#ffffff', dark: '#000000', depth: 0.02 };
    const { container } = render(<svg><Relief fx={fx} size={50} draw={(fill) => <text fill={fill ?? 'red'}>A</text>} /></svg>);
    expect(Array.from(container.querySelectorAll('text')).map((t) => t.getAttribute('fill'))).toEqual(['#ffffff', '#000000', 'red']);
    const plain = render(<svg><Relief size={50} draw={(fill) => <text fill={fill ?? 'red'}>A</text>} /></svg>);
    expect(plain.container.querySelectorAll('text')).toHaveLength(1);
  });

  it('"Đỏ son sen vàng": title engraved into the ribbon, names raised on the cards', () => {
    const theme = getTheme('do-son-sen-vang')!;
    expect(theme.textRelief?.title?.style).toBe('engraved');
    expect(theme.textRelief?.name?.style).toBe('raised');
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" subtitle="Đời thứ nhất" />);
    // One readable title line, plus two hidden rims.
    expect(container.querySelectorAll('g[aria-label="GIA PHẢ"]')).toHaveLength(1);
    const rims = Array.from(container.querySelectorAll('g[aria-hidden="true"] text'));
    expect(rims.some((t) => t.getAttribute('fill') === theme.textRelief!.title!.dark)).toBe(true);
    expect(rims.some((t) => t.getAttribute('fill') === theme.textRelief!.name!.light)).toBe(true);
  });

  it('keeps the name on its own line on wide cards, above years and spouses', () => {
    const theme = getTheme('do-son-sen-vang')!;
    const { container } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
    const names = Array.from(container.querySelectorAll('text[font-size="15"]')).filter((t) => !t.closest('[aria-hidden="true"]'));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const y = Number(name.getAttribute('y'));
      const below = Array.from(name.parentElement!.querySelectorAll(':scope > text')).filter((t) => t !== name && ['11', '11.5'].includes(t.getAttribute('font-size')!));
      for (const t of below) expect(Number(t.getAttribute('y')), t.textContent!).toBeGreaterThan(y);
    }
  });
});

describe('print sheet details (D74)', () => {
  it('shows no generation labels ("Đời 1…") on any print theme', () => {
    for (const theme of PRINT_THEMES) {
      const { container, unmount } = render(<PosterSvg theme={theme} model={model} layout={layout} title="Gia phả" />);
      const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent ?? '');
      expect(texts.some((t) => /^Đời \d+$/.test(t)), theme.id).toBe(false);
      // …nor the faint bands behind every other generation (D77).
      expect(container.querySelector(`rect[fill="${theme.colors.generationBand}"]`), theme.id).toBeNull();
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
