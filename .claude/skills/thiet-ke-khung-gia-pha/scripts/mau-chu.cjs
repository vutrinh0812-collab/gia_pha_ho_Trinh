/**
 * Renders font-pair options (title / names / couplet) on the preset's colours, as one PNG,
 * so the user can choose lettering by eye. Fonts come from Google Fonts.
 *
 * Usage: node mau-chu.cjs spec.json out.png
 * spec.json: {
 *   "nen": "#1a1210", "chu": "#f1d98a", "phu": "#c9b37e",
 *   "tieuDe": "Gia Phả Họ Trịnh", "cauDoi": "Cây có cội mới nảy cành xanh ngọn",
 *   "phuongAn": [
 *     { "nhan": "A", "tieuDe": "Water Brush:400", "ten": "Lora:600i", "cauDoi": "Water Brush:400" },
 *     { "nhan": "B", "tieuDe": "Dancing Script:700", "ten": "Lora:400i", "cauDoi": "Dancing Script:700" },
 *     { "nhan": "C", "tieuDe": "Noto Serif Display:800", "ten": "Noto Serif:600", "cauDoi": "Prata:400" }
 *   ]
 * }
 * A face is "Family:weight" with an optional "i" for italic.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const [specPath, out] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const parse = (f) => {
  const [family, w = '400'] = f.split(':');
  return { family, weight: parseInt(w, 10), italic: w.endsWith('i') };
};
const faces = new Map();
for (const p of spec.phuongAn) for (const k of ['tieuDe', 'ten', 'cauDoi']) {
  const f = parse(p[k]);
  const list = faces.get(f.family) ?? new Set();
  list.add(`${f.italic ? 1 : 0},${f.weight}`);
  faces.set(f.family, list);
}
const css =
  'https://fonts.googleapis.com/css2?' +
  [...faces].map(([fam, set]) => `family=${fam.replace(/ /g, '+')}:ital,wght@${[...set].sort().join(';')}`).join('&') +
  '&display=block&subset=vietnamese';
const style = (f, size) =>
  `font-family:'${f.family}';font-weight:${f.weight};font-style:${f.italic ? 'italic' : 'normal'};font-size:${size}px`;
const card = (p) => {
  const t = parse(p.tieuDe), n = parse(p.ten), c = parse(p.cauDoi);
  const words = (spec.cauDoi || '').split(/\s+/).map((w) => `<div>${w}</div>`).join('');
  return `<section><h2>${p.nhan}</h2>
    <div class="title" style="${style(t, 64)}">${spec.tieuDe}</div>
    <div class="row"><div class="couplet" style="${style(c, 34)}">${words}</div>
    <div class="cards">${['Trịnh Công Nguyên', 'Trịnh Thị Thanh Thơm', 'Vợ: Dương Thị Thanh Loan']
      .map((x) => `<div class="card" style="${style(n, 22)}">${x}<small style="${style(n, 15)}">1818 – 1897</small></div>`).join('')}</div></div>
    <p>${p.tieuDe} · ${p.ten} · ${p.cauDoi}</p></section>`;
};
const html = `<link rel="stylesheet" href="${css}"><style>
  body{margin:0;background:#e9e4da;font-family:sans-serif;display:flex;gap:20px;padding:20px}
  section{background:${spec.nen};color:${spec.chu};padding:24px;border-radius:10px;width:560px}
  h2{margin:0 0 8px;font:700 34px sans-serif;color:${spec.phu}}
  .title{text-align:center;margin:8px 0 18px;line-height:1.2}
  .row{display:flex;gap:18px}.couplet{text-align:center;line-height:1.25;border:1px solid ${spec.phu};padding:8px 10px;border-radius:6px}
  .cards{display:flex;flex-direction:column;gap:12px;flex:1}
  .card{border:1.5px solid ${spec.chu};border-radius:8px;padding:10px;text-align:center}
  .card small{display:block;color:${spec.phu}}
  p{font:13px monospace;color:${spec.phu};margin:14px 0 0}</style>${spec.phuongAn.map(card).join('')}`;
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 600 * spec.phuongAn.length + 40, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log(out);
})();
