import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

const CLAN = 'ho-test';
const photo = (name = 'p1/800.jpg') => `clans/${CLAN}/photos/${name}`;

let env: RulesTestEnvironment;

const storageOf = (ctx: RulesTestContext) => ctx.storage() as unknown as FirebaseStorage;
const anon = () => storageOf(env.unauthenticatedContext());
/** The web app uploads without a Firebase login (frontend password lock). */
const admin = anon;

const bytes = (size: number) => new Uint8Array(size);
const jpeg = { contentType: 'image/jpeg' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gia-pha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(storageOf(ctx), photo('seed.jpg')), bytes(10), jpeg);
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe('storage rules', () => {
  it('anyone can read photos', async () => {
    await assertSucceeds(getBytes(ref(anon(), photo('seed.jpg'))));
  });

  it('admin can upload a small image', async () => {
    await assertSucceeds(uploadBytes(ref(admin(), photo()), bytes(100 * 1024), jpeg));
    await assertSucceeds(uploadBytes(ref(admin(), photo('p1/120.webp')), bytes(5 * 1024), { contentType: 'image/webp' }));
  });

  it('rejects files of 2MB or more', async () => {
    await assertFails(uploadBytes(ref(admin(), photo('big.jpg')), bytes(2 * 1024 * 1024), jpeg));
  });

  it('rejects non-images and SVG', async () => {
    await assertFails(uploadBytes(ref(admin(), photo('a.pdf')), bytes(100), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(admin(), photo('a.svg')), bytes(100), { contentType: 'image/svg+xml' }));
  });

  it('denies paths outside photos/', async () => {
    await assertFails(uploadBytes(ref(admin(), `clans/${CLAN}/other/a.jpg`), bytes(100), jpeg));
    await assertFails(getBytes(ref(anon(), `clans/${CLAN}/other/a.jpg`)));
  });

  it('admin can delete', async () => {
    await assertSucceeds(deleteObject(ref(admin(), photo())));
  });
});
