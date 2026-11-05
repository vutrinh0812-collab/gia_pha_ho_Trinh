import type { Theme } from '../types';

/** The screen theme (design "Ember", DECISIONS D51). Its live tokens are in src/styles.css. */
const theme: Theme = {
  id: 'ember',
  name: 'Ember (màn hình)',
  description: 'Giao diện xem trên điện thoại và máy tính: nâu đất Burnt Sienna trên nền kem ấm, chữ Inter.',
  usage: ['screen'],
  fontsCss: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap&subset=vietnamese',
  colors: {
    background: '#f5f0e9',
    surface: '#fffcf8',
    frame: '#bd5f3c',
    line: '#dccbb8',
    textPrimary: '#333333',
    textSecondary: '#6b625b',
    male: '#333333',
    female: '#333333',
    spouse: '#5a4f48',
    deceased: '#6f6862',
    accent: '#a9532f',
    generationBand: '#f3ebe1',
  },
  typography: {
    title: { family: 'Inter', weight: 700, sizePt: 48 },
    heading: { family: 'Inter', weight: 600, sizePt: 20 },
    name: { family: 'Inter', weight: 600, sizePt: 11 },
    body: { family: 'Inter', weight: 400, sizePt: 8 },
    couplet: { family: 'Inter', weight: 500, sizePt: 26 },
  },
  node: { radius: 3, borderWidth: 0.4, borderStyle: 'single', fill: '#fffcf8', orientation: 'horizontal', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.4, color: '#dccbb8' },
  frame: { enabled: false, thicknessMm: 0 },
  ornaments: { showCouplets: false },
};
export default theme;
