import type { ClanSettings, PersonFields, UnionFields, WithId } from '../types';

/** Everything needed to draw the clan, loaded at once. */
export interface ClanSnapshot {
  settings: ClanSettings | null;
  persons: WithId<PersonFields>[];
  unions: WithId<UnionFields>[];
  source: 'firebase' | 'demo';
  /** True when served from the offline cache. */
  fromCache: boolean;
}
