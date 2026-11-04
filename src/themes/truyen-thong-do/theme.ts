import type { Theme } from '../types';
import banner from './ornaments/banner.svg?raw';
import corner from './ornaments/corner.svg?raw';
import hoiVan from './ornaments/hoi-van.svg?raw';
import mai from './ornaments/mai.svg?raw';

const serif = 'Noto Serif';
const theme: Theme = {
  id: 'truyen-thong-do',
  name: 'Truyền thống đỏ',
  description: 'Giấy kem, khung đỏ son viền hồi văn vàng, băng tiêu đề cuộn thư, câu đối đỏ và cành mai vàng.',
  usage: ['print'],
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Noto+Serif+Display:wght@700;800&display=swap&subset=vietnamese',
  colors: {
    background: '#f8f0dc',
    surface: '#fffaf0',
    frame: '#b3261e',
    frameInner: '#d4a017',
    line: '#7a5638',
    textPrimary: '#3a2216',
    textSecondary: '#6b4e3a',
    male: '#1f4e9c',
    female: '#b3261e',
    spouse: '#2e7d32',
    deceased: '#6b4e3a',
    accent: '#b3261e',
    generationBand: 'rgb(179 38 30 / 6%)',
    coupletBoard: '#b3261e',
    coupletText: '#fbe7a1',
    bannerText: '#fbe7a1',
  },
  typography: {
    title: { family: 'Noto Serif Display', weight: 800, sizePt: 72, letterSpacing: 0.02 },
    heading: { family: serif, weight: 700, sizePt: 22 },
    name: { family: serif, weight: 700, sizePt: 11 },
    body: { family: serif, weight: 400, sizePt: 8 },
    couplet: { family: serif, weight: 700, sizePt: 30 },
  },
  node: { radius: 1.5, borderWidth: 0.5, borderStyle: 'double', fill: '#fffaf0', orientation: 'auto', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.5, color: '#7a5638' },
  frame: { enabled: true, borderSvg: hoiVan, cornerSvg: corner, thicknessMm: 16 },
  ornaments: {
    titleBanner: banner,
    showCouplets: true,
    decorations: [
      { svg: mai, position: 'top-left', widthMm: 120 },
      { svg: mai, position: 'top-right', widthMm: 120 },
    ],
  },
};
export default theme;
