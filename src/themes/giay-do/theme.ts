import type { Theme } from '../types';
import bamboo from './ornaments/bamboo.svg?raw';
import fibre from './ornaments/fibre.svg?raw';
import inkMountain from './ornaments/ink-mountain.svg?raw';

const garamond = 'Cormorant Garamond';
const theme: Theme = {
  id: 'giay-do',
  name: 'Giấy dó mực tàu',
  description: 'Nền giấy dó có thớ, chữ mực đen, khung kép mảnh, một con dấu triện đỏ khắc tên họ; thanh tĩnh như sách nho xưa.',
  usage: ['print'],
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&display=swap&subset=vietnamese',
  colors: {
    background: '#eee7d8',
    surface: '#f5f0e4',
    frame: '#1f1d1a',
    frameInner: '#1f1d1a',
    line: '#4a443c',
    textPrimary: '#1f1d1a',
    textSecondary: '#55504a',
    male: '#1f1d1a',
    female: '#8b2d1f',
    spouse: '#4f5a3c',
    deceased: '#55504a',
    accent: '#b8352a',
    generationBand: 'rgb(31 29 26 / 4%)',
    coupletBoard: 'transparent',
    coupletText: '#1f1d1a',
    bannerText: '#1f1d1a',
  },
  typography: {
    title: { family: garamond, weight: 700, sizePt: 76, letterSpacing: 0.04 },
    heading: { family: garamond, weight: 600, sizePt: 24 },
    name: { family: garamond, weight: 700, sizePt: 12 },
    body: { family: garamond, weight: 500, sizePt: 9 },
    couplet: { family: garamond, weight: 600, sizePt: 32, italic: true },
  },
  node: { radius: 0, borderWidth: 0.35, borderStyle: 'single', fill: '#f5f0e4', orientation: 'auto', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.35, color: '#4a443c' },
  frame: { enabled: true, thicknessMm: 6 },
  ornaments: {
    showCouplets: true,
    seal: { color: '#b8352a' },
    decorations: [
      { svg: bamboo, position: 'bottom-left', widthMm: 70 },
      { svg: inkMountain, position: 'background' },
    ],
  },
  backgroundTexture: fibre,
};
export default theme;
