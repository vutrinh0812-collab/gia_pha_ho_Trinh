import type { Theme } from './types';

/**
 * Shared lacquer palette, type and card style of the frame presets "Sơn mài rồng vàng"
 * (D72) and "Đỏ son sen vàng" (D78), which override what their pictures need. It was the
 * drawn theme "Sơn mài vàng", removed from the print page in D91; only its settings stay.
 */
const base: Theme = {
  id: 'son-mai',
  name: 'Sơn mài',
  description: '',
  usage: ['print'],
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Lora:wght@400;600;700&family=Dancing+Script:wght@600;700&display=swap&subset=vietnamese',
  colors: {
    background: '#1c120d',
    surface: '#2a1a12',
    frame: '#c9963a',
    frameInner: '#f0cf78',
    line: '#b9862f',
    textPrimary: '#f3dfa6',
    textSecondary: '#c9b07a',
    male: '#f6dc8c',
    female: '#f2b27a',
    spouse: '#b9d7a8',
    deceased: '#c9b07a',
    accent: '#e0b354',
    generationBand: 'rgb(240 207 120 / 5%)',
    coupletBoard: '#3a1a12',
    coupletText: '#f6dc8c',
    bannerText: '#f6dc8c',
  },
  typography: {
    title: { family: 'Playfair Display', weight: 700, sizePt: 68 },
    heading: { family: 'Playfair Display', weight: 600, sizePt: 22 },
    name: { family: 'Lora', weight: 700, sizePt: 11 },
    body: { family: 'Lora', weight: 400, sizePt: 8 },
    couplet: { family: 'Dancing Script', weight: 700, sizePt: 34 },
  },
  node: { radius: 2, borderWidth: 0.45, borderStyle: 'single', fill: '#2a1a12', orientation: 'auto', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.45, color: '#b9862f' },
  frame: { enabled: false, thicknessMm: 14 },
  ornaments: { showCouplets: true },
};
export default base;
