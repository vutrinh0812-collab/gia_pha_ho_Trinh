/**
 * JSON backup of the whole clan (D102): settings, every person and every union exactly as
 * stored (ids included), so nothing is lost even for people not yet linked into the tree.
 */
import type { ClanModel } from './clanModel';

export const BACKUP_FORMAT = 'gia-pha-backup';
export const BACKUP_VERSION = 1;

export interface ClanBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  clanId: string;
  settings: ClanModel['settings'];
  persons: unknown[];
  unions: unknown[];
}

export function buildBackup(model: ClanModel, clanId: string, now = new Date()): ClanBackup {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    clanId,
    settings: model.settings,
    persons: [...model.index.persons.values()].sort(byId),
    unions: [...model.index.unions.values()].sort(byId),
  };
}

/** "gia-pha-ho-trinh-2026-11-15.json" */
export function backupFileName(clanId: string, now = new Date()): string {
  return `gia-pha-${clanId}-${now.toISOString().slice(0, 10)}.json`;
}

/** Saves the backup as a file in the browser. */
export function downloadBackup(model: ClanModel, clanId: string): void {
  const now = new Date();
  const blob = new Blob([JSON.stringify(buildBackup(model, clanId, now), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(clanId, now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
