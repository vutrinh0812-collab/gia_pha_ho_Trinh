import type { ClanSnapshot } from './types';

export type { ClanSnapshot } from './types';

/**
 * Loads the whole clan from the configured source. The check on
 * import.meta.env is replaced at build time, so a demo build contains
 * no Firebase code and a Firebase build contains no sample generator.
 */
export async function loadClanSnapshot(): Promise<ClanSnapshot> {
  if (import.meta.env.VITE_DATA_SOURCE === 'demo') {
    const { loadDemoSnapshot } = await import('./demoSource');
    return loadDemoSnapshot();
  }
  const { loadFirebaseSnapshot } = await import('./firebaseSource');
  return loadFirebaseSnapshot();
}
