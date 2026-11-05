import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { generateSampleData } from '../../src/lib/sampleData';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const CLAN = 'ho-test';
const ADMIN_UID = 'web-admin';
const base = `clans/${CLAN}`;

let env: RulesTestEnvironment;

const asDb = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const anon = () => asDb(env.unauthenticatedContext());
/** The web app writes without a Firebase login (frontend password lock). */
const admin = anon;

const meta = (uid = ADMIN_UID) => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid });

const person = (overrides: Record<string, unknown> = {}, uid = ADMIN_UID) => ({
  fullName: 'Trịnh Văn An',
  gender: 'male',
  isBloodline: true,
  parentUnionId: null,
  ...meta(uid),
  ...overrides,
});

const union = (overrides: Record<string, unknown> = {}) => ({
  bloodlinePersonId: 'p1',
  spousePersonId: 'p2',
  order: 1,
  status: 'married',
  ...meta(),
  ...overrides,
});

const settings = (overrides: Record<string, unknown> = {}) => ({
  clanName: 'Trịnh',
  title: 'Hệ Phả Họ Trịnh',
  rootPersonId: 'p1',
  coupletLeft: 'Trái',
  coupletRight: 'Phải',
  colophon: 'Lạc khoản',
  defaultThemeId: 'minimal',
  showMaternalDescendants: false,
  ...meta(),
  ...overrides,
});

const audit = (overrides: Record<string, unknown> = {}) => ({
  at: serverTimestamp(),
  by: ADMIN_UID,
  action: 'create',
  collection: 'persons',
  docId: 'p9',
  after: { fullName: 'X' },
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gia-pha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx);
    const now = Timestamp.now();
    const m = { createdAt: now, updatedAt: now, updatedBy: ADMIN_UID };
    await setDoc(doc(db, `${base}/persons/p1`), { fullName: 'Trịnh Công Nguyên', gender: 'male', isBloodline: true, ...m });
    await setDoc(doc(db, `${base}/unions/u1`), { bloodlinePersonId: 'p1', order: 1, ...m });
    await setDoc(doc(db, `${base}/settings/main`), { ...settings(), ...m });
    await setDoc(doc(db, `${base}/auditLog/a1`), { at: now, by: ADMIN_UID, action: 'create', collection: 'persons', docId: 'p1' });
  });
});

describe('public read', () => {
  it('anyone can read persons, unions, settings, the audit log and the password hash', async () => {
    const db = anon();
    await assertSucceeds(getDoc(doc(db, `${base}/persons/p1`)));
    await assertSucceeds(getDoc(doc(db, `${base}/unions/u1`)));
    await assertSucceeds(getDoc(doc(db, `${base}/settings/main`)));
    await assertSucceeds(getDocs(collection(db, `${base}/auditLog`)));
    await assertSucceeds(getDoc(doc(db, `${base}/config/lock`)));
  });

  it('unknown collections are denied', async () => {
    await assertFails(getDoc(doc(anon(), `${base}/secrets/x`)));
    await assertFails(getDoc(doc(anon(), `${base}/config/admins`)));
    await assertFails(getDocs(collection(anon(), `${base}/config`)));
    await assertFails(getDoc(doc(anon(), 'other/x')));
  });
});

// Admin mode is a password lock in the web page only, so the database accepts
// well-formed writes from any client (signed in or not).
describe('writes without a login (frontend lock)', () => {
  it('a web client can create, update and delete a person', async () => {
    const db = anon();
    await assertSucceeds(setDoc(doc(db, `${base}/persons/p2`), person()));
    await assertSucceeds(
      updateDoc(doc(db, `${base}/persons/p2`), { fullName: 'Đổi tên', updatedAt: serverTimestamp(), updatedBy: ADMIN_UID }),
    );
    await assertSucceeds(deleteDoc(doc(db, `${base}/persons/p2`)));
  });

  it('cannot write the config except the password lock', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, `${base}/config/admins`), { uids: ['x'] }));
    await assertFails(setDoc(doc(db, `${base}/config/other`), { a: 1 }));
    await assertFails(setDoc(doc(db, `${base}/secrets/x`), { a: 1 }));
  });
});

