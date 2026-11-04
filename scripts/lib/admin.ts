/**
 * Shared Firebase Admin SDK bootstrap for CLI scripts.
 *
 * --emulator (default): talks to the local Emulator Suite, project "demo-gia-pha", reads .env.emulator.
 * --real --project <id>: talks to a real project using Application Default Credentials
 *   (set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key), reads .env.
 */
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { applicationDefault, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const EMULATOR_PROJECT = 'demo-gia-pha';

export interface AdminContext {
  app: App;
  db: Firestore;
  auth: Auth;
  projectId: string;
  clanId: string;
  adminEmail: string;
  emulator: boolean;
}

export interface TargetOptions {
  real: boolean;
  project?: string;
}

function loadEnv(file: string): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

export function connect({ real, project }: TargetOptions): AdminContext {
  if (real) {
    loadEnv('.env');
    const projectId = project ?? process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) throw new Error('Thiếu --project <id> (hoặc VITE_FIREBASE_PROJECT_ID trong .env).');
    if (projectId.startsWith('demo-')) throw new Error('Project "demo-…" chỉ dùng cho emulator.');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('Cần đặt GOOGLE_APPLICATION_CREDENTIALS trỏ tới file khóa service account (xem README).');
    }
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const app = initializeApp({ credential: applicationDefault(), projectId });
    return finish(app, projectId, false);
  }
  loadEnv('.env.emulator');
  // No Google Cloud metadata server locally; skip the lookup (avoids a noisy warning).
  process.env.METADATA_SERVER_DETECTION ??= 'none';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const app = initializeApp({ projectId: EMULATOR_PROJECT });
  return finish(app, EMULATOR_PROJECT, true);
}

function finish(app: App, projectId: string, emulator: boolean): AdminContext {
  const clanId = process.env.VITE_CLAN_ID?.trim();
  const adminEmail = process.env.VITE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!clanId) throw new Error('Thiếu VITE_CLAN_ID.');
  if (!adminEmail) throw new Error('Thiếu VITE_ADMIN_EMAIL.');
  return { app, db: getFirestore(app), auth: getAuth(app), projectId, clanId, adminEmail, emulator };
}

export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} Gõ "dong y" để tiếp tục: `);
    return answer.trim().toLowerCase() === 'dong y';
  } finally {
    rl.close();
  }
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Creates or updates the single admin account and registers its uid in
 * clans/{clanId}/config/admins. Returns the uid.
 */
export async function upsertAdmin(ctx: AdminContext, code: string): Promise<string> {
  if (code.length < 8) throw new Error('Mã admin phải có ít nhất 8 ký tự.');
  let uid: string;
  try {
    const existing = await ctx.auth.getUserByEmail(ctx.adminEmail);
    await ctx.auth.updateUser(existing.uid, { password: code, emailVerified: true, disabled: false });
    uid = existing.uid;
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    const created = await ctx.auth.createUser({ email: ctx.adminEmail, password: code, emailVerified: true });
    uid = created.uid;
  }
  // Replace the list: exactly one admin (SPEC §4).
  await ctx.db.doc(`clans/${ctx.clanId}/config/admins`).set({ uids: [uid] });
  // Sign out existing sessions that used the old code.
  await ctx.auth.revokeRefreshTokens(uid);
  return uid;
}
