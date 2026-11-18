import base from '../son-mai-base';
import type { Theme } from '../types';
import board from './bang-tieu-de.png';
import frame from './khung-a1.jpg';

/**
 * "Rồng phượng lôi văn" (D103): page 1 of the clan's own Canva sheet, rebuilt at A1 on a
 * copy (the original design is left untouched). Warm cream paper with a faint Đông Sơn
 * drum, a red meander (lôi văn) border with key corners and three medallions, a bronze
 * dragon top left and phoenix top right, gold waves along the foot, and two red couplet
 * scrolls whose gold brush calligraphy is painted into the picture ("Tổ Công Tông Đức
 * Thiên Niên Thịnh / Tử Hiếu Tôn Hiền Vạn Đại Vinh"), so the sheet always carries them
 * (khung-a1.jpg, A1 landscape, 5600 × 3955 px ≈ 169 dpi). The gilded cuốn thư is its own
 * layer (bang-tieu-de.png, transparent): title and subtitle are typed on the print page and
 * written in light gold on its red face, bent along its arch. Dancing Script for the
 * lettering, Noto Serif for names and years, on cream cards with red borders and lines,
 * as on the Canva page. No dedication line.
 */
const theme: Theme = {
  ...base,
  id: 'rong-phuong-loi-van',
  name: 'Rồng phượng lôi văn',
  description:
    'Nền kem trống đồng mờ, viền lôi văn đỏ, rồng phượng hai góc trên, sóng vàng chân khung, câu đối thư pháp vàng trên cuộn đỏ; cuốn thư mạ vàng, chữ tiêu đề nhập tùy ý.',
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Noto+Serif:wght@400;600;700&display=swap&subset=vietnamese',
  typography: {
    title: { family: 'Dancing Script', weight: 700, sizePt: 80 },
    heading: { family: 'Dancing Script', weight: 600, sizePt: 48 },
    name: { family: 'Noto Serif', weight: 700, sizePt: 11 },
    body: { family: 'Noto Serif', weight: 400, sizePt: 8 },
    couplet: { family: 'Dancing Script', weight: 700, sizePt: 40 },
  },
  colors: {
    ...base.colors,
    background: '#ffeb99',
    surface: '#fbefc4',
    frame: '#b3100c',
    frameInner: '#d4a94f',
    line: '#b3100c',
    textPrimary: '#5c0a07',
    textSecondary: '#7a4a22',
    male: '#8a0e0a',
    female: '#8a0e0a',
    spouse: '#5c3a1c',
    deceased: '#6b4a2a',
    accent: '#b3100c',
    generationBand: 'rgb(179 16 12 / 4%)',
    bannerText: '#fbe2a0',
    coupletText: '#f3d98b',
  },
  node: { ...base.node, fill: '#fbefc4', borderWidth: 0.45, radius: 0.6 },
  connector: { ...base.connector, color: '#b3100c', width: 0.5 },
  // The picture is the frame: no drawn border, corners, texture or ornaments. The couplets
  // are painted in it, so the app writes none.
  frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
  backgroundTexture: undefined,
  ornaments: { showCouplets: false },
  backgroundImage: { href: frame, fit: 'stretch' },
  titleBoard: {
    href: board,
    aspect: 958 / 1921,
    topMm: 65.5,
    widthMm: 288.5,
    // The red face of the scroll, between its two rolled ends.
    textBox: { top: 0.27, bottom: 0.58, left: 0.29, right: 0.71 },
    // The face arches up by ~6% of its height over ±20% of the width: a circle of ~0.7 widths.
    arcRadius: 0.7,
  },
  // Below the title, between the couplet scrolls (they end at 108 / 742 mm) and above the
  // inner border line at the foot (551 mm).
  contentInsetMm: { top: 65.5, right: 112, bottom: 46, left: 112 },
  preferredOrientation: 'landscape',
};
export default theme;
