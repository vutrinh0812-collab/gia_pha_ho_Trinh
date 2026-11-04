import { demoDocs } from '../data/demoStore';
import type { ClanSettings, PersonFields, UnionFields } from '../types';
import type { AdminBackend, AdminUser } from './backend';
import { newId, type AuditRecord } from './changes';
import { checkPassword, createSession, makeLock, type StoredLock } from './lock';

/** Admin password of the preview build (no real account behind it). */
export const DEMO_ADMIN_CODE = 'ma-admin-demo';
const DEMO_USER: AdminUser = { uid: 'demo-admin', email: 'admin@example.com' };
const session = createSession('giapha.demoAdmin', DEMO_USER);

const audit: AuditRecord[] = [];
/** Changed password, for this page only (null = DEMO_ADMIN_CODE). */
let demoLock: StoredLock | null = null;

async function matches(code: string): Promise<boolean> {
  return demoLock ? checkPassword(code, demoLock) : code.trim() === DEMO_ADMIN_CODE;
}

export const demoBackend: AdminBackend = {
  onUserChange: (cb) => session.onUserChange(cb),
  async signIn(code) {
    await new Promise((r) => setTimeout(r, 150));
    if (!(await matches(code))) throw new Error('Mật khẩu không đúng.');
    session.start();
    return DEMO_USER;
  },
  async signOut() {
    session.end();
  },
  async isAdmin(user) {
    return user.uid === DEMO_USER.uid;
  },
  async changePassword(current, next) {
    if (!(await matches(current))) throw new Error('Mật khẩu hiện tại không đúng.');
    demoLock = await makeLock(next);
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
