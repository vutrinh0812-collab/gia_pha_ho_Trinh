import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { env } from '../env';
import { getDb, getStorageLazy, paths } from '../firebase';
import type { AdminBackend } from './backend';
import type { AuditRecord, ChangeSet, Doc } from './changes';
import { checkPassword, createSession, defaultLock, makeLock, WEB_ADMIN, type StoredLock } from './lock';

/**
 * Writes a change set and its audit entries in ONE batch (SPEC §3): either every
 * document and every audit line is stored, or nothing is.
 * Creates stamp createdAt; updates replace the listed fields and delete removed
 * ones (so createdAt stays as the rules require); every write stamps updatedAt/By.
 * Exported for the security-rules tests, which run it against the emulator.
 */
export async function writeChangeSet(db: Firestore, clanPath: string, set: ChangeSet, uid: string): Promise<void> {
  const batch = writeBatch(db);
  const stamp = { updatedAt: serverTimestamp(), updatedBy: uid };
  const pathOf = (c: ChangeSet['changes'][number]) =>
    c.collection === 'settings' ? `${clanPath}/settings/main` : `${clanPath}/${c.collection}/${c.id}`;

  for (const c of set.changes) {
    const ref = doc(db, pathOf(c));
    if (c.action === 'create') {
      batch.set(ref, { ...c.after, createdAt: serverTimestamp(), ...stamp });
    } else if (c.action === 'update') {
      const patch: Doc = { ...c.after, ...stamp };
      for (const k of Object.keys(c.before ?? {})) if (!(k in (c.after ?? {}))) patch[k] = deleteField();
      batch.update(ref, patch);
    } else {
      batch.delete(ref);
    }
    batch.set(doc(collection(db, `${clanPath}/auditLog`)), {
      at: serverTimestamp(),
      by: uid,
      action: c.action,
      collection: c.collection,
      docId: c.id,
      ...(c.before ? { before: c.before } : {}),
      ...(c.after ? { after: c.after } : {}),
      groupId: set.groupId,
      summary: set.summary.slice(0, 300),
    });
  }
  await batch.commit();
}

/** Where the password hash lives: clans/{clanId}/config/lock { salt, hash }. */
const lockPath = () => `${paths.clan()}/config/lock`;

async function readLock(): Promise<StoredLock> {
  let snap;
  try {
    snap = await getDocFromServer(doc(getDb(), lockPath()));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'permission-denied') {
      throw new Error(
        'Firestore chưa cho đọc mật khẩu. Hãy cập nhật luật bảo mật (firestore.rules) lên Firebase, xem README mục "Chế độ Admin".',
      );
    }
    throw new Error('Không kiểm tra được mật khẩu vì lỗi mạng. Hãy kiểm tra mạng rồi thử lại.');
  }
  const v = snap.data();
  if (v && typeof v.salt === 'string' && typeof v.hash === 'string') return { salt: v.salt, hash: v.hash };
  return defaultLock(); // never changed yet
}

export function createFirebaseBackend(): AdminBackend {
  const session = createSession('giapha.webAdmin', WEB_ADMIN);

  return {
    onUserChange: (cb) => session.onUserChange(cb),
    async signIn(code) {
      if (!(await checkPassword(code, await readLock()))) throw new Error('Mật khẩu không đúng.');
      session.start();
      return WEB_ADMIN;
    },
    async signOut() {
      session.end();
    },
    async isAdmin() {
      return true;
    },
    async changePassword(current, next) {
      if (!(await checkPassword(current, await readLock()))) throw new Error('Mật khẩu hiện tại không đúng.');
      try {
        await setDoc(doc(getDb(), lockPath()), { ...(await makeLock(next)), updatedAt: serverTimestamp() });
      } catch (e) {
        if ((e as { code?: string }).code === 'permission-denied') {
          throw new Error('Firestore chưa cho lưu mật khẩu. Hãy cập nhật luật bảo mật (firestore.rules) lên Firebase.');
        }
        throw new Error('Không lưu được mật khẩu. Hãy kiểm tra mạng rồi thử lại.');
      }
    },
    async apply(set, user) {
      try {
        await writeChangeSet(getDb(), paths.clan(), set, user.uid);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'permission-denied') throw new Error('Firestore từ chối ghi. Hãy cập nhật luật bảo mật (firestore.rules) lên Firebase, xem README mục "Chế độ Admin".');
        throw new Error('Không lưu được. Hãy kiểm tra mạng rồi thử lại.');
      }
    },
    async listAudit(limit = 300) {
      const snap = await getDocs(query(collection(getDb(), paths.auditLog()), orderBy('at', 'desc'), limitTo(limit)));
      return snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          at: typeof v.at?.toMillis === 'function' ? v.at.toMillis() : Date.now(),
          by: v.by,
          action: v.action,
          collection: v.collection,
          docId: v.docId,
          before: v.before,
          after: v.after,
          groupId: v.groupId,
          summary: v.summary,
        } as AuditRecord;
      });
    },
    ...(env.firebase.storageBucket
      ? {
          async uploadPhoto(personId: string, image: Blob, thumb: Blob) {
            const [{ ref, uploadBytes, getDownloadURL }, storage] = await Promise.all([
              import('firebase/storage'),
              getStorageLazy(),
            ]);
            const base = `${paths.clan()}/photos/${personId}`;
            const meta = { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' };
            await uploadBytes(ref(storage, `${base}/120.jpg`), thumb, meta);
            const big = ref(storage, `${base}/800.jpg`);
            await uploadBytes(big, image, meta);
            return getDownloadURL(big);
          },
        }
      : {}),
  };
}
