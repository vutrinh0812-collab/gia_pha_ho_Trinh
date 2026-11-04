/**
 * Seeds FICTITIOUS sample data (SPEC §10).
 *
 *   npm run seed                              # Emulator (must be running: npm run emulators)
 *   npm run seed -- --clear                   # Emulator, wipe clan data first
 *   npm run seed -- --real --project <id>     # Real project (asks for confirmation)
 *
 * Options: --size <n> (default 300), --surname <name> (default "Trịnh"), --seed <n>.
 */
import { parseArgs } from 'node:util';
import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import { buildFamilyIndex, computeGenerations } from '../src/lib/generation';
import { generateSampleData } from '../src/lib/sampleData';
import { confirm, connect, upsertAdmin } from './lib/admin';

const SEED_UID = 'seed-script';
const EMULATOR_ADMIN_CODE = 'ma-admin-demo';
const BATCH_LIMIT = 450;

const { values } = parseArgs({
  options: {
    real: { type: 'boolean', default: false },
    project: { type: 'string' },
    clear: { type: 'boolean', default: false },
    size: { type: 'string', default: '300' },
    surname: { type: 'string', default: 'Trịnh' },
    seed: { type: 'string' },
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

  const existing = await db.collection(`${base}/persons`).limit(1).get();
  if (!existing.empty && !values.clear) {
    console.error('✗ Dòng họ này đã có dữ liệu. Thêm --clear để xóa và tạo lại dữ liệu mẫu.');
    process.exit(1);
  }
  if (!ctx.emulator) {
    const msg = values.clear
      ? `Sẽ XÓA TOÀN BỘ người, hôn nhân, lịch sử của "${clanId}" trên project ${ctx.projectId} và ghi dữ liệu mẫu hư cấu.`
      : `Sẽ ghi dữ liệu mẫu hư cấu vào "${clanId}" trên project ${ctx.projectId}.`;
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

  const data = generateSampleData({
    targetSize: Number(values.size),
    surname: values.surname,
    ...(values.seed ? { seed: Number(values.seed) } : {}),
  });
  const gens = computeGenerations(buildFamilyIndex(data.persons, data.unions), data.settings.rootPersonId);

  const meta = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: SEED_UID };
  const writes: Array<(b: WriteBatch) => void> = [];
  for (const { id, ...fields } of data.persons) writes.push((b) => b.set(db.doc(`${base}/persons/${id}`), { ...fields, ...meta }));
  for (const { id, ...fields } of data.unions) writes.push((b) => b.set(db.doc(`${base}/unions/${id}`), { ...fields, ...meta }));
  writes.push((b) => b.set(db.doc(`${base}/settings/main`), { ...data.settings, ...meta }));

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => w(batch));
    await batch.commit();
  }

  console.log(`✓ Đã ghi ${data.persons.length} người, ${data.unions.length} hôn nhân, ${gens.maxGeneration} đời.`);

  if (ctx.emulator) {
    await upsertAdmin(ctx, EMULATOR_ADMIN_CODE);
    console.log(`✓ Tài khoản admin emulator: ${ctx.adminEmail} — mã admin: ${EMULATOR_ADMIN_CODE}`);
  } else {
    console.log('ℹ Nếu chưa cài tài khoản admin, chạy: npm run admin:setup -- --real');
  }
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
