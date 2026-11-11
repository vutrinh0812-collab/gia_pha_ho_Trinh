import type { Theme } from '../types';
import frame from './khung-a1.jpg';
import coupletLeft from './thu-phap-doi-trai.png';
import coupletRight from './thu-phap-doi-phai.png';
import titleArt from './thu-phap-tieu-de.png';

/**
 * "Hoa điểu trên lụa" (D89): a print theme after a flower-and-bird painting on silk
 * (tranh hoa điểu thủy mặc), with Vietnamese calligraphy in place of the painting's
 * Chinese inscription.
 *
 * - Ground: unbleached ivory silk with a fine weave, drawn at print size (5600 × 3955 px);
 *   no frame, the painting breathes to its edges.
 * - Painting: a branch of red flowers with two small birds out of the top left corner, an
 *   ink rock with red plum, bamboo and two magpies in the bottom right corner (painted on
 *   Canva, cut out and laid on the silk), kept small so the tree has the room.
 * - Lettering: hand-written brush calligraphy as pictures (dry brush, ink black): the
 *   title "Gia Phả Họ Trịnh" and the couplet "Hoa thơm đất cũ hương còn mãi / Chim hót
 *   cành xưa nhớ cội nguồn", one word per line. The couplet is always this one, whatever
 *   the clan's; the title picture is used only while the title is exactly its words, any
 *   other title is typed in Water Brush. A vermilion seal beside the
 *   title; names in Lora.
 * A1 landscape, 841 × 594 mm.
 */
const COUPLET_LEFT = 'Hoa thơm đất cũ hương còn mãi';
const COUPLET_RIGHT = 'Chim hót cành xưa nhớ cội nguồn';

const theme: Theme = {
  id: 'hoa-dieu-lua',
  name: 'Hoa điểu trên lụa',
  description:
    'Nền lụa mộc màu ngà, không khung; góc trên trái cành hoa đỏ có đôi chim, góc dưới phải đá mực với mai đỏ, trúc và đôi chim ác là. Tiêu đề và câu đối viết thư pháp bút lông, con dấu son cạnh tiêu đề.',
  usage: ['print'],
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Water+Brush&family=Lora:wght@400;600;700&display=swap&subset=vietnamese',
  colors: {
    background: '#eadcb6',
    surface: '#f3e8cc',
    frame: '#3b342b',
    line: '#6b5d48',
    textPrimary: '#2a241d',
    textSecondary: '#5c5142',
    male: '#2a241d',
    female: '#a3412b',
    spouse: '#3f6650',
    deceased: '#5c5142',
    accent: '#b8352a',
    generationBand: 'rgb(42 36 29 / 4%)',
    coupletBoard: 'transparent',
    coupletText: '#2a241d',
    bannerText: '#2a241d',
  },
  typography: {
    title: { family: 'Water Brush', weight: 400, sizePt: 84, letterSpacing: 0.03 },
    heading: { family: 'Water Brush', weight: 400, sizePt: 46 },
    name: { family: 'Lora', weight: 600, sizePt: 11 },
    body: { family: 'Lora', weight: 400, sizePt: 8 },
    couplet: { family: 'Water Brush', weight: 400, sizePt: 54 },
  },
  node: { radius: 1.5, borderWidth: 0.35, borderStyle: 'single', fill: '#f3e8cc', orientation: 'auto', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.4, color: '#6b5d48' },
  frame: { enabled: false, thicknessMm: 0 },
  ornaments: { showCouplets: true, seal: { color: '#b8352a' } },
  backgroundImage: { href: frame, fit: 'stretch' },
  lettering: {
    title: { href: titleArt, aspect: 487 / 1772, text: 'Gia Phả Họ Trịnh', topMm: 22, widthMm: 220 },
    couplets: {
      left: { href: coupletLeft, aspect: 1657 / 625, text: COUPLET_LEFT },
      right: { href: coupletRight, aspect: 1674 / 606, text: COUPLET_RIGHT },
      // Chosen for this painting: printed even when the clan has couplets of its own.
      always: true,
    },
  },
  // Couplets written straight on the silk, as in the painting: left under the branch,
  // right high up, clear of the bamboo (mm on the A1 landscape sheet).
  coupletBoxes: {
    left: { x: 28, y: 190, w: 72, h: 236 },
    right: { x: 741, y: 30, w: 72, h: 236 },
    defaultText: { left: COUPLET_LEFT, right: COUPLET_RIGHT },
  },
  // The tree stays between the two couplet columns.
  contentInsetMm: { top: 100, right: 112, bottom: 20, left: 112 },
  preferredOrientation: 'landscape',
};
export default theme;
