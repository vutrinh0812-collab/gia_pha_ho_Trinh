/**
 * Domain model (SPEC §3). Firestore layout: clans/{clanId}/{persons|unions|settings|auditLog|config}.
 *
 * Documents never store their own id; `id` is attached when reading (see `WithId`).
 * Timestamps are typed structurally so the same types work with the web SDK,
 * the Admin SDK (seed script) and plain test fixtures.
 */

export interface TimestampLike {
  toMillis(): number;
}

export type Gender = 'male' | 'female';

export const GENDERS: readonly Gender[] = ['male', 'female'];

export interface LunarDate {
  day?: number;
  month?: number;
  year?: number;
  isLeapMonth?: boolean;
}

export interface DateInfo {
  /** 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY' — partial dates are allowed. */
  solar?: string;
  lunar?: LunarDate;
  /** "khoảng năm…" */
  approximate?: boolean;
  place?: string;
}

export interface DeathInfo extends DateInfo {
  isDeceased: boolean;
}

export interface OtherNames {
  /** tên húy */
  huy?: string;
  /** tên tự */
  tu?: string;
  /** tên hiệu */
  hieu?: string;
  /** tên thường gọi */
  thuong?: string;
}

export interface DayMonth {
  day: number;
  month: number;
}

/** Editable content of a person document. */
export interface PersonFields {
  fullName: string;
  otherNames?: OtherNames;
  gender: Gender;
  /**
   * true  = born into the clan (descendant of the root, including daughters and,
   *         when recorded, daughters' children);
   * false = married in (dâu/rể).
   */
  isBloodline: boolean;
  /** Union this person was born from. null/undefined = root ancestor or spouse. */
  parentUnionId?: string | null;
  /** 1-based order among the children of `parentUnionId`. */
  birthOrder?: number;
  birth?: DateInfo;
  death?: DeathInfo;
  /** Death anniversary (ngày giỗ), lunar calendar. */
  deathAnniversaryLunar?: DayMonth;
  burialPlace?: string;
  photoUrl?: string;
  occupation?: string;
  notes?: string;
  /** Branch name, e.g. "Chi Giáp". */
  branchLabel?: string;
}

export interface DocMeta<T extends TimestampLike = TimestampLike> {
  createdAt: T;
  updatedAt: T;
  /** uid of the admin who last wrote the document. */
  updatedBy: string;
}

export type PersonDoc<T extends TimestampLike = TimestampLike> = PersonFields & DocMeta<T>;

export type UnionStatus = 'married' | 'divorced' | 'widowed';

export const UNION_STATUSES: readonly UnionStatus[] = ['married', 'divorced', 'widowed'];

/** Editable content of a union (marriage) document. */
export interface UnionFields {
  /** The partner who belongs to the clan by blood. */
  bloodlinePersonId: string;
  /** The married-in partner (may be unknown). */
  spousePersonId?: string | null;
  /** 1 = first wife/husband, 2 = second… */
  order: number;
  status?: UnionStatus;
  notes?: string;
}

export type UnionDoc<T extends TimestampLike = TimestampLike> = UnionFields & DocMeta<T>;

/** clans/{clanId}/settings/main */
export interface ClanSettings {
  clanName: string;
  title: string;
  subtitle?: string;
  rootPersonId: string;
  coupletLeft: string;
  coupletRight: string;
  colophon: string;
  defaultThemeId: string;
  /** Show daughters' children on the tree (default false). */
  showMaternalDescendants: boolean;
}

export type SettingsDoc<T extends TimestampLike = TimestampLike> = ClanSettings & DocMeta<T>;

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditCollection = 'persons' | 'unions' | 'settings';

/** clans/{clanId}/auditLog/{logId} — append-only. */
export interface AuditEntry<T extends TimestampLike = TimestampLike> {
  at: T;
  /** uid of the admin. */
  by: string;
  action: AuditAction;
  collection: AuditCollection;
  docId: string;
  /** Snapshot before the change (absent on create) — used for undo. */
  before?: Record<string, unknown>;
  /** Snapshot after the change (absent on delete). */
  after?: Record<string, unknown>;
  /** Entries written by one admin action share a group, undone together. */
  groupId?: string;
  /** What the admin did, in words ("Thêm con: Trịnh Văn An"). */
  summary?: string;
}

/** clans/{clanId}/config/admins — written only from the Firebase Console or Admin SDK. */
export interface AdminsConfig {
  uids: string[];
}

export type WithId<T> = T & { id: string };

export type Person = WithId<PersonDoc>;
export type Union = WithId<UnionDoc>;

/** Field limits shared by client validation and firestore.rules. Keep in sync! */
export const LIMITS = {
  fullName: 100,
  shortText: 200,
  longText: 5000,
  url: 1000,
  maxBirthOrder: 99,
  maxUnionOrder: 20,
} as const;
