import base from '../son-mai-vang/theme';
import type { Theme } from '../types';
import board from './bang-tieu-de.png';
import frame from './khung-a1.jpg';

/**
 * "Sơn mài rồng vàng" (D72): the first frame preset designed in Canva. A dark lacquer
 * sheet with a gilded double border, dragons and clouds in the corners, the Đông Sơn drum
 * faintly in the middle and the two couplets painted on side boards (khung-a1.jpg, A1
 * landscape, 5600 × 3955 px ≈ 169 dpi). The title scroll is its own layer
 * (bang-tieu-de.png, transparent) so the title can be typed on the print page.
 * Colours are the preset's design tokens; fonts and everything else come from
 * "Sơn mài vàng".
 */
const theme: Theme = {
  ...base,
  id: 'son-mai-rong-vang',
  name: 'Sơn mài rồng vàng',
  description:
    'Nền sơn mài tối, viền vàng kép, rồng và mây vàng ở bốn góc, câu đối vẽ sẵn hai bên; cuốn thư tiêu đề mạ vàng, chữ tiêu đề nhập tùy ý.',
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
  },
  node: { ...base.node, fill: '#241915', borderWidth: 0.45 },
  connector: { ...base.connector, color: '#a67c1b', width: 0.45 },
  // The picture is the frame: no drawn border, corners, texture or ornaments.
  frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
  backgroundTexture: undefined,
  ornaments: { showCouplets: false },
  backgroundImage: { href: frame, fit: 'stretch' },
  titleBoard: {
    href: board,
    aspect: 627 / 2042,
    topMm: 36.9,
    widthMm: 306.7,
    textBox: { top: 0.18, bottom: 0.76, left: 0.17, right: 0.83 },
  },
  // Below the title, between the painted couplet boards (they end at 100 / 741 mm).
  contentInsetMm: { top: 36.9, right: 110, bottom: 36, left: 110 },
  preferredOrientation: 'landscape',
};
export default theme;
