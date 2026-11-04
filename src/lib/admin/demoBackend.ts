import { demoDocs } from '../data/demoStore';
import type { ClanSettings, PersonFields, UnionFields } from '../types';
import type { AdminBackend, AdminUser } from './backend';
import { newId, type AuditRecord } from './changes';

/** Admin code of the preview build (no real account behind it). */
export const DEMO_ADMIN_CODE = 'ma-admin-demo';
const DEMO_USER: AdminUser = { uid: 'demo-admin', email: 'admin@example.com' };
const SESSION_KEY = 'giapha.demoAdmin';

const audit: AuditRecord[] = [];
const userListeners = new Set<(u: AdminUser | null) => void>();

function readSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
function writeSession(on: boolean) {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the session lasts until reload */
  }
}

export const demoBackend: AdminBackend = {
  onUserChange(cb) {
    userListeners.add(cb);
    cb(readSession() ? DEMO_USER : null);
    return () => userListeners.delete(cb);
  },
  async signIn(code) {
    await new Promise((r) => setTimeout(r, 150));
    if (code.trim() !== DEMO_ADMIN_CODE) throw new Error('Mã admin không đúng.');
    writeSession(true);
    userListeners.forEach((l) => l(DEMO_USER));
    return DEMO_USER;
  },
  async signOut() {
    writeSession(false);
    userListeners.forEach((l) => l(null));
  },
  async isAdmin(user) {
    return user.uid === DEMO_USER.uid;
  },
  async apply(set, user) {
    const at = Date.now();
    for (const c of set.changes) {
      const after = c.action === 'delete' ? null : c.after!;
      if (c.collection === 'persons') demoDocs.setPerson(c.id, after as PersonFields | null);
      else if (c.collection === 'unions') demoDocs.setUnion(c.id, after as UnionFields | null);
      else if (after) demoDocs.setSettings(after as unknown as ClanSettings);
      audit.unshift({
        id: newId(),
        at,
        by: user.uid,
        action: c.action,
        collection: c.collection,
        docId: c.id,
        ...(c.before ? { before: c.before } : {}),
        ...(c.after ? { after: c.after } : {}),
        groupId: set.groupId,
        summary: set.summary,
      });
    }
    demoDocs.notify();
  },
  async listAudit(limit = 300) {
    return audit.slice(0, limit);
  },
  async uploadPhoto(_personId, image) {
    // Demo only: the photo lives in this page as a data URL.
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
      reader.readAsDataURL(image);
    });
  },
};
