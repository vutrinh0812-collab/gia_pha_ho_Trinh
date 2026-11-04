import type { Theme } from '../types';

/** The screen theme (design "Sơn son", DECISIONS D36). Its live tokens are in src/styles.css. */
const theme: Theme = {
  id: 'son-son',
  name: 'Sơn son (màn hình)',
  description: 'Giao diện xem trên điện thoại và máy tính: một màu đỏ son, chữ Lexend dễ đọc, sáng và tối.',
  usage: ['screen'],
  fontsCss: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap&subset=vietnamese',
  colors: {
    background: '#fbf8f7',
    surface: '#ffffff',
    frame: '#a3271c',
    line: '#d8ccc9',
    textPrimary: '#1d1514',
    textSecondary: '#63575a',
    male: '#1d1514',
    female: '#1d1514',
    spouse: '#4a3f3e',
    deceased: '#6f6466',
    accent: '#a3271c',
    generationBand: '#f6efed',
  },
  typography: {
    title: { family: 'Lexend', weight: 600, sizePt: 48 },
    heading: { family: 'Lexend', weight: 600, sizePt: 20 },
    name: { family: 'Lexend', weight: 600, sizePt: 11 },
    body: { family: 'Lexend', weight: 400, sizePt: 8 },
    couplet: { family: 'Lexend', weight: 500, sizePt: 26 },
  },
  node: { radius: 2, borderWidth: 0.4, borderStyle: 'single', fill: '#ffffff', orientation: 'horizontal', paddingMm: 1.5 },
  connector: { style: 'orthogonal', width: 0.4, color: '#d8ccc9' },
  frame: { enabled: false, thicknessMm: 0 },
  ornaments: { showCouplets: false },
};
export default theme;
