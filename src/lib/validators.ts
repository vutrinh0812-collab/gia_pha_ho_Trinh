/**
 * Client-side validation mirroring firestore.rules (keep both in sync).
 * Messages are user-facing, hence Vietnamese.
 */
import { GENDERS, LIMITS, PHOTO_ZOOM_MAX, UNION_STATUSES } from './types';
import type { ClanSettings, DateInfo, PersonFields, UnionFields } from './types';

export type ValidationErrors = string[];

const SOLAR_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

export const PERSON_KEYS = [
  'fullName', 'otherNames', 'gender', 'isBloodline', 'parentUnionId', 'birthOrder', 'birth', 'death',
  'deathAnniversaryLunar', 'burialPlace', 'photoUrl', 'photoCrop', 'occupation', 'notes', 'branchLabel',
] as const;
export const UNION_KEYS = ['bloodlinePersonId', 'spousePersonId', 'order', 'status', 'notes'] as const;
export const META_KEYS = ['createdAt', 'updatedAt', 'updatedBy'] as const;

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const optString = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length <= max);

function checkUnknownKeys(obj: object, allowed: readonly string[], errors: ValidationErrors, label: string) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${label}: trường không hợp lệ "${key}".`);
  }
}

/** Is a 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' string, with a real calendar day. */
export function isValidPartialSolar(value: string): boolean {
  if (!SOLAR_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (d === undefined || m === undefined || y === undefined) return true;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function validateDate(d: DateInfo & { isDeceased?: boolean }, label: string, errors: ValidationErrors, isDeath: boolean) {
  checkUnknownKeys(d, ['solar', 'lunar', 'approximate', 'place', ...(isDeath ? ['isDeceased'] : [])], errors, label);
  if (d.solar !== undefined && (typeof d.solar !== 'string' || !isValidPartialSolar(d.solar))) {
    errors.push(`${label}: ngày dương lịch phải có dạng NNNN, NNNN-TT hoặc NNNN-TT-NN.`);
  }
  if (d.lunar !== undefined) {
    const l = d.lunar;
    checkUnknownKeys(l, ['day', 'month', 'year', 'isLeapMonth'], errors, `${label} (âm lịch)`);
    if (l.day !== undefined && !isInt(l.day, 1, 30)) errors.push(`${label}: ngày âm lịch phải từ 1 đến 30.`);
    if (l.month !== undefined && !isInt(l.month, 1, 12)) errors.push(`${label}: tháng âm lịch phải từ 1 đến 12.`);
    if (l.year !== undefined && !isInt(l.year, 1, 9999)) errors.push(`${label}: năm âm lịch không hợp lệ.`);
    if (l.isLeapMonth !== undefined && typeof l.isLeapMonth !== 'boolean') errors.push(`${label}: tháng nhuận không hợp lệ.`);
  }
  if (d.approximate !== undefined && typeof d.approximate !== 'boolean') errors.push(`${label}: "khoảng" không hợp lệ.`);
  if (!optString(d.place, LIMITS.shortText)) errors.push(`${label}: địa điểm quá dài.`);
  if (isDeath && typeof d.isDeceased !== 'boolean') errors.push(`${label}: thiếu trạng thái đã mất.`);
}

export function validatePersonFields(p: PersonFields): ValidationErrors {
  const errors: ValidationErrors = [];
  checkUnknownKeys(p, PERSON_KEYS, errors, 'Người');
  const name = typeof p.fullName === 'string' ? p.fullName.trim() : '';
  if (name.length < 1 || name.length > LIMITS.fullName) errors.push(`Họ tên phải có từ 1 đến ${LIMITS.fullName} ký tự.`);
  if (!GENDERS.includes(p.gender)) errors.push('Giới tính không hợp lệ.');
  if (typeof p.isBloodline !== 'boolean') errors.push('Thiếu thông tin huyết thống / dâu-rể.');
  if (p.parentUnionId !== undefined && p.parentUnionId !== null && (typeof p.parentUnionId !== 'string' || p.parentUnionId === '')) {
    errors.push('Mã cha mẹ không hợp lệ.');
  }
  if (p.birthOrder !== undefined && !isInt(p.birthOrder, 1, LIMITS.maxBirthOrder)) {
    errors.push(`Thứ tự con phải từ 1 đến ${LIMITS.maxBirthOrder}.`);
  }
  if (p.otherNames !== undefined) {
    checkUnknownKeys(p.otherNames, ['khac', 'huy', 'tu', 'hieu', 'thuong'], errors, 'Tên khác');
    for (const v of Object.values(p.otherNames)) {
      if (!optString(v, LIMITS.shortText)) errors.push('Tên khác quá dài.');
    }
  }
  if (p.birth !== undefined) validateDate(p.birth, 'Ngày sinh', errors, false);
  if (p.death !== undefined) validateDate(p.death, 'Ngày mất', errors, true);
  if (p.deathAnniversaryLunar !== undefined) {
    const a = p.deathAnniversaryLunar;
    if (!isInt(a.day, 1, 30) || !isInt(a.month, 1, 12) || Object.keys(a).some((k) => k !== 'day' && k !== 'month')) {
      errors.push('Ngày giỗ phải có ngày (1–30) và tháng (1–12) âm lịch.');
    }
  }
  if (!optString(p.burialPlace, LIMITS.shortText)) errors.push('Nơi an táng quá dài.');
  if (!optString(p.occupation, LIMITS.shortText)) errors.push('Nghề nghiệp quá dài.');
  if (!optString(p.branchLabel, LIMITS.shortText)) errors.push('Tên chi quá dài.');
  if (!optString(p.notes, LIMITS.longText)) errors.push('Ghi chú quá dài.');
  // https:// URL (Storage) or inline base64 data:image/ URL when Storage is not enabled / in demo mode.
  const isHttpsPhoto =
    typeof p.photoUrl === 'string' && p.photoUrl.length <= LIMITS.url && p.photoUrl.startsWith('https://');
  const isDataPhoto =
    typeof p.photoUrl === 'string' &&
    p.photoUrl.length <= LIMITS.photoDataUrl &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photoUrl);
  if (p.photoUrl !== undefined && !isHttpsPhoto && !isDataPhoto) {
    errors.push('Đường dẫn ảnh không hợp lệ.');
  }
  if (p.photoCrop !== undefined) {
    const c = p.photoCrop as unknown as Record<string, unknown>;
    checkUnknownKeys(c, ['zoom', 'x', 'y'], errors, 'Căn chỉnh ảnh');
    const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    if (!num(c.zoom, 1, PHOTO_ZOOM_MAX) || !num(c.x, -PHOTO_ZOOM_MAX, PHOTO_ZOOM_MAX) || !num(c.y, -PHOTO_ZOOM_MAX, PHOTO_ZOOM_MAX)) {
      errors.push('Căn chỉnh ảnh không hợp lệ.');
    }
  }
  return errors;
}

export function validateUnionFields(u: UnionFields): ValidationErrors {
  const errors: ValidationErrors = [];
  checkUnknownKeys(u, UNION_KEYS, errors, 'Hôn nhân');
  if (typeof u.bloodlinePersonId !== 'string' || u.bloodlinePersonId === '') errors.push('Thiếu người thuộc huyết thống.');
  if (u.spousePersonId !== undefined && u.spousePersonId !== null && (typeof u.spousePersonId !== 'string' || u.spousePersonId === '')) {
    errors.push('Mã vợ/chồng không hợp lệ.');
  }
  if (u.spousePersonId && u.spousePersonId === u.bloodlinePersonId) errors.push('Một người không thể kết hôn với chính mình.');
  if (!isInt(u.order, 1, LIMITS.maxUnionOrder)) errors.push(`Thứ tự vợ/chồng phải từ 1 đến ${LIMITS.maxUnionOrder}.`);
  if (u.status !== undefined && !UNION_STATUSES.includes(u.status)) errors.push('Tình trạng hôn nhân không hợp lệ.');
  if (!optString(u.notes, LIMITS.longText)) errors.push('Ghi chú quá dài.');
  return errors;
}

export function validateSettings(s: ClanSettings): ValidationErrors {
  const errors: ValidationErrors = [];
  const required = ['clanName', 'title', 'rootPersonId', 'coupletLeft', 'coupletRight', 'colophon', 'defaultThemeId'] as const;
  checkUnknownKeys(s, [...required, 'subtitle', 'showMaternalDescendants', 'openEditing'], errors, 'Cài đặt');
  for (const k of required) {
    const v = s[k];
    if (typeof v !== 'string' || v.length > LIMITS.shortText || (k !== 'coupletLeft' && k !== 'coupletRight' && k !== 'colophon' && v === '')) {
      errors.push(`Cài đặt "${k}" không hợp lệ.`);
    }
  }
  if (!optString(s.subtitle, LIMITS.shortText)) errors.push('Phụ đề quá dài.');
  if (typeof s.showMaternalDescendants !== 'boolean') errors.push('Thiếu tùy chọn hiển thị bên ngoại.');
  if (s.openEditing !== undefined && typeof s.openEditing !== 'boolean') errors.push('Tùy chọn quyền chỉnh sửa không hợp lệ.');
  return errors;
}
