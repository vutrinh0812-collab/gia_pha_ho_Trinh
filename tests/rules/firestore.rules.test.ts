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
const ADMIN_UID = 'admin-uid';
const base = `clans/${CLAN}`;

let env: RulesTestEnvironment;

const asDb = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const anon = () => asDb(env.unauthenticatedContext());
const admin = () => asDb(env.authenticatedContext(ADMIN_UID, { email: 'admin@example.com', email_verified: true }));
/** A signed-in user who is NOT in config/admins (e.g. someone who self-registered). */
const stranger = () => asDb(env.authenticatedContext('stranger-uid', { email: 'x@example.com', email_verified: true }));
/** Same email as the admin but a different uid — must not be trusted. */
const impostor = () => asDb(env.authenticatedContext('impostor-uid', { email: 'admin@example.com', email_verified: true }));

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
    await setDoc(doc(db, `${base}/config/admins`), { uids: [ADMIN_UID] });
    await setDoc(doc(db, `${base}/persons/p1`), { fullName: 'Trịnh Công Nguyên', gender: 'male', isBloodline: true, ...m });
    await setDoc(doc(db, `${base}/unions/u1`), { bloodlinePersonId: 'p1', order: 1, ...m });
    await setDoc(doc(db, `${base}/settings/main`), { ...settings(), ...m });
    await setDoc(doc(db, `${base}/auditLog/a1`), { at: now, by: ADMIN_UID, action: 'create', collection: 'persons', docId: 'p1' });
  });
});

describe('public read', () => {
  it('anyone can read persons, unions and settings', async () => {
    await assertSucceeds(getDoc(doc(anon(), `${base}/persons/p1`)));
    await assertSucceeds(getDocs(collection(anon(), `${base}/persons`)));
    await assertSucceeds(getDocs(collection(anon(), `${base}/unions`)));
    await assertSucceeds(getDoc(doc(anon(), `${base}/settings/main`)));
  });

  it('nobody but the admin can read the audit log or admin list', async () => {
    for (const db of [anon(), stranger(), impostor()]) {
      await assertFails(getDocs(collection(db, `${base}/auditLog`)));
      await assertFails(getDoc(doc(db, `${base}/config/admins`)));
    }
    await assertSucceeds(getDocs(collection(admin(), `${base}/auditLog`)));
    await assertSucceeds(getDoc(doc(admin(), `${base}/config/admins`)));
  });

  it('unknown collections are denied', async () => {
    await assertFails(getDoc(doc(anon(), `${base}/secrets/x`)));
    await assertFails(getDoc(doc(anon(), 'other/x')));
  });
});

describe('NO write succeeds without the admin code', () => {
  const nonAdmins = [
    ['unauthenticated', anon],
    ['signed-in non-admin', stranger],
    ['impostor with admin email', impostor],
  ] as const;

  describe.each(nonAdmins)('%s', (_label, getDb) => {
    it('cannot create, update or delete persons', async () => {
      const db = getDb();
      await assertFails(setDoc(doc(db, `${base}/persons/p2`), person({}, 'stranger-uid')));
      await assertFails(updateDoc(doc(db, `${base}/persons/p1`), { fullName: 'Đổi tên' }));
      await assertFails(deleteDoc(doc(db, `${base}/persons/p1`)));
    });

    it('cannot write unions', async () => {
      const db = getDb();
      await assertFails(setDoc(doc(db, `${base}/unions/u2`), union()));
      await assertFails(updateDoc(doc(db, `${base}/unions/u1`), { order: 2 }));
      await assertFails(deleteDoc(doc(db, `${base}/unions/u1`)));
    });

    it('cannot write settings', async () => {
      const db = getDb();
      await assertFails(setDoc(doc(db, `${base}/settings/main`), settings()));
      await assertFails(updateDoc(doc(db, `${base}/settings/main`), { title: 'X' }));
    });

    it('cannot write the audit log', async () => {
      await assertFails(setDoc(doc(getDb(), `${base}/auditLog/a2`), audit()));
    });

    it('cannot make itself admin', async () => {
      await assertFails(setDoc(doc(getDb(), `${base}/config/admins`), { uids: ['stranger-uid', 'impostor-uid'] }));
    });
  });

  it('an admin of another clan cannot write this clan', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(asDb(ctx), 'clans/other/config/admins'), { uids: ['other-admin'] });
    });
    const db = asDb(env.authenticatedContext('other-admin'));
    await assertFails(setDoc(doc(db, `${base}/persons/p2`), person({}, 'other-admin')));
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
    ['spoofed updatedBy', { updatedBy: 'someone-else' }],
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
    await assertFails(updateDoc(main, { title: '', ...stamp }));
    await assertFails(updateDoc(main, { theme: 'x', ...stamp }));
    await assertFails(setDoc(doc(db, `${base}/settings/other`), settings()));
    await assertFails(deleteDoc(main));
    // First-time creation of the settings document.
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(asDb(ctx), `${base}/settings/main`)));
    await assertSucceeds(setDoc(doc(db, `${base}/settings/main`), settings()));
  });

  it('cannot modify the admin list', async () => {
    await assertFails(setDoc(doc(admin(), `${base}/config/admins`), { uids: [ADMIN_UID, 'friend'] }));
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
    batch.set(doc(db, `${base}/auditLog/a6`), audit({ by: 'someone-else' }));
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
