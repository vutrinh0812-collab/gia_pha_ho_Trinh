import { demoSnapshot } from './demoStore';
import type { ClanSnapshot } from './types';

/** In-memory fictitious clan, used by demo builds and previews (no Firebase). */
export function loadDemoSnapshot(): ClanSnapshot {
  return demoSnapshot();
}

export { subscribeDemo } from './demoStore';
