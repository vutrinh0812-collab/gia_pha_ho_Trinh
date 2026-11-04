/**
 * Admin edits as change sets (SPEC §6). Every admin action becomes one change set:
 * a list of document writes plus a summary. A backend writes all of them and one
 * audit entry per change in a single batch, sharing a groupId so the whole action
 * can be undone at once.
 *
 * This module is pure: it reads the ClanModel and returns data; nothing is written here.
 */
import type { ClanModel, PersonRec } from '../clanModel';
import { hasChildren } from '../generation';
import type { AuditCollection, ClanSettings, PersonFields, UnionFields } from '../types';
import { PERSON_KEYS, UNION_KEYS, validatePersonFields, validateSettings, validateUnionFields } from '../validators';

export type Doc = Record<string, unknown>;

export interface Change {
  collection: AuditCollection;
  id: string;
  action: 'create' | 'update' | 'delete';
  /** Content before (absent on create). Meta fields (createdAt…) are never included. */
  before?: Doc;
  /** Content after (absent on delete). */
  after?: Doc;
}

export interface ChangeSet {
  groupId: string;
  summary: string;
  changes: Change[];
}

/** A rule of the clan was broken; the message is shown to the admin as is. */
export class AdminError extends Error {
  override name = 'AdminError';
}

export const SETTINGS_ID = 'main';
const SETTINGS_KEYS = [
  'clanName', 'title', 'subtitle', 'rootPersonId', 'coupletLeft', 'coupletRight', 'colophon',
  'defaultThemeId', 'showMaternalDescendants',
] as const;

/** Random Firestore-style id. */
export function newId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** Drops undefined values and empty strings/maps, recursively; returns a plain JSON object. */
export function clean<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Doc = {};
      for (const [k, x] of Object.entries(v as Doc)) {
        const w = walk(x);
        if (w === undefined || w === '') continue;
        if (w && typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length === 0) continue;
        out[k] = w;
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

function pick(doc: object, keys: readonly string[]): Doc {
  const out: Doc = {};
  for (const k of keys) if (k in doc) out[k] = (doc as Doc)[k];
  return clean(out);
}

export const personContent = (p: object): PersonFields => pick(p, PERSON_KEYS) as unknown as PersonFields;
export const unionContent = (u: object): UnionFields => pick(u, UNION_KEYS) as unknown as UnionFields;
export const settingsContent = (s: object): ClanSettings => pick(s, SETTINGS_KEYS) as unknown as ClanSettings;

/** Order-independent JSON, for comparing documents. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Doc)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Doc)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

function checkPerson(fields: PersonFields): PersonFields {
  const c = clean(fields);
  const errors = validatePersonFields(c);
  if (errors.length) throw new AdminError(errors.join(' '));
  return c;
}

function checkUnion(fields: UnionFields): UnionFields {
  const c = clean(fields);
  const errors = validateUnionFields(c);
  if (errors.length) throw new AdminError(errors.join(' '));
  return c;
}

function requirePerson(model: ClanModel, id: string): PersonRec {
  const p = model.get(id);
  if (!p) throw new AdminError('Không tìm thấy người này. Dữ liệu có thể vừa thay đổi; hãy tải lại trang.');
  return p;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'họ tên', otherNames: 'tên khác', gender: 'giới tính', isBloodline: 'huyết thống/dâu-rể',
  birthOrder: 'thứ tự con', birth: 'ngày sinh', death: 'ngày mất', deathAnniversaryLunar: 'ngày giỗ',
  burialPlace: 'nơi an táng', photoUrl: 'ảnh', occupation: 'nghề nghiệp', notes: 'ghi chú', branchLabel: 'chi',
};

/** Names of the fields that differ, in words. */
export function changedFields(before: Doc, after: Doc): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => stableJson(before[k]) !== stableJson(after[k])).map((k) => FIELD_LABELS[k] ?? k);
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export function editPerson(model: ClanModel, id: string, fields: PersonFields): ChangeSet {
  const person = requirePerson(model, id);
  const before = personContent(person);
  const after = checkPerson({ ...fields, parentUnionId: person.parentUnionId ?? null });
  const diff = changedFields(before as unknown as Doc, after as unknown as Doc);
  if (diff.length === 0) throw new AdminError('Chưa có thay đổi nào để lưu.');
  return {
    groupId: newId(),
    summary: `Sửa ${after.fullName}: ${diff.join(', ')}`,
    changes: [{ collection: 'persons', id, action: 'update', before: before as unknown as Doc, after: after as unknown as Doc }],
  };
}

