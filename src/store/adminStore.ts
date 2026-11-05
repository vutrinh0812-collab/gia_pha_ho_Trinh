import { create } from 'zustand';
import type { AdminUser } from '@/lib/admin/backend';
import type { ChangeSet } from '@/lib/admin/changes';
import { useClanStore } from './clanStore';
import { useToastStore } from './toastStore';

/** Sign out after this long without any interaction (SPEC §4). */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = 'giapha.adminActivity';
/** Give up on a sign-in that has not answered by then, instead of spinning forever. */
const SIGN_IN_TIMEOUT_MS = 30_000;
/** If the saved session has not been restored by then, show the form anyway. */
const RESTORE_TIMEOUT_MS = 8_000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export type AdminStatus = 'unknown' | 'signedOut' | 'signingIn' | 'admin';

/** Who is recorded in the history for edits made while editing is open to everyone (D62). */
export const GUEST_EDITOR: AdminUser = { uid: 'khach', email: null };

/** Editing is open to everyone (clan setting, D62). */
export const isEditingOpen = () => useClanStore.getState().model?.settings.openEditing === true;

/**
 * May this viewer add and edit people? The admin always; everyone else only while the
 * admin has opened editing to everyone. Clan settings, history and the password stay
 * admin-only.
 */
export function useCanEdit(): boolean {
  const admin = useAdminStore((s) => s.status === 'admin');
  const open = useClanStore((s) => s.model?.settings.openEditing === true);
  return admin || open;
}

interface AdminState {
  status: AdminStatus;
  user: AdminUser | null;
  error: string | null;
  /** Restores a previous session (called once by the shell). */
  init(): void;
  signIn(code: string): Promise<boolean>;
  signOut(reason?: string): Promise<void>;
  /** Changes the admin password; throws an Error with a Vietnamese message. */
  changePassword(current: string, next: string, confirm: string): Promise<void>;
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
    let ok: boolean;
    try {
      ok = await b.isAdmin(user);
    } catch (e) {
      await b.signOut().catch(() => undefined);
      set({
        status: 'signedOut',
        user: null,
        error: e instanceof Error ? e.message : 'Không kiểm tra được quyền admin.',
      });
      return false;
    }
    if (!ok) {
      await b.signOut().catch(() => undefined);
      set({ status: 'signedOut', user: null, error: 'Không vào được chế độ Admin.' });
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
      const giveUp = setTimeout(() => {
        if (get().status === 'unknown') set({ status: 'signedOut', user: null });
      }, RESTORE_TIMEOUT_MS);
      void backend()
        .then((b) =>
          b.onUserChange((user) => {
            clearTimeout(giveUp);
            if (!user) {
              if (get().status !== 'signingIn') set({ status: 'signedOut', user: null });
              return;
            }
            if (get().status === 'admin' || get().status === 'signingIn') return;
            // Restored session: it still has to be fresh enough.
            if (Date.now() - readActivity() >= IDLE_LIMIT_MS) {
              void get().signOut('Phiên admin đã hết hạn. Hãy nhập lại mật khẩu.');
              return;
            }
            void becomeAdmin(user);
          }),
        )
        .catch(() => {
          clearTimeout(giveUp);
          if (get().status === 'unknown') set({ status: 'signedOut', user: null });
        });
    },
    async signIn(code) {
      if (!code.trim()) {
        set({ error: 'Hãy nhập mật khẩu.' });
        return false;
      }
      set({ status: 'signingIn', error: null });
      try {
        const user = await withTimeout(
          backend().then((b) => b.signIn(code)),
          SIGN_IN_TIMEOUT_MS,
          'Đăng nhập không phản hồi. Hãy kiểm tra mạng rồi thử lại.',
        );
        return await becomeAdmin(user);
      } catch (e) {
        set({
          status: 'signedOut',
          user: null,
          error: e instanceof Error ? e.message : 'Không đăng nhập được.',
        });
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
    async changePassword(current, next, confirm) {
      const { validateNewPassword } = await import('@/lib/admin/lock');
      validateNewPassword(next, confirm);
      await (await backend()).changePassword(current, next.trim());
      touch();
    },
    async apply(changeSet, okText = 'Đã lưu.') {
      const admin = get().status === 'admin' ? get().user : null;
      // Settings stay admin-only even when editing is open to everyone.
      const touchesSettings = changeSet.changes.some((c) => c.collection === 'settings');
      const user = admin ?? (isEditingOpen() && !touchesSettings ? GUEST_EDITOR : null);
      if (!user) {
        useToastStore.getState().show('Cần nhập mật khẩu admin trước khi sửa.', 'error');
        return false;
      }
      try {
        await (await backend()).apply(changeSet, user);
        if (admin) touch();
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
