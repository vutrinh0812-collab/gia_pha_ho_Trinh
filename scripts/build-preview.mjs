/**
 * Packs the demo build (dist-preview/build) into ONE self-contained HTML file:
 * dist-preview/gia-pha-xem-thu.html. CSS and JS are inlined so the page can be
 * shared as a single file or published as a claude.ai artifact.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const buildDir = 'dist-preview/build';
const html = readFileSync(join(buildDir, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)].map((m) => m[1]);
if (scripts.length !== 1) throw new Error(`Expected exactly one script bundle, found ${scripts.length}`);

const css = styles.map((f) => readFileSync(join(buildDir, f), 'utf8')).join('\n');
// Prevent an early "</script>" inside the bundle from closing the inline tag.
const js = readFileSync(join(buildDir, scripts[0]), 'utf8').replace(/<\/script/gi, '<\\/script');

// Pictures the bundle loads as separate files (the frame preset of D72) are inlined as
// data URLs, so the one-file preview still shows them.
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
let inlined = 0;
const jsWithImages = js.replace(/new URL\(`([^`]+\.(jpe?g|png|webp|svg))`,import\.meta\.url\)\.href/g, (_m, file, ext) => {
  inlined++;
  const data = readFileSync(join(buildDir, 'assets', file)).toString('base64');
  return JSON.stringify(`data:${MIME[ext.toLowerCase()]};base64,${data}`);
});
if (inlined) console.log(`✓ inlined ${inlined} picture(s)`);

const out = `<title>Gia Phả Họ Trịnh</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap&subset=vietnamese">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Bản xem thử gia phả với dữ liệu mẫu hư cấu">
<meta name="theme-color" content="#f5f0e9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c1917" media="(prefers-color-scheme: dark)">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${jsWithImages}
</script>
`;
const target = 'dist-preview/gia-pha-xem-thu.html';
writeFileSync(target, out);
console.log(`✓ ${target} (${(Buffer.byteLength(out) / 1024).toFixed(0)} KB)`);
