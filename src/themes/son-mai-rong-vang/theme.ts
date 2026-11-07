import base from '../son-mai-vang/theme';
import type { Theme } from '../types';
import board from './bang-tieu-de.png';
import frame from './khung-a1.jpg';

/**
 * "Sơn mài rồng vàng" (D72): the first frame preset designed in Canva. A dark lacquer
 * sheet with a gilded double border, dragons and clouds in the corners, the Đông Sơn drum
 * in the middle and two empty couplet boards at the sides (khung-a1.jpg, A1 landscape,
 * 5600 × 3955 px ≈ 169 dpi; the drum was made 20% clearer in D74). The title scroll is its own layer
 * (bang-tieu-de.png, transparent) so the title can be typed on the print page.
 * Colours are the preset's design tokens. Lettering is soft and flowing (D73):
 * Dancing Script, a calligraphic script, for the title, bent along the scroll's arch;
 * Lora italic for names and years, gentle yet readable at the size of the cards.
 * The couplets are written by the app on the painted boards in Water Brush, a brush
 * calligraphy face (D74): the clan's own couplets, or the preset's when it has none.
 */
const theme: Theme = {
  ...base,
  id: 'son-mai-rong-vang',
  name: 'Sơn mài rồng vàng',
  description:
    'Nền sơn mài tối, viền vàng kép, rồng và mây vàng ở bốn góc, câu đối thư pháp hai bên; cuốn thư tiêu đề mạ vàng, chữ tiêu đề nhập tùy ý.',
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Water+Brush&family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap&subset=vietnamese',
  typography: {
    title: { family: 'Dancing Script', weight: 700, sizePt: 72 },
    heading: { family: 'Dancing Script', weight: 600, sizePt: 24 },
    name: { family: 'Lora', weight: 600, sizePt: 11, italic: true },
    body: { family: 'Lora', weight: 400, sizePt: 8, italic: true },
    couplet: { family: 'Water Brush', weight: 400, sizePt: 56 },
  },
  colors: {
    ...base.colors,
    background: '#1a1210',
    surface: '#241915',
    frame: '#d4af37',
    frameInner: '#f1d98a',
    line: '#a67c1b',
    textPrimary: '#f1d98a',
    textSecondary: '#c9b37e',
    male: '#f1d98a',
    female: '#e8c37a',
    spouse: '#c9b37e',
    deceased: '#c9b37e',
    accent: '#d4af37',
    bannerText: '#f1d98a',
    coupletText: '#f1d98a',
  },
  node: { ...base.node, fill: '#241915', borderWidth: 0.45 },
  connector: { ...base.connector, color: '#a67c1b', width: 0.45 },
  // The picture is the frame: no drawn border, corners, texture or ornaments.
  frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
  backgroundTexture: undefined,
  ornaments: { showCouplets: true },
  // The text area of the two painted couplet boards (between their end caps).
  coupletBoxes: {
    left: { x: 65.3, y: 186.8, w: 30.8, h: 208.5 },
    right: { x: 744.9, y: 186.8, w: 30.8, h: 208.5 },
    defaultText: { left: 'Cây có cội mới nảy cành xanh ngọn', right: 'Nước có nguồn mới bể rộng sông sâu' },
  },
  backgroundImage: { href: frame, fit: 'stretch' },
  titleBoard: {
    href: board,
    aspect: 627 / 2042,
    topMm: 36.9,
    widthMm: 306.7,
    textBox: { top: 0.18, bottom: 0.76, left: 0.17, right: 0.83 },
    // The scroll arches by ~7 mm over ±92 mm from its middle: a circle of ~600 mm.
    arcRadius: 1.96,
  },
  // Below the title, between the painted couplet boards (they end at 100 / 741 mm).
  contentInsetMm: { top: 36.9, right: 110, bottom: 36, left: 110 },
  preferredOrientation: 'landscape',
};
export default theme;
