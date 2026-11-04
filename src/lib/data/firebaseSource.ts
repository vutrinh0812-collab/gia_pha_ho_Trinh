import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
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
