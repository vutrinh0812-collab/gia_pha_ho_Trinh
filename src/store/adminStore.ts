import { create } from 'zustand';
import type { AdminUser } from '@/lib/admin/backend';
import type { ChangeSet } from '@/lib/admin/changes';
import { useToastStore } from './toastStore';

/** Sign out after this long without any interaction (SPEC §4). */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = 'giapha.adminActivity';

export type AdminStatus = 'unknown' | 'signedOut' | 'signingIn' | 'admin';

interface AdminState {
  status: AdminStatus;
  user: AdminUser | null;
  error: string | null;
  /** Restores a previous session (called once by the shell). */
  init(): void;
  signIn(code: string): Promise<boolean>;
  signOut(reason?: string): Promise<void>;
  /** Writes an admin action; returns false (and shows why) when it failed. */
  apply(set: ChangeSet, okText?: string): Promise<boolean>;
}

let started = false;
let idleTimer: ReturnType<typeof setInterval> | undefined;

function readActivity(): number {
  try {
    return Number(sessionStorage.getItem(ACTIVITY_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}
let lastActivity = Date.now();
function touch() {
  lastActivity = Date.now();
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(lastActivity));
  } catch {
    /* ignore */
  }
}

const backend = () => import('@/lib/admin/backend').then((m) => m.getAdminBackend());

export const useAdminStore = create<AdminState>((set, get) => {
  const startIdleWatch = () => {
    lastActivity = readActivity();
    touch();
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    const onActivity = () => {
      if (Date.now() - lastActivity > 15_000) touch();
    };
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
        for (const e of events) window.removeEventListener(e, onActivity);
        clearInterval(idleTimer);
        void get().signOut('Đã thoát chế độ Admin vì không thao tác trong 30 phút.');
      }
    }, 20_000);
  };

  const becomeAdmin = async (user: AdminUser): Promise<boolean> => {
    const b = await backend();
    if (!(await b.isAdmin(user))) {
      await b.signOut();
      set({ status: 'signedOut', user: null, error: 'Mã đúng nhưng tài khoản này chưa được cấp quyền admin cho gia phả.' });
      return false;
    }
    set({ status: 'admin', user, error: null });
    startIdleWatch();
    return true;
  };

  return {
    status: 'unknown',
    user: null,
    error: null,
    init() {
      if (started) return;
      started = true;
      void backend().then((b) =>
        b.onUserChange((user) => {
          if (!user) {
            if (get().status !== 'signingIn') set({ status: 'signedOut', user: null });
            return;
          }
          if (get().status === 'admin' || get().status === 'signingIn') return;
          // Restored session: it still has to be fresh enough.
          if (Date.now() - readActivity() >= IDLE_LIMIT_MS) {
            void get().signOut('Phiên admin đã hết hạn. Hãy nhập lại mã admin.');
            return;
          }
          void becomeAdmin(user);
        }),
      );
    },
    async signIn(code) {
      if (!code.trim()) {
        set({ error: 'Hãy nhập mã admin.' });
        return false;
      }
      set({ status: 'signingIn', error: null });
      try {
        const user = await (await backend()).signIn(code);
        return await becomeAdmin(user);
      } catch (e) {
        set({ status: 'signedOut', user: null, error: e instanceof Error ? e.message : 'Không đăng nhập được.' });
        return false;
      }
    },
    async signOut(reason) {
      clearInterval(idleTimer);
      try {
        await (await backend()).signOut();
      } finally {
        set({ status: 'signedOut', user: null, error: null });
        useToastStore.getState().show(reason ?? 'Đã thoát chế độ Admin.');
      }
    },
    async apply(changeSet, okText = 'Đã lưu.') {
      const user = get().user;
      if (get().status !== 'admin' || !user) {
        useToastStore.getState().show('Cần nhập mã admin trước khi sửa.', 'error');
        return false;
      }
      try {
        await (await backend()).apply(changeSet, user);
        touch();
        useToastStore.getState().show(okText);
        return true;
      } catch (e) {
        useToastStore.getState().show(e instanceof Error ? e.message : 'Không lưu được.', 'error');
        return false;
      }
    },
  };
});

/** For tests: forget the module-level session state. */
export function resetAdminStoreForTests() {
  started = false;
  clearInterval(idleTimer);
  useAdminStore.setState({ status: 'unknown', user: null, error: null });
}
