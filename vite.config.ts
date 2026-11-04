/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { pwaPlugin } from './build/pwa';

export default defineConfig(({ mode }) => {
  // "demo" = self-contained preview on fictitious data (no Firebase), packed into
  // one HTML file by scripts/build-preview.mjs so it can be opened anywhere.
  // "e2e"  = fictitious data with normal routing + PWA, for the Playwright tests.
  const isDemo = mode === 'demo';
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const title = env.VITE_APP_TITLE?.trim() || 'Gia Phả Họ Trịnh';
  return {
    plugins: [
      react(),
      pwaPlugin({
        title,
        shortName: env.VITE_APP_SHORT_NAME?.trim() || 'Gia phả',
        description:
          env.VITE_APP_DESCRIPTION?.trim() || `${title} — xem cây gia phả theo từng đời, tra cứu ngày giỗ, trên điện thoại.`,
        siteUrl: env.VITE_SITE_URL?.trim() || '',
        pwa: !isDemo,
        allowIndexing: env.VITE_ALLOW_INDEXING === 'true',
      }),
    ],
    base: isDemo ? './' : '/',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      outDir: isDemo ? 'dist-preview/build' : mode === 'e2e' ? 'dist-e2e' : 'dist',
      cssCodeSplit: !isDemo,
      // Initial-load budget is 250KB gzip (SPEC 5A.3); keep heavy modules lazy.
      chunkSizeWarningLimit: 600,
      rollupOptions: isDemo ? { output: { inlineDynamicImports: true } } : {},
    },
    preview: { port: 4173, strictPort: true },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
      exclude: ['tests/rules/**', 'node_modules/**'],
    },
  };
});
