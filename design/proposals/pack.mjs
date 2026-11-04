/**
 * Packs each proposal into one self-contained HTML file (CSS, data and script inlined)
 * for publishing as a preview page: design/proposals/dist/mau-<x>.html
 *   node design/proposals/pack.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const read = (f) => readFileSync(dir + f, 'utf8');
const NAMES = { a: 'Sổ gia phả', b: 'Mực và giấy', c: 'Sơn son' };
const FONTS = {
  a: 'family=Spectral:wght@500;600&family=Public+Sans:wght@400;500;600',
  b: 'family=Geist:wght@400;500;600',
  c: 'family=Lexend:wght@400;500;600',
};
mkdirSync(dir + 'dist', { recursive: true });
const js = (s) => s.replace(/<\/script/gi, '<\\/script');
for (const x of ['a', 'b', 'c']) {
  const out = `<title>Mẫu ${x.toUpperCase()}: ${NAMES[x]}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS[x]}&display=swap">
<style>
${read('base.css')}
${read(x + '.css')}
</style>
<div id="app"></div>
<script>document.documentElement.dataset.style = '${x}';</script>
<script>${js(read('data.js'))}</script>
<script>${js(read('app.js'))}</script>
`;
  writeFileSync(`${dir}dist/mau-${x}.html`, out);
  console.log(`✓ dist/mau-${x}.html ${(out.length / 1024).toFixed(0)} KB`);
}
