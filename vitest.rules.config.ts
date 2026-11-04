import { defineConfig } from 'vitest/config';

// Security-rules tests. They need the Firebase emulators — run via `npm run test:rules`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
