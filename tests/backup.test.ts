import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { BACKUP_FORMAT, backupFileName, buildBackup } from '@/lib/backup';

describe('JSON backup (D102)', () => {
  const snap = loadDemoSnapshot();
  const model = buildClanModel(snap)!;

  it('holds the settings and every stored person and union, ids included', () => {
    const b = buildBackup(model, 'ho-trinh', new Date('2026-11-15T08:00:00Z'));
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.clanId).toBe('ho-trinh');
    expect(b.exportedAt).toBe('2026-11-15T08:00:00.000Z');
    expect(b.settings).toEqual(snap.settings);
    expect(b.persons).toHaveLength(snap.persons.length);
    expect(b.unions).toHaveLength(snap.unions.length);
    const first = snap.persons[0]!;
    expect(b.persons).toContainEqual(first);
    // Round-trips through JSON unchanged.
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });

  it('names the file after the clan and the date', () => {
    expect(backupFileName('ho-trinh', new Date('2026-11-15T08:00:00Z'))).toBe('gia-pha-ho-trinh-2026-11-15.json');
  });
});
