import type { Theme } from '../types';
import banner from './ornaments/banner.svg?raw';
import clouds from './ornaments/clouds.svg?raw';
import corner from './ornaments/corner.svg?raw';
import lotus from './ornaments/lotus.svg?raw';
import mountains from './ornaments/mountains.svg?raw';
import van from './ornaments/van.svg?raw';

const theme: Theme = {
  id: 'son-mai-vang',
  name: 'Sơn mài vàng',
  description: 'Nền đen nâu như tranh sơn mài, chữ và khung vàng kim, mây cuộn, hoa sen và núi mờ ở nền, câu đối chữ thư pháp.',
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
  frame: { enabled: true, borderSvg: van, cornerSvg: corner, thicknessMm: 14 },
  ornaments: {
    titleBanner: banner,
    showCouplets: true,
    decorations: [
      { svg: clouds, position: 'top-left', widthMm: 110, opacity: 0.8 },
      { svg: clouds, position: 'top-right', widthMm: 110, opacity: 0.8 },
      { svg: lotus, position: 'bottom', widthMm: 90 },
      { svg: mountains, position: 'background' },
    ],
  },
};
export default theme;
