/**
 * In-memory clan for the demo/preview build: starts from the fictitious sample data,
 * accepts admin writes and notifies subscribers like a realtime database would.
 * Changes last until the page is reloaded.
 */
import { generateSampleData } from '../sampleData';
import type { ClanSettings, PersonFields, UnionFields, WithId } from '../types';
import type { ClanSnapshot } from './types';

type Listener = (snap: ClanSnapshot) => void;

const data = generateSampleData();
const persons = new Map<string, WithId<PersonFields>>(data.persons.map((p) => [p.id, p]));
const unions = new Map<string, WithId<UnionFields>>(data.unions.map((u) => [u.id, u]));
let settings: ClanSettings = data.settings;
const listeners = new Set<Listener>();

export function demoSnapshot(): ClanSnapshot {
  return { settings, persons: [...persons.values()], unions: [...unions.values()], source: 'demo', fromCache: false };
}

export function subscribeDemo(cb: Listener): () => void {
  listeners.add(cb);
  cb(demoSnapshot());
  return () => listeners.delete(cb);
}

export const demoDocs = {
  setPerson(id: string, fields: PersonFields | null) {
    if (fields) persons.set(id, { id, ...fields });
    else persons.delete(id);
  },
  setUnion(id: string, fields: UnionFields | null) {
    if (fields) unions.set(id, { id, ...fields });
    else unions.delete(id);
  },
  setSettings(next: ClanSettings) {
    settings = next;
  },
  notify() {
    const snap = demoSnapshot();
    for (const l of listeners) l(snap);
  },
};
