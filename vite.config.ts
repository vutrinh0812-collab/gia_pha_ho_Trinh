/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // "demo" = self-contained preview on fictitious data (no Firebase), packed into
  // one HTML file by scripts/build-preview.mjs so it can be opened anywhere.
  const isDemo = mode === 'demo';
  return {
    plugins: [react()],
    base: isDemo ? './' : '/',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      outDir: isDemo ? 'dist-preview/build' : 'dist',
      cssCodeSplit: !isDemo,
      // Initial-load budget is 250KB gzip (SPEC 5A.3); keep heavy modules lazy.
      chunkSizeWarningLimit: 600,
      rollupOptions: isDemo ? { output: { inlineDynamicImports: true } } : {},
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
      exclude: ['tests/rules/**', 'node_modules/**'],
    },
  };
});
