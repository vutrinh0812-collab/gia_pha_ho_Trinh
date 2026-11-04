import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('reports missing required variables', () => {
    const { missing, env } = parseEnv({});
    expect(missing).toContain('VITE_FIREBASE_API_KEY');
    expect(missing).toContain('VITE_ADMIN_EMAIL');
    expect(env.useEmulator).toBe(false);
    expect(env.clanId).toBe('default');
  });

  it('parses a complete config', () => {
    const { missing, env } = parseEnv({
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_PROJECT_ID: 'p',
      VITE_FIREBASE_APP_ID: 'a',
      VITE_CLAN_ID: ' ho-trinh ',
      VITE_ADMIN_EMAIL: 'Admin@Example.com',
      VITE_USE_EMULATOR: 'true',
    });
    expect(missing).toEqual([]);
    expect(env.clanId).toBe('ho-trinh');
    expect(env.adminEmail).toBe('admin@example.com');
    expect(env.useEmulator).toBe(true);
    expect(env.appCheckSiteKey).toBeNull();
  });
});
