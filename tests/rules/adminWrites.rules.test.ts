/**
 * The Firebase admin backend's batched writes (data + audit in one batch) run against
 * the real security rules. Admin mode is a frontend password lock, so the web client
 * writes without a Firebase login; the rules still refuse malformed batches as a whole.
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, Timestamp, writeBatch, type Firestore } from 'firebase/firestore';
import { addChild, addFather, addSpouse, deletePerson, editPerson, personContent, undoGroup, type AuditRecord } from '../../src/lib/admin/changes';
import { writeChangeSet } from '../../src/lib/admin/firebaseBackend';
import { buildClanModel } from '../../src/lib/clanModel';
import { generateSampleData } from '../../src/lib/sampleData';

const CLAN = 'ho-admin';
const base = `clans/${CLAN}`;
const ADMIN = 'web-admin';
let env: RulesTestEnvironment;
const dbOf = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const data = generateSampleData();

async function loadModel(db: Firestore) {
  const [p, u] = await Promise.all([getDocs(collection(db, `${base}/persons`)), getDocs(collection(db, `${base}/unions`))]);
  return buildClanModel({
    settings: data.settings,
    persons: p.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as never,
    unions: u.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as never,
    source: 'firebase',
    fromCache: false,
  })!;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gia-pha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = dbOf(ctx);
    const now = Timestamp.now();
    const meta = { createdAt: now, updatedAt: now, updatedBy: 'seed' };
    const writes: Array<[string, object]> = [
      ...data.persons.map(({ id, ...f }): [string, object] => [`${base}/persons/${id}`, { ...f, ...meta }]),
      ...data.unions.map(({ id, ...f }): [string, object] => [`${base}/unions/${id}`, { ...f, ...meta }]),
      [`${base}/settings/main`, { ...data.settings, ...meta }],
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      for (const [path, v] of writes.slice(i, i + 400)) batch.set(doc(db, path), v);
      await batch.commit();
    }
  });
});

describe('Firebase admin backend writes under the security rules', () => {
  it('admin: edit, add child, add spouse, delete — each with its audit entries', async () => {
    const db = dbOf(env.unauthenticatedContext());
    let model = await loadModel(db);
    const p = model.get('p0007')!;
    await assertSucceeds(writeChangeSet(db, base, editPerson(model, p.id, { ...personContent(p), notes: 'Đã sửa', burialPlace: undefined }), ADMIN));
    model = await loadModel(db);
    await assertSucceeds(writeChangeSet(db, base, addChild(model, 'p0007', { fullName: 'Trịnh Văn Mới', gender: 'male', isBloodline: true }), ADMIN));
    model = await loadModel(db);
    const single = model.persons.find((x) => x.isBloodline && x.gender === 'male' && !model.index.unionsOf(x.id).length)!;
    await assertSucceeds(writeChangeSet(db, base, addSpouse(model, single.id, { fullName: 'Lê Thị Dâu', gender: 'female', isBloodline: false }), ADMIN));
    model = await loadModel(db);
    await assertSucceeds(writeChangeSet(db, base, deletePerson(model, single.id), ADMIN));

    const audit = await getDocs(collection(db, `${base}/auditLog`));
    expect(audit.size).toBeGreaterThanOrEqual(1 + 1 + 2 + 3);
    expect(audit.docs.every((d) => d.data().by === ADMIN && typeof d.data().groupId === 'string')).toBe(true);
  });

  it('admin: undo restores a deleted person through the rules', async () => {
    const db = dbOf(env.unauthenticatedContext());
    let model = await loadModel(db);
    const leaf = model.persons.find((x) => x.isBloodline && !model.index.unionsOf(x.id).length && model.generationOf(x.id) === 7)!;
    const del = deletePerson(model, leaf.id);
    await assertSucceeds(writeChangeSet(db, base, del, ADMIN));
    const audit = await getDocs(collection(db, `${base}/auditLog`));
    const entries = audit.docs
      .map((d) => ({ id: d.id, ...(d.data() as object), at: 0 }) as unknown as AuditRecord)
      .filter((r) => r.groupId === del.groupId);
    model = await loadModel(db);
    await assertSucceeds(writeChangeSet(db, base, undoGroup(model, entries, del.summary), ADMIN));
    model = await loadModel(db);
    expect(model.get(leaf.id)?.fullName).toBe(leaf.fullName);
  });

  it('admin: add a father above the root (person, union, root and settings in one batch)', async () => {
    const db = dbOf(env.unauthenticatedContext());
    const model = await loadModel(db);
    await assertSucceeds(
      writeChangeSet(db, base, addFather(model, model.rootId, { fullName: 'Trịnh Công Tiên', gender: 'male', isBloodline: true }), ADMIN),
    );
  });

  it('a batch with a malformed document is refused, nothing is written', async () => {
    const db = dbOf(env.unauthenticatedContext());
    const model = await loadModel(db);
    const set = addChild(model, 'p0007', { fullName: 'Trịnh Văn Lạ', gender: 'male', isBloodline: true });
    await assertFails(writeChangeSet(db, base, set, ''));
    const after = await loadModel(db);
    expect(after.persons.some((x) => x.fullName === 'Trịnh Văn Lạ')).toBe(false);
  });
});
