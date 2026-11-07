import base from '../son-mai-vang/theme';
import type { Theme } from '../types';
import board from './bang-tieu-de.png';
import frame from './khung-a1.jpg';

/**
 * "Đỏ son sen vàng" (D78): a cinnabar-red sheet with a faint wave pattern, a double gold
 * border, gilded relief lotuses in the four corners (upright ones at the bottom) and a
 * row of relief lotuses along the foot (khung-a1.jpg, A1 landscape, 5600 × 3955 px
 * ≈ 169 dpi). The title layer (bang-tieu-de.png, transparent) is the Buddha in relief on
 * a lotus throne above a glossy gold silk ribbon whose two tails fly down at the sides;
 * the title and subtitle are written in bronze brown on the ribbon's flat face, bent
 * along its sag, the title in spaced capitals. No couplets. Noto Serif Display for the
 * title, Prata for the subtitle, Literata for names and years, on deep red cards with
 * light gold lettering.
 */
const theme: Theme = {
  ...base,
  id: 'do-son-sen-vang',
  name: 'Đỏ son sen vàng',
  description:
    'Nền đỏ son, sen phù điêu mạ vàng bốn góc và dọc chân khung, Đức Phật ngồi trên băng lụa vàng óng; chữ tiêu đề nhập tùy ý.',
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wght@800&family=Prata&family=Literata:wght@400;600&display=swap&subset=vietnamese',
  typography: {
    // Capitals, slightly spaced, bent along the ribbon's sag (D78).
    title: { family: 'Noto Serif Display', weight: 800, sizePt: 80, letterSpacing: 0.06, uppercase: true },
    heading: { family: 'Prata', weight: 400, sizePt: 26 },
    name: { family: 'Literata', weight: 600, sizePt: 11 },
    body: { family: 'Literata', weight: 400, sizePt: 8 },
    couplet: { family: 'Prata', weight: 400, sizePt: 40 },
  },
  colors: {
    ...base.colors,
    background: '#9e1b1e',
    surface: '#4f0b0e',
    frame: '#b8862b',
    frameInner: '#e2b75a',
    line: '#d9a640',
    textPrimary: '#ffe4a0',
    textSecondary: '#e8c88c',
    male: '#ffe4a0',
    female: '#ffcf8f',
    spouse: '#e8c88c',
    deceased: '#d8bf95',
    accent: '#e2b75a',
    bannerText: '#4a2a0c',
    coupletText: '#ffe4a0',
  },
  node: { ...base.node, fill: '#4f0b0e', borderWidth: 0.45 },
  connector: { ...base.connector, color: '#d9a640', width: 0.45 },
  // The picture is the frame: no drawn border, corners, texture or ornaments.
  frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
  backgroundTexture: undefined,
  ornaments: { showCouplets: false },
  backgroundImage: { href: frame, fit: 'stretch' },
  titleBoard: {
    href: board,
    aspect: 721 / 1474,
    topMm: 8,
    widthMm: 400,
    // The ribbon's flat face, between its rolled ends and below the lotus throne.
    textBox: { top: 0.545, bottom: 0.69, left: 0.31, right: 0.69 },
    // The ribbon sags between its rolls: its lower edge drops 0.8% of the board width over
    // ±18% from the middle, a circle of ~2 board widths whose centre is above (negative).
    arcRadius: -2.0,
    // The ribbon ends at ~72% of the layer; below it only the two tails hang at the sides.
    // A little lower than that so the outer cards of the second generation clear the tails.
    treeFrom: 0.85,
  },
  // Inside the corner lotuses and above the lotus row at the foot.
  contentInsetMm: { top: 8, right: 38, bottom: 38, left: 38 },
  preferredOrientation: 'landscape',
};
export default theme;
