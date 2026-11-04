import { generateSampleData } from '../sampleData';
import type { ClanSnapshot } from './types';

/** In-memory fictitious clan, used by demo builds and previews (no Firebase). */
export function loadDemoSnapshot(): ClanSnapshot {
  const data = generateSampleData();
  return { settings: data.settings, persons: data.persons, unions: data.unions, source: 'demo', fromCache: false };
}