/**
 * Adds a child. For a person with several marriages the union is chosen by the
 * admin; a person with no marriage yet gets one with an unknown spouse.
 */
export function addChild(model: ClanModel, parentId: string, fields: PersonFields, unionId?: string): ChangeSet {
  const parent = requirePerson(model, parentId);
  const changes: Change[] = [];
  const unions = parent.isBloodline ? model.index.unionsOf(parentId) : model.index.spouseUnionsOf(parentId);
  let union = unionId ? unions.find((u) => u.id === unionId) : unions[0];
  if (unionId && !union) throw new AdminError('Không tìm thấy cuộc hôn nhân đã chọn.');
  if (!union) {
    if (!parent.isBloodline) throw new AdminError('Dâu, rể chỉ thêm con qua người phối ngẫu trong họ.');
    const created = checkUnion({ bloodlinePersonId: parentId, spousePersonId: null, order: 1, status: 'married' });
    const id = newId();
    changes.push({ collection: 'unions', id, action: 'create', after: created as unknown as Doc });
    union = { id, ...created };
  }
  const siblings = model.index.childrenOf(union.id);
  const nextOrder = Math.max(0, ...siblings.map((s) => s.birthOrder ?? 0)) + 1;
  const bloodParent = model.get(union.bloodlinePersonId);
  const child = checkPerson({
    branchLabel: bloodParent?.branchLabel,
    birthOrder: nextOrder,
    ...fields,
    isBloodline: true,
    parentUnionId: union.id,
  });
  const childId = newId();
  changes.push({ collection: 'persons', id: childId, action: 'create', after: child as unknown as Doc });
  return { groupId: newId(), summary: `Thêm con của ${parent.fullName}: ${child.fullName}`, changes };
}

/** Adds a wife or husband: fills a marriage whose spouse is unknown, else a new marriage. */
export function addSpouse(model: ClanModel, personId: string, fields: PersonFields): ChangeSet {
  const person = requirePerson(model, personId);
  if (!person.isBloodline) throw new AdminError('Chỉ thêm vợ/chồng cho người trong họ.');
  const spouse = checkPerson({ ...fields, isBloodline: false, parentUnionId: null });
  const spouseId = newId();
  const changes: Change[] = [{ collection: 'persons', id: spouseId, action: 'create', after: spouse as unknown as Doc }];
  const unions = model.index.unionsOf(personId);
  const open = unions.find((u) => !u.spousePersonId);
  if (open) {
    const before = unionContent(open);
    const after = checkUnion({ ...before, spousePersonId: spouseId });
    changes.push({ collection: 'unions', id: open.id, action: 'update', before: before as unknown as Doc, after: after as unknown as Doc });
  } else {
    const order = Math.max(0, ...unions.map((u) => u.order)) + 1;
    const created = checkUnion({ bloodlinePersonId: personId, spousePersonId: spouseId, order, status: 'married' });
    changes.push({ collection: 'unions', id: newId(), action: 'create', after: created as unknown as Doc });
  }
  const role = spouse.gender === 'male' ? 'chồng' : 'vợ';
  return { groupId: newId(), summary: `Thêm ${role} của ${person.fullName}: ${spouse.fullName}`, changes };
}

/**
 * Reorders the families of generation 1 (persons with no parents in the book).
 * The first one becomes the root (settings.rootPersonId), as the tree starts from it.
 */
export function reorderFounders(model: ClanModel, orderedIds: string[]): ChangeSet {
  const founders = model.founders;
  if (orderedIds.length !== founders.length || !founders.every((f) => orderedIds.includes(f.id))) {
    throw new AdminError('Danh sách đời 1 đã thay đổi; hãy mở lại.');
  }
  const changes: Change[] = [];
  orderedIds.forEach((id, i) => {
    const p = requirePerson(model, id);
    if (p.birthOrder === i + 1) return;
    const before = personContent(p);
    changes.push({ collection: 'persons', id, action: 'update', before: before as unknown as Doc, after: { ...before, birthOrder: i + 1 } as Doc });
  });
  if (orderedIds[0] !== model.settings.rootPersonId) {
    const sBefore = settingsContent(model.settings);
    changes.push({
      collection: 'settings',
      id: SETTINGS_ID,
      action: 'update',
      before: sBefore as unknown as Doc,
      after: { ...sBefore, rootPersonId: orderedIds[0] } as unknown as Doc,
    });
  }
  if (!changes.length) throw new AdminError('Thứ tự không thay đổi.');
  return { groupId: newId(), summary: 'Đổi thứ tự các gia đình ở đời 1', changes };
}

