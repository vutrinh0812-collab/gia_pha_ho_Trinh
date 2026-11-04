import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { env } from './env';

/**
 * Firebase is initialised lazily so routes that never touch data
 * (and unit tests) do not pay for it. Auth and Storage are imported
 * on demand by the admin feature to keep the initial bundle small.
 */
let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  app ??= initializeApp(env.firebase);
  return app;
}

function canUseIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

export function getDb(): Firestore {
  if (db) return db;
  const localCache = canUseIndexedDb()
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache();
  db = initializeFirestore(getFirebaseApp(), { localCache });
  if (env.useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
}

export async function getAuthLazy() {
  const { getAuth, connectAuthEmulator } = await import('firebase/auth');
  const auth = getAuth(getFirebaseApp());
  if (env.useEmulator && !auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

export async function getStorageLazy() {
  const { getStorage, connectStorageEmulator } = await import('firebase/storage');
  const storage = getStorage(getFirebaseApp());
  if (env.useEmulator) connectStorageEmulator(storage, '127.0.0.1', 9199);
  return storage;
}

/** Firestore path helpers — all data lives under clans/{clanId}. */
export const paths = {
  clan: () => `clans/${env.clanId}`,
  persons: () => `clans/${env.clanId}/persons`,
  unions: () => `clans/${env.clanId}/unions`,
  settings: () => `clans/${env.clanId}/settings/main`,
  auditLog: () => `clans/${env.clanId}/auditLog`,
} as const;
