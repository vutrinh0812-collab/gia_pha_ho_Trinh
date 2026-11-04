import type { ClanSnapshot } from './types';

export type { ClanSnapshot } from './types';

/**
 * The checks on import.meta.env are replaced at build time, so a demo build
 * contains no Firebase code and a Firebase build contains no sample generator.
 */
const IS_DEMO = import.meta.env.VITE_DATA_SOURCE === 'demo';

/** Loads the whole clan once. */
export async function loadClanSnapshot(): Promise<ClanSnapshot> {
  if (IS_DEMO) {
    const { loadDemoSnapshot } = await import('./demoSource');
    return loadDemoSnapshot();
  }
  const { loadFirebaseSnapshot } = await import('./firebaseSource');
  return loadFirebaseSnapshot();
}

/**
 * Subscribes to the clan: `onData` fires with a full snapshot now and after
 * every change (realtime with Firebase). Returns an unsubscribe function.
 */
export function subscribeClan(onData: (snap: ClanSnapshot) => void, onError: (e: Error) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;
  const ready = IS_DEMO
    ? import('./demoSource').then((m) => {
        onData(m.loadDemoSnapshot());
        return () => {};
      })
    : import('./firebaseSource').then((m) => m.subscribeFirebase(onData, onError));
  ready.then(
    (unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    },
    (e: unknown) => onError(e instanceof Error ? e : new Error(String(e))),
  );
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
