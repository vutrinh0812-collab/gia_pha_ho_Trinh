import base from '../son-mai-base';
import type { Theme } from '../types';
import frame from './khung-a1.jpg';

/**
 * "Gấm lam mai sen" (D97), after a picture the user chose: a wide navy brocade border with
 * faint gold flowers, thin gold rules and gold key-fret (lôi văn) corner pieces around a
 * cream dó paper; a branch of red plum and pink magnolia reaches in from the top left and
 * a lotus clump grows in at the bottom right (khung-a1.jpg, A1 landscape, 5600 × 3955 px
 * ≈ 169 dpi). No title board and no couplets: the title is written straight on the paper
 * in navy ink (Alex Brush), the subtitle in bronze (Playfair Display italic). Ivory cards
 * with navy rims, names in navy (women in deep red), Playfair Display italic. Flat ink:
 * no relief on the lettering.
 */
const theme: Theme = {
  ...base,
  id: 'gam-lam-mai-sen',
  name: 'Gấm lam mai sen',
  description:
    'Viền gấm lam hoa chìm, ke góc lôi văn vàng, giấy dó ngà; cành mai đỏ và mộc lan góc trên, đầm sen góc dưới; tiêu đề thư pháp mực lam.',
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Alex+Brush&family=Playfair+Display:ital,wght@1,400;1,600&display=swap&subset=vietnamese',
  typography: {
    title: { family: 'Alex Brush', weight: 400, sizePt: 150 },
    heading: { family: 'Playfair Display', weight: 400, sizePt: 48, italic: true },
    name: { family: 'Playfair Display', weight: 600, sizePt: 11, italic: true },
    body: { family: 'Playfair Display', weight: 400, sizePt: 8, italic: true },
    couplet: { family: 'Alex Brush', weight: 400, sizePt: 40 },
  },
  colors: {
    ...base.colors,
    background: '#efe3c6',
    surface: '#f8f0dc',
    frame: '#1f3a6e',
    frameInner: '#b8923f',
    line: '#8a7448',
    textPrimary: '#1b2a4e',
    textSecondary: '#6b5634',
    male: '#1b2a4e',
    female: '#8c2a2a',
    spouse: '#3e4f72',
    deceased: '#55524c',
    accent: '#b8923f',
    generationBand: 'rgb(31 58 110 / 4%)',
    bannerText: '#1b2a4e',
    coupletText: '#1b2a4e',
  },
  node: { ...base.node, fill: '#f8f0dc', borderWidth: 0.45 },
  connector: { ...base.connector, color: '#8a7448', width: 0.45 },
  // The picture is the frame: no drawn border, corners, texture or ornaments.
  frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
  backgroundTexture: undefined,
  ornaments: { showCouplets: false },
  backgroundImage: { href: frame, fit: 'stretch' },
  // Centred between the plum branch (it ends ~245 mm from the left) and its mirror.
  plainTitle: { widthMm: 330, maxSizeMm: 50 },
  // The paper inside the gold rule: 55 mm from the sides, 60 from the top, 53 from the foot.
  contentInsetMm: { top: 64, right: 60, bottom: 58, left: 60 },
  preferredOrientation: 'landscape',
};
export default theme;
