import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { getDb, paths } from '../firebase';
import type { ClanSettings, PersonFields, UnionFields } from '../types';
import type { ClanSnapshot } from './types';

export async function loadFirebaseSnapshot(): Promise<ClanSnapshot> {
  const db = getDb();
  const [settingsSnap, persons, unions] = await Promise.all([
    getDoc(doc(db, paths.settings())),
    getDocs(collection(db, paths.persons())),
    getDocs(collection(db, paths.unions())),
  ]);
  return {
    settings: settingsSnap.exists() ? (settingsSnap.data() as ClanSettings) : null,
    persons: persons.docs.map((d) => ({ id: d.id, ...(d.data() as PersonFields) })),
    unions: unions.docs.map((d) => ({ id: d.id, ...(d.data() as UnionFields) })),
    source: 'firebase',
    fromCache: settingsSnap.metadata.fromCache,
  };
}

/** Realtime listener over settings, persons and unions; emits once all three have arrived. */
export function subscribeFirebase(onData: (snap: ClanSnapshot) => void, onError: (e: Error) => void): () => void {
  const db = getDb();
  let settings: ClanSettings | null | undefined;
  let persons: ClanSnapshot['persons'] | undefined;
  let unions: ClanSnapshot['unions'] | undefined;
  let fromCache = false;

  const emit = () => {
    if (settings === undefined || !persons || !unions) return;
    onData({ settings, persons, unions, source: 'firebase', fromCache });
  };

  const unsubs = [
    onSnapshot(
      doc(db, paths.settings()),
      (s) => {
        settings = s.exists() ? (s.data() as ClanSettings) : null;
        fromCache = s.metadata.fromCache;
        emit();
      },
      onError,
    ),
    onSnapshot(
      collection(db, paths.persons()),
      (s) => {
        persons = s.docs.map((d) => ({ id: d.id, ...(d.data() as PersonFields) }));
        emit();
      },
      onError,
    ),
    onSnapshot(
      collection(db, paths.unions()),
      (s) => {
        unions = s.docs.map((d) => ({ id: d.id, ...(d.data() as UnionFields) }));
        emit();
      },
      onError,
    ),
  ];
  return () => unsubs.forEach((u) => u());
}
