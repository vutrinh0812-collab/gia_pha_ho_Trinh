import { defineConfig, devices, type Project } from '@playwright/test';

/**
 * Mobile end-to-end tests (SPEC 5A.6) against a production build on fictitious
 * data (mode "e2e": no Firebase, real routing, service worker on).
 *
 * All projects run in Chromium with each phone's viewport, touch and user agent.
 * Real Safari / Zalo / Facebook WebViews still need a manual check on a phone.
 */
const ZALO_UA =
  'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Zalo android/12100 ZaloTheme/light';
const FACEBOOK_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5;FBAV/440.0.0.30.106]';

const chromiumPhone = (name: string, device: (typeof devices)[string], extra: Project['use'] = {}): Project => ({
  name,
  use: { ...device, defaultBrowserType: 'chromium', browserName: 'chromium', ...extra },
});

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'vi-VN',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    chromiumPhone('iphone-se', devices['iPhone SE']),
    chromiumPhone('iphone-14', devices['iPhone 14']),
    chromiumPhone('pixel-5', devices['Pixel 5']),
    chromiumPhone('galaxy-a-360', devices['Galaxy S8'] ?? devices['Pixel 5'], {
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
    }),
    chromiumPhone('zalo-android', devices['Pixel 5'], { userAgent: ZALO_UA }),
    chromiumPhone('facebook-ios', devices['iPhone 14'], { userAgent: FACEBOOK_UA }),
  ],
  webServer: {
    command: 'npx vite build --mode e2e && npx vite preview --mode e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
