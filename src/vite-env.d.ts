/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_CLAN_ID?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_USE_EMULATOR?: string;
  readonly VITE_APPCHECK_SITE_KEY?: string;
  /** 'firebase' (default) | 'demo' — demo runs on in-memory fictitious data. */
  readonly VITE_DATA_SOURCE?: string;
  /** 'sample' (default) | 'ho-trinh' — which data the demo build starts from. */
  readonly VITE_DEMO_DATASET?: string;
  /** 'browser' (default) | 'memory' — memory for embedded previews without URL routing. */
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
