/**
 * Where admin actions are written. Two implementations behind one interface:
 * Firebase (password lock + batched Firestore writes) and an in-memory demo used by the
 * preview build, so the admin mode can be tried without a Firebase project.
 */
import type { AuditRecord, ChangeSet } from './changes';

export interface AdminUser {
  uid: string;
  email: string | null;
}

export interface AdminBackend {
  /** Restores a session after a reload; calls back with null when signed out. */
  onUserChange(cb: (user: AdminUser | null) => void): () => void;
  /** Unlocks admin mode with the password; throws an Error with a Vietnamese message. */
  signIn(code: string): Promise<AdminUser>;
  signOut(): Promise<void>;
  /** True when this user may use admin mode. */
  isAdmin(user: AdminUser): Promise<boolean>;
  /** Replaces the admin password after checking the current one. */
  changePassword(current: string, next: string): Promise<void>;
  /** Writes the documents and their audit entries in one batch. */
  apply(set: ChangeSet, user: AdminUser): Promise<void>;
  /** Recent audit entries, newest first. */
  listAudit(limit?: number): Promise<AuditRecord[]>;
  /** Stores a resized photo and returns its URL, or null when photos are not configured. */
  uploadPhoto?(personId: string, image: Blob, thumb: Blob): Promise<string>;
}

const IS_DEMO = import.meta.env.VITE_DATA_SOURCE === 'demo';

let backend: Promise<AdminBackend> | null = null;

export function getAdminBackend(): Promise<AdminBackend> {
  backend ??= IS_DEMO
    ? import('./demoBackend').then((m) => m.demoBackend)
    : import('./firebaseBackend').then((m) => m.createFirebaseBackend());
  return backend;
}