describe('password lock document', () => {
  const lock = (overrides: Record<string, unknown> = {}) => ({
    salt: '0123456789abcdef',
    hash: 'a'.repeat(64),
    updatedAt: serverTimestamp(),
    ...overrides,
  });

  it('accepts a salted hash', async () => {
    await assertSucceeds(setDoc(doc(anon(), `${base}/config/lock`), lock()));
    await assertSucceeds(setDoc(doc(anon(), `${base}/config/lock`), lock({ hash: 'b'.repeat(64) })));
  });

  it.each([
    ['a plain password', { hash: '7150565' }],
    ['upper-case hex', { hash: 'A'.repeat(64) }],
    ['a short salt', { salt: 'x' }],
    ['an extra field', { password: '7150565' }],
    ['a client-chosen time', { updatedAt: Timestamp.fromMillis(0) }],
  ])('rejects %s', async (_label, overrides) => {
    await assertFails(setDoc(doc(anon(), `${base}/config/lock`), lock(overrides)));
  });

  it('cannot be deleted', async () => {
    await assertSucceeds(setDoc(doc(anon(), `${base}/config/lock`), lock()));
    await assertFails(deleteDoc(doc(anon(), `${base}/config/lock`)));
  });
});

describe('admin writes', () => {
  it('can create, update and delete a valid person', async () => {
    const db = admin();
    await assertSucceeds(
      setDoc(
        doc(db, `${base}/persons/p2`),
        person({
          otherNames: { huy: 'Phúc', thuong: 'Cả' },
          parentUnionId: 'u1',
          birthOrder: 1,
          birth: { solar: '1890', approximate: true, place: 'Thôn Đông' },
          death: { isDeceased: true, solar: '1950-03-12', lunar: { day: 24, month: 1, year: 1950 } },
          deathAnniversaryLunar: { day: 24, month: 1 },
          burialPlace: 'Gò Cao',
          occupation: 'Thầy đồ',
          notes: 'Ghi chú',
          branchLabel: 'Chi Giáp',
          photoUrl: 'https://example.com/a.jpg',
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(db, `${base}/persons/p2`), { fullName: 'Trịnh Văn Bình', updatedAt: serverTimestamp(), updatedBy: ADMIN_UID }),
    );
    await assertSucceeds(deleteDoc(doc(db, `${base}/persons/p2`)));
  });

  it.each([
    ['empty name', { fullName: '' }],
    ['name over 100 chars', { fullName: 'x'.repeat(101) }],
    ['name not a string', { fullName: 42 }],
    ['bad gender', { gender: 'other' }],
    ['isBloodline not bool', { isBloodline: 'yes' }],
    ['unknown field', { isAdmin: true }],
    ['bad partial date', { birth: { solar: '1890-13' } }],
    ['unknown date key', { birth: { solar: '1890', foo: 1 } }],
    ['lunar day out of range', { birth: { lunar: { day: 31 } } }],
    ['death without isDeceased', { death: { solar: '1950' } }],
    ['anniversary month 13', { deathAnniversaryLunar: { day: 1, month: 13 } }],
    ['birthOrder 0', { birthOrder: 0 }],
    ['birthOrder as float', { birthOrder: 1.5 }],
    ['http photo', { photoUrl: 'http://example.com/a.jpg' }],
    ['notes too long', { notes: 'x'.repeat(5001) }],
    ['empty updatedBy', { updatedBy: '' }],
    ['client-chosen updatedAt', { updatedAt: Timestamp.fromMillis(0) }],
  ])('rejects a person with %s', async (_label, overrides) => {
    await assertFails(setDoc(doc(admin(), `${base}/persons/p3`), person(overrides)));
  });

  it('rejects a person missing a required field', async () => {
    const { gender: _g, ...noGender } = person();
    await assertFails(setDoc(doc(admin(), `${base}/persons/p3`), noGender));
  });

  it('cannot change createdAt on update', async () => {
    await assertFails(
      updateDoc(doc(admin(), `${base}/persons/p1`), {
        createdAt: Timestamp.fromMillis(0),
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_UID,
      }),
    );
  });

  it('validates unions', async () => {
    const db = admin();
    await assertSucceeds(setDoc(doc(db, `${base}/unions/u2`), union()));
    await assertSucceeds(setDoc(doc(db, `${base}/unions/u3`), union({ spousePersonId: null, order: 2 })));
    await assertFails(setDoc(doc(db, `${base}/unions/u4`), union({ spousePersonId: 'p1', bloodlinePersonId: 'p1' })));
    await assertFails(setDoc(doc(db, `${base}/unions/u4`), union({ order: 0 })));
    await assertFails(setDoc(doc(db, `${base}/unions/u4`), union({ status: 'engaged' })));
    await assertFails(setDoc(doc(db, `${base}/unions/u4`), union({ bloodlinePersonId: '' })));
  });

  it('validates settings and only allows the "main" document', async () => {
    const db = admin();
    const stamp = { updatedAt: serverTimestamp(), updatedBy: ADMIN_UID };
    const main = doc(db, `${base}/settings/main`);
    await assertSucceeds(updateDoc(main, { subtitle: 'Từ đời 1 đến đời 7', ...stamp }));
    await assertFails(updateDoc(main, { showMaternalDescendants: 'no', ...stamp }));
    // D62: open editing to everyone, or lock it.
    await assertSucceeds(updateDoc(main, { openEditing: true, ...stamp }));
    await assertSucceeds(updateDoc(main, { openEditing: false, ...stamp }));
    await assertFails(updateDoc(main, { openEditing: 'yes', ...stamp }));
    await assertFails(updateDoc(main, { title: '', ...stamp }));
    await assertFails(updateDoc(main, { theme: 'x', ...stamp }));
    await assertFails(setDoc(doc(db, `${base}/settings/other`), settings()));
    await assertFails(deleteDoc(main));
    // First-time creation of the settings document.
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(asDb(ctx), `${base}/settings/main`)));
    await assertSucceeds(setDoc(doc(db, `${base}/settings/main`), settings()));
  });
});

