import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { env } from '../env';
import { getAuthLazy, getDb, getStorageLazy, paths } from '../firebase';
import type { AdminBackend, AdminUser } from './backend';
import type { AuditRecord, ChangeSet, Doc } from './changes';

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

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Mã admin không đúng.',
  'auth/invalid-login-credentials': 'Mã admin không đúng.',
  'auth/wrong-password': 'Mã admin không đúng.',
  'auth/user-not-found': 'Chưa cài tài khoản admin cho gia phả này (xem README, mục 3.8).',
  'auth/too-many-requests': 'Nhập sai quá nhiều lần. Hãy thử lại sau ít phút.',
  'auth/network-request-failed': 'Không có kết nối mạng. Hãy kiểm tra mạng rồi thử lại.',
  'auth/user-disabled': 'Tài khoản admin đang bị khóa.',
};

export function createFirebaseBackend(): AdminBackend {
  const toUser = (u: { uid: string; email: string | null } | null): AdminUser | null =>
    u ? { uid: u.uid, email: u.email } : null;

  return {
    onUserChange(cb) {
      let unsub: (() => void) | null = null;
      let cancelled = false;
      void (async () => {
        const [{ onAuthStateChanged }, auth] = await Promise.all([import('firebase/auth'), getAuthLazy()]);
        if (!cancelled) unsub = onAuthStateChanged(auth, (u) => cb(toUser(u)));
      })();
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    async signIn(code) {
      const [{ browserSessionPersistence, setPersistence, signInWithEmailAndPassword }, auth] = await Promise.all([
        import('firebase/auth'),
        getAuthLazy(),
      ]);
      try {
        // The session ends with the browser tab, on top of the 30-minute idle sign-out.
        await setPersistence(auth, browserSessionPersistence);
        const cred = await signInWithEmailAndPassword(auth, env.adminEmail, code);
        return toUser(cred.user)!;
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        throw new Error(AUTH_MESSAGES[code] ?? 'Không đăng nhập được. Hãy thử lại.');
      }
    },
    async signOut() {
      const [{ signOut }, auth] = await Promise.all([import('firebase/auth'), getAuthLazy()]);
      await signOut(auth);
    },
    async isAdmin(user) {
      try {
        const snap = await getDoc(doc(getDb(), `${paths.clan()}/config/admins`));
        const uids = (snap.data()?.uids ?? []) as string[];
        return uids.includes(user.uid);
      } catch {
        return false; // the rules deny the read to anyone not listed
      }
    },
    async apply(set, user) {
      try {
        await writeChangeSet(getDb(), paths.clan(), set, user.uid);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'permission-denied') throw new Error('Không có quyền ghi. Phiên admin có thể đã hết; hãy nhập lại mã admin.');
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
