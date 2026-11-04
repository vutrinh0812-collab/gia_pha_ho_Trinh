/**
 * Build-time PWA + sharing support (SPEC 5A.4):
 *  - fills the <head> placeholders (title, description, Open Graph, icons),
 *  - emits manifest.webmanifest,
 *  - emits sw.js with the list of built files to precache (app shell).
 * Firestore data offline is handled by Firestore's own IndexedDB cache.
 */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export interface SiteMeta {
  title: string;
  shortName: string;
  description: string;
  /** Absolute site URL (https://…), needed for og:image/og:url in Zalo/Facebook. Optional. */
  siteUrl: string;
  /** Emit manifest + service worker (off for the single-file preview). */
  pwa: boolean;
  /** Let search engines index the site (default off: family data stays out of Google). */
  allowIndexing?: boolean;
}

export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap&subset=vietnamese';

const THEME = '#a3271c';
const BACKGROUND = '#fbf8f7';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function headTags(meta: SiteMeta): string {
  const base = meta.siteUrl.replace(/\/+$/, '');
  const image = `${base}/og-image.png`;
  const t = escape(meta.title);
  const d = escape(meta.description);
  return [
    `<title>${t}</title>`,
    // Font loads in parallel with the app (no CSS @import chain).
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
    `<link rel="stylesheet" href="${FONT_CSS.replace(/&/g, '&amp;')}" />`,
    meta.allowIndexing ? '' : `<meta name="robots" content="noindex" />`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<meta property="og:site_name" content="${t}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${escape(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    base ? `<meta property="og:url" content="${escape(base)}/" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`,
    `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`,
    meta.pwa ? `<link rel="manifest" href="/manifest.webmanifest" />` : '',
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-title" content="${escape(meta.shortName)}" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function manifest(meta: SiteMeta): string {
  return JSON.stringify(
    {
      name: meta.title,
      short_name: meta.shortName,
      description: meta.description,
      lang: 'vi',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: BACKGROUND,
      theme_color: THEME,
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
}

/** Service worker source. Kept dependency-free on purpose (no Workbox). */
export function serviceWorker(version: string, precache: string[]): string {
  return `/* Generated at build time — do not edit. */
const VERSION = ${JSON.stringify(version)};
const SHELL = 'shell-' + VERSION;
const RUNTIME = 'runtime-v1';
const PRECACHE = ${JSON.stringify(precache)};
const NAV_TIMEOUT_MS = 4000;
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'firebasestorage.googleapis.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Network first for pages (fresh app), cached shell when offline or the network is too slow. */
async function navigate(request) {
  const cached = () => caches.match('/index.html', { ignoreSearch: true, ignoreVary: true });
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
    ]);
    return response;
  } catch {
    return (await cached()) || Response.error();
  }
}

/**
 * Cache first for hashed build files. ignoreVary: precached entries were fetched
 * with different headers than lazy module/CSS loads (e.g. Vary: Origin).
 */
async function asset(request) {
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(SHELL).then((cache) => cache.put(request, copy));
  }
  return response;
}

/** Stale-while-revalidate for fonts and photos. */
async function runtime(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit || Response.error());
  return hit || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(navigate(request));
  } else if (url.origin === self.location.origin && !url.pathname.startsWith('/__/')) {
    event.respondWith(asset(request));
  } else if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(runtime(request));
  }
  // Everything else (Firestore, Auth…) goes straight to the network.
});
`;
}

export function pwaPlugin(meta: SiteMeta): Plugin {
  return {
    name: 'gia-pha-pwa',
    transformIndexHtml(html) {
      return html.replace('<!--head-meta-->', headTags(meta));
    },
    generateBundle(_options, bundle) {
      if (!meta.pwa) return;
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest(meta) });
      const files = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f) && !f.endsWith('.map'));
      const precache = [
        '/index.html',
        '/manifest.webmanifest',
        '/favicon.svg',
        '/icons/icon-192.png',
        '/icons/apple-touch-icon.png',
        ...files.map((f) => `/${f}`),
      ];
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(version, precache) });
    },
  };
}