describe('audit log', () => {
  it('admin writes data and audit entry in one batch', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.set(doc(db, `${base}/persons/p5`), person({ fullName: 'Nguyễn Thị Ngọc', gender: 'female', isBloodline: false }));
    batch.set(doc(db, `${base}/auditLog/a5`), audit({ docId: 'p5', after: { fullName: 'Nguyễn Thị Ngọc' } }));
    await assertSucceeds(batch.commit());
  });

  it('a batch with an invalid audit entry fails as a whole', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.set(doc(db, `${base}/persons/p6`), person());
    batch.set(doc(db, `${base}/auditLog/a6`), audit({ by: '' }));
    await assertFails(batch.commit());
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(asDb(ctx), `${base}/persons/p6`))).exists()).toBe(false);
    });
  });

  it('entries are immutable, even for the admin', async () => {
    const db = admin();
    await assertFails(updateDoc(doc(db, `${base}/auditLog/a1`), { docId: 'p2' }));
    await assertFails(deleteDoc(doc(db, `${base}/auditLog/a1`)));
  });

  it('rejects malformed entries', async () => {
    const db = admin();
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ action: 'drop' })));
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ collection: 'config' })));
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ at: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ before: 'not a map' })));
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ summary: 'x'.repeat(301) })));
    await assertFails(setDoc(doc(db, `${base}/auditLog/a7`), audit({ groupId: '' })));
    await assertSucceeds(setDoc(doc(db, `${base}/auditLog/a8`), audit({ groupId: 'g1', summary: 'Thêm con: Trịnh Văn An' })));
  });
});

describe('consistency with the client validators', () => {
  it('every generated sample document is accepted by the rules (admin)', async () => {
    const db = admin();
    const data = generateSampleData();
    const writes: Array<[string, Record<string, unknown>]> = [
      ...data.persons.map(({ id, ...f }): [string, Record<string, unknown>] => [`${base}/persons/${id}`, { ...f, ...meta() }]),
      ...data.unions.map(({ id, ...f }): [string, Record<string, unknown>] => [`${base}/unions/${id}`, { ...f, ...meta() }]),
    ];
    for (let i = 0; i < writes.length; i += 100) {
      const batch = writeBatch(db);
      for (const [path, value] of writes.slice(i, i + 100)) batch.set(doc(db, path), value);
      await assertSucceeds(batch.commit());
    }
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(asDb(ctx), `${base}/settings/main`)));
    await assertSucceeds(setDoc(doc(db, `${base}/settings/main`), { ...data.settings, ...meta() }));
  });
});