/**
 * Adds a generation above the root ancestor (SPEC §6 "Thêm cha", root only).
 * When the book starts from several families (founders), the new father becomes
 * the common ancestor of all of them, so every generation number shifts together.
 */
export function addFather(model: ClanModel, personId: string, fields: PersonFields): ChangeSet {
  const rootId = personId;
  const root = requirePerson(model, rootId);
  if (!model.founders.some((p) => p.id === rootId) || root.parentUnionId) {
    throw new AdminError('Chỉ thêm cha cho thủy tổ (người ở đời 1).');
  }
  const father = checkPerson({ ...fields, gender: 'male', isBloodline: true, parentUnionId: null });
  const fatherId = newId();
  const unionId = newId();
  const union = checkUnion({ bloodlinePersonId: fatherId, spousePersonId: null, order: 1, status: 'married' });
  const adopted = model.founders.filter((p) => !p.parentUnionId);
  const children = adopted.map((p, i) => {
    const before = personContent(p);
    return { person: p, before, after: checkPerson({ ...before, parentUnionId: unionId, birthOrder: i + 1 }) };
  });
  const sBefore = settingsContent(model.settings);
  const sAfter = { ...sBefore, rootPersonId: fatherId };
  const names = adopted.length > 1 ? `${adopted.length} gia đình đời 1` : root.fullName;
  return {
    groupId: newId(),
    summary: `Thêm cha của ${names}: ${father.fullName} (thủy tổ mới)`,
    changes: [
      { collection: 'persons', id: fatherId, action: 'create', after: father as unknown as Doc },
      { collection: 'unions', id: unionId, action: 'create', after: union as unknown as Doc },
      ...children.map(
        (c): Change => ({ collection: 'persons', id: c.person.id, action: 'update', before: c.before as unknown as Doc, after: c.after as unknown as Doc }),
      ),
      { collection: 'settings', id: SETTINGS_ID, action: 'update', before: sBefore as unknown as Doc, after: sAfter as unknown as Doc },
    ],
  };
}

/** Sets the birth order of a union's children to the given sequence (1, 2, 3…). */
export function reorderChildren(model: ClanModel, unionId: string, orderedIds: string[]): ChangeSet {
  const kids = model.index.childrenOf(unionId);
  if (orderedIds.length !== kids.length || !kids.every((k) => orderedIds.includes(k.id))) {
    throw new AdminError('Danh sách con đã thay đổi; hãy mở lại.');
  }
  const changes: Change[] = [];
  orderedIds.forEach((id, i) => {
    const p = requirePerson(model, id);
    if (p.birthOrder === i + 1) return;
    const before = personContent(p);
    changes.push({ collection: 'persons', id, action: 'update', before: before as unknown as Doc, after: { ...before, birthOrder: i + 1 } as Doc });
  });
  if (!changes.length) throw new AdminError('Thứ tự không thay đổi.');
  const parent = model.get(model.index.unions.get(unionId)?.bloodlinePersonId);
  return { groupId: newId(), summary: `Đổi thứ tự các con của ${parent?.fullName ?? '…'}`, changes };
}

/**
 * Deletes a person (SPEC §3 "Xóa an toàn"): refused while they still have children,
 * and never the root ancestor. A clan member's marriages go with them, as do spouses
 * who have no other marriage; a spouse's marriage that has children keeps them with
 * an unknown spouse.
 */
