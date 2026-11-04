/**
 * Writes the real clan (from the family book kept in private-data/ho-trinh.json, never in Git) to Firestore.
 *
 *   npm run import:ho-trinh -- --real                       # asks for confirmation
 *   npm run import:ho-trinh -- --real --clear               # wipes persons, unions and history first
 *   npm run import:ho-trinh -- --real --admin-uid <uid>     # also lists this uid as clan admin
 *   npm run import:ho-trinh -- --file <path>                # another data file (default private-data/ho-trinh.json)
 *   npm run import:ho-trinh                                 # Emulator (npm run emulators)
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS (service-account key) for --real.
 */
import { parseArgs } from 'node:util';
import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { convertPrivateFile, type PrivateClanFile } from '../src/lib/import/giaPhaSo';
import { buildFamilyIndex, computeGenerations } from '../src/lib/generation';
import { confirm, connect } from './lib/admin';

const IMPORT_UID = 'import-script';
const BATCH_LIMIT = 450;

const { values } = parseArgs({
  options: {
    real: { type: 'boolean', default: false },
    project: { type: 'string' },
    clear: { type: 'boolean', default: false },
    'admin-uid': { type: 'string' },
    file: { type: 'string', default: 'private-data/ho-trinh.json' },
  },
});

async function deleteCollection(db: Firestore, path: string): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db.collection(path).limit(BATCH_LIMIT).get();
    if (snap.empty) return total;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

async function main(): Promise<void> {
  const ctx = connect({ real: values.real, ...(values.project ? { project: values.project } : {}) });
  const { db, clanId } = ctx;
  const base = `clans/${clanId}`;
  console.log(`→ Đích: ${ctx.emulator ? 'Firebase Emulator' : 'PROJECT THẬT'} "${ctx.projectId}", dòng họ "${clanId}"`);

  const clan = convertPrivateFile(JSON.parse(readFileSync(values.file, 'utf8')) as PrivateClanFile);
  const gens = computeGenerations(buildFamilyIndex(clan.persons, clan.unions), clan.settings.rootPersonId);
  if (gens.unreachable.length || gens.conflicts.length) throw new Error('Dữ liệu sổ gia phả có chỗ chưa nối được vào cây.');

  const existing = await db.collection(`${base}/persons`).limit(1).get();
  if (!existing.empty && !values.clear) {
    console.error('✗ Dòng họ này đã có dữ liệu. Thêm --clear để xóa và nạp lại.');
    process.exit(1);
  }
  if (!ctx.emulator) {
    const msg = `${values.clear ? 'Sẽ XÓA toàn bộ người, hôn nhân, lịch sử của' : 'Sẽ ghi'} "${clanId}" trên project ${ctx.projectId}: ${clan.persons.length} người, ${clan.unions.length} hôn nhân.`;
    if (!(await confirm(msg))) {
      console.log('Đã hủy.');
      process.exit(0);
    }
  }

  if (values.clear) {
    for (const c of ['persons', 'unions', 'auditLog']) {
      const n = await deleteCollection(db, `${base}/${c}`);
      if (n) console.log(`  đã xóa ${n} tài liệu trong ${c}`);
    }
  }

  const meta = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: IMPORT_UID };
  const writes: Array<(b: WriteBatch) => void> = [];
  for (const { id, ...fields } of clan.persons) writes.push((b) => b.set(db.doc(`${base}/persons/${id}`), { ...fields, ...meta }));
  for (const { id, ...fields } of clan.unions) writes.push((b) => b.set(db.doc(`${base}/unions/${id}`), { ...fields, ...meta }));
  writes.push((b) => b.set(db.doc(`${base}/settings/main`), { ...clan.settings, ...meta }));
  const adminUid = values['admin-uid'];
  if (adminUid) writes.push((b) => b.set(db.doc(`${base}/config/admins`), { uids: FieldValue.arrayUnion(adminUid) }, { merge: true }));

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => w(batch));
    await batch.commit();
  }
  console.log(`✓ Đã ghi ${clan.persons.length} người, ${clan.unions.length} hôn nhân, ${gens.founders.length} gia đình đời 1, ${gens.maxGeneration} đời.`);
  if (adminUid) console.log(`✓ Đã đưa uid ${adminUid} vào danh sách admin.`);
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
