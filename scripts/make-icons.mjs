/**
 * Renders the app icons and the Open Graph preview image to PNG (public/).
 * Needs Playwright with Chromium:  node scripts/make-icons.mjs
 * Title comes from VITE_APP_TITLE in .env (default "Gia Phả Họ Trịnh").
 * All artwork is original: a simple "family tree" mark drawn with lines and dots.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

if (existsSync('.env')) process.loadEnvFile('.env');
const title = process.env.VITE_APP_TITLE?.trim() || 'Gia Phả Họ Trịnh';

// Design "Ember" (DECISIONS D51): Burnt Sienna to Terracotta, Sandy Cream mark, Amber rim.
const RED = '#bd5f3c';
const RED_DARK = '#a04b2a';
const CREAM = '#f5e6d3';
const GOLD = '#f6a14b';

/** The mark: an ancestor dot, a trunk, a bar and three descendant dots. `s` = size of the drawing box. */
const mark = (s, stroke = CREAM, dot = CREAM) => `
  <g fill="none" stroke="${stroke}" stroke-width="${s * 0.055}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${s * 0.5} ${s * 0.3} V${s * 0.5} M${s * 0.24} ${s * 0.66} V${s * 0.5} H${s * 0.76} V${s * 0.66} M${s * 0.5} ${s * 0.5} V${s * 0.66}"/>
  </g>
  <g fill="${dot}">
    <circle cx="${s * 0.5}" cy="${s * 0.25}" r="${s * 0.085}"/>
    <circle cx="${s * 0.24}" cy="${s * 0.73}" r="${s * 0.07}"/>
    <circle cx="${s * 0.5}" cy="${s * 0.73}" r="${s * 0.07}"/>
    <circle cx="${s * 0.76}" cy="${s * 0.73}" r="${s * 0.07}"/>
  </g>`;

const icon = (size, { maskable = false } = {}) => {
  const pad = maskable ? size * 0.18 : size * 0.1;
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RED}"/><stop offset="1" stop-color="${RED_DARK}"/></linearGradient></defs>
    <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="url(#g)"/>
    <rect x="${size * 0.06}" y="${size * 0.06}" width="${size * 0.88}" height="${size * 0.88}" rx="${size * 0.17}" fill="none" stroke="${GOLD}" stroke-opacity="${maskable ? 0 : 0.55}" stroke-width="${size * 0.012}"/>
    <g transform="translate(${pad},${pad})">${mark(inner)}</g>
  </svg>`;
};

const og = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap&subset=vietnamese">
<style>
  html,body{margin:0;width:1200px;height:630px}
  body{background:${CREAM};font-family:'Inter',system-ui,sans-serif;color:#333333;display:flex;align-items:center}
  .frame{position:absolute;inset:28px;border:6px solid ${RED};border-radius:8px}
  .frame::after{content:'';position:absolute;inset:10px;border:2px solid ${GOLD};border-radius:4px}
  .wrap{position:relative;display:flex;align-items:center;gap:60px;padding:0 100px}
  h1{margin:0;font-size:${title.length > 18 ? 64 : 80}px;line-height:1.1;font-weight:600;color:${RED};letter-spacing:-0.01em;text-wrap:balance}
  p{margin:22px 0 0;font-size:34px;font-weight:400;color:#6b625b}
</style></head><body>
<div class="frame"></div>
<div class="wrap">
  ${icon(260)}
  <div><h1>${title}</h1><p>Cây gia phả theo từng đời</p></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ['public/icons/icon-192.png', icon(192), 192],
  ['public/icons/icon-512.png', icon(512), 512],
  ['public/icons/icon-maskable-512.png', icon(512, { maskable: true }), 512],
  ['public/icons/apple-touch-icon.png', icon(180, { maskable: true }), 180],
];
for (const [file, svg, size] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true });
}
writeFileSync('public/favicon.svg', icon(64));
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('✓ icons and og-image.png written for:', title);