export function deletePerson(model: ClanModel, id: string): ChangeSet {
  const person = requirePerson(model, id);
  if (id === model.rootId) throw new AdminError('Không thể xóa thủy tổ. Hãy thêm cha cho thủy tổ hoặc chọn thủy tổ khác trước.');
  if (person.isBloodline && hasChildren(model.index, id)) {
    const n = model.index.unionsOf(id).reduce((k, u) => k + model.index.childrenOf(u.id).length, 0);
    throw new AdminError(`Không thể xóa ${person.fullName} vì còn ${n} người con. Hãy xóa hoặc chuyển các con trước.`);
  }
  const changes: Change[] = [];
  const del = (collection: AuditCollection, docId: string, before: object) =>
    changes.push({ collection, id: docId, action: 'delete', before: before as Doc });

  if (person.isBloodline) {
    for (const u of model.index.unionsOf(id)) {
      del('unions', u.id, unionContent(u));
      const spouse = model.get(u.spousePersonId);
      if (spouse && model.index.spouseUnionsOf(spouse.id).length <= 1 && model.index.unionsOf(spouse.id).length === 0) {
        del('persons', spouse.id, personContent(spouse));
      }
    }
  } else {
    for (const u of model.index.spouseUnionsOf(id)) {
      const before = unionContent(u);
      if (model.index.childrenOf(u.id).length) {
        changes.push({ collection: 'unions', id: u.id, action: 'update', before: before as unknown as Doc, after: { ...before, spousePersonId: null } as Doc });
      } else {
        del('unions', u.id, before);
      }
    }
  }
  del('persons', id, personContent(person));
  const extra = changes.filter((c) => c.collection === 'persons').length - 1;
  return {
    groupId: newId(),
    summary: `Xóa ${person.fullName}${extra > 0 ? ` (kèm ${extra} người phối ngẫu)` : ''}`,
    changes,
  };
}

export function editSettings(model: ClanModel, fields: ClanSettings): ChangeSet {
  const before = settingsContent(model.settings);
  const after = clean({ ...fields, rootPersonId: model.rootId });
  const errors = validateSettings(after);
  if (errors.length) throw new AdminError(errors.join(' '));
  if (stableJson(before) === stableJson(after)) throw new AdminError('Chưa có thay đổi nào để lưu.');
  return {
    groupId: newId(),
    summary: 'Sửa cài đặt dòng họ',
    changes: [{ collection: 'settings', id: SETTINGS_ID, action: 'update', before: before as unknown as Doc, after: after as unknown as Doc }],
  };
}

/* ------------------------------------------------------------------ */
/* Undo                                                                */
/* ------------------------------------------------------------------ */

export interface AuditRecord {
  id: string;
  at: number;
  by: string;
  action: Change['action'];
  collection: AuditCollection;
  docId: string;
  before?: Doc;
  after?: Doc;
  groupId?: string;
  summary?: string;
}

/** The document as it is now, in the same shape as audit snapshots (or null). */
export function currentDoc(model: ClanModel, collection: AuditCollection, id: string): Doc | null {
  if (collection === 'persons') {
    const p = model.index.persons.get(id);
    return p ? (personContent(p) as unknown as Doc) : null;
  }
  if (collection === 'unions') {
    const u = model.index.unions.get(id);
    return u ? (unionContent(u) as unknown as Doc) : null;
  }
  return settingsContent(model.settings) as unknown as Doc;
}

/**
 * The change set that reverses one admin action (all entries of its group).
 * Refused when a document was changed again afterwards, so a later edit is never lost.
 */
export function undoGroup(model: ClanModel, entries: AuditRecord[], summary: string): ChangeSet {
  if (!entries.length) throw new AdminError('Không có gì để hoàn tác.');
  const changes: Change[] = [];
  for (const e of entries) {
    const now = currentDoc(model, e.collection, e.docId);
    const expected = e.action === 'delete' ? null : (e.after ?? null);
    if (stableJson(now) !== stableJson(expected)) {
      throw new AdminError('Không hoàn tác được vì dữ liệu này đã được sửa sau đó. Hãy hoàn tác thay đổi mới hơn trước.');
    }
    if (e.action === 'create') changes.push({ collection: e.collection, id: e.docId, action: 'delete', before: now! });
    else if (e.action === 'delete') changes.push({ collection: e.collection, id: e.docId, action: 'create', after: e.before! });
    else changes.push({ collection: e.collection, id: e.docId, action: 'update', before: now!, after: e.before! });
  }
  // Undo deletions before creations that might depend on them, and the other way round.
  changes.reverse();
  return { groupId: newId(), summary: `Hoàn tác: ${summary}`, changes };
}
