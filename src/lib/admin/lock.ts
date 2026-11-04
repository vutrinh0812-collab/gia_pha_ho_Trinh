/**
 * Password lock for admin mode, checked in the browser only.
 *
 * There is no server-side account: the password unlocks the editing screens,
 * and the database rules let anyone write (see firestore.rules). It keeps casual
 * visitors out of the admin screens; it does not stop someone who uses the
 * browser's developer tools. The stored value is a salted SHA-256 hash, so the
 * password itself is never saved in the database.
 */
import type { AdminUser } from './backend';

/** Password used until it is changed on the admin page. */
export const DEFAULT_ADMIN_PASSWORD = '7150565';
export const MIN_PASSWORD_LENGTH = 4;
const DEFAULT_SALT = 'gia-pha-default';

/** The single admin "user" every unlocked browser acts as (audit log `by`). */
export const WEB_ADMIN: AdminUser = { uid: 'web-admin', email: null };

export interface StoredLock {
  salt: string;
  hash: string;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password.trim()}`);
}

export async function makeLock(password: string): Promise<StoredLock> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return { salt, hash: await hashPassword(password, salt) };
}

export async function defaultLock(): Promise<StoredLock> {
  return { salt: DEFAULT_SALT, hash: await hashPassword(DEFAULT_ADMIN_PASSWORD, DEFAULT_SALT) };
}

export async function checkPassword(password: string, lock: StoredLock): Promise<boolean> {
  return (await hashPassword(password, lock.salt)) === lock.hash;
}

/** Throws a Vietnamese message when the new password is not acceptable. */
export function validateNewPassword(next: string, confirm: string): void {
  if (next.trim().length < MIN_PASSWORD_LENGTH) throw new Error(`Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  if (next.trim() !== confirm.trim()) throw new Error('Hai lần nhập mật khẩu mới không giống nhau.');
}

/** "Signed in" lives in sessionStorage, so it ends with the browser tab. */
export function createSession(key: string, user: AdminUser) {
  const listeners = new Set<(u: AdminUser | null) => void>();
  const read = (): boolean => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const write = (on: boolean) => {
    try {
      if (on) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    } catch {
      /* storage blocked: the session lasts until reload */
    }
  };
  return {
    onUserChange(cb: (u: AdminUser | null) => void) {
      listeners.add(cb);
      cb(read() ? user : null);
      return () => {
        listeners.delete(cb);
      };
    },
    start() {
      write(true);
      listeners.forEach((l) => l(user));
    },
    end() {
      write(false);
      listeners.forEach((l) => l(null));
    },
  };
}
