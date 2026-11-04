import type { Theme } from '../types';
import banner from './ornaments/banner.svg?raw';
import cloud from './ornaments/cloud.svg?raw';
import corner from './ornaments/corner.svg?raw';
import lotusPond from './ornaments/lotus-pond.svg?raw';
import vine from './ornaments/vine.svg?raw';

const theme: Theme = {
  id: 'men-lam',
  name: 'Men lam',
  description: 'Trắng men sứ và xanh lam như gốm Bát Tràng: viền dây sen, mây cuộn ở góc, đầm sen dưới chân bản gia phả.',
  usage: ['print'],
  fontsCss:
    'https://fonts.googleapis.com/css2?family=Prata&family=Literata:wght@400;600;700&display=swap&subset=vietnamese',
  colors: {
    background: '#f7f9fc',
    surface: '#ffffff',
    frame: '#1f3f8f',
    frameInner: '#1f3f8f',
    line: '#3a5ba8',
    textPrimary: '#14244f',
    textSecondary: '#3d4d73',
    male: '#1f3f8f',
    female: '#9a2f45',
    spouse: '#3d6b5c',
    deceased: '#3d4d73',
    accent: '#1f3f8f',
    generationBand: 'rgb(31 63 143 / 5%)',
    coupletBoard: '#1f3f8f',
    coupletText: '#f7f9fc',
    bannerText: '#f7f9fc',
  },
  typography: {
    title: { family: 'Prata', weight: 400, sizePt: 66 },
    heading: { family: 'Prata', weight: 400, sizePt: 22 },
    name: { family: 'Literata', weight: 700, sizePt: 11 },
    body: { family: 'Literata', weight: 400, sizePt: 8 },
    couplet: { family: 'Prata', weight: 400, sizePt: 30 },
  },
  node: { radius: 3, borderWidth: 0.45, borderStyle: 'single', fill: '#ffffff', orientation: 'auto', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.45, color: '#3a5ba8' },
  frame: { enabled: true, borderSvg: vine, cornerSvg: corner, thicknessMm: 12 },
  ornaments: {
    titleBanner: banner,
    showCouplets: true,
    decorations: [
      { svg: cloud, position: 'top-left', widthMm: 90 },
      { svg: cloud, position: 'top-right', widthMm: 90 },
      { svg: lotusPond, position: 'bottom', widthMm: 150 },
    ],
  },
};
export default theme;
