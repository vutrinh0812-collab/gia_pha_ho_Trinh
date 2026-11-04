/** Typed, validated access to build-time environment variables. */
export interface AppEnv {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  clanId: string;
  adminEmail: string;
  useEmulator: boolean;
  appCheckSiteKey: string | null;
  /** 'demo' runs on in-memory fictitious data and needs no Firebase project. */
  dataSource: 'firebase' | 'demo';
  router: 'browser' | 'memory';
}

export type RawEnv = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_CLAN_ID',
] as const;

export interface EnvResult {
  env: AppEnv;
  missing: string[];
}

export function parseEnv(raw: RawEnv): EnvResult {
  const get = (k: keyof ImportMetaEnv): string => (raw[k] ?? '').trim();
  const dataSource = get('VITE_DATA_SOURCE') === 'demo' ? 'demo' : 'firebase';
  const missing = dataSource === 'demo' ? [] : REQUIRED.filter((k) => get(k) === '');
  return {
    missing,
    env: {
      firebase: {
        apiKey: get('VITE_FIREBASE_API_KEY'),
        authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: get('VITE_FIREBASE_PROJECT_ID'),
        storageBucket: get('VITE_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
        appId: get('VITE_FIREBASE_APP_ID'),
      },
      clanId: get('VITE_CLAN_ID') || 'default',
      adminEmail: get('VITE_ADMIN_EMAIL').toLowerCase(),
      useEmulator: get('VITE_USE_EMULATOR') === 'true',
      appCheckSiteKey: get('VITE_APPCHECK_SITE_KEY') || null,
      dataSource,
      router: get('VITE_ROUTER') === 'memory' ? 'memory' : 'browser',
    },
  };
}

export const { env, missing: missingEnv } = parseEnv(import.meta.env as RawEnv);
