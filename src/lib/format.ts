/** Vietnamese display formatting for people and dates. */
import { canChiOfYear } from './lunar';
import type { DateInfo, Gender, PersonFields } from './types';

const ORDINALS = ['cả', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];

/** 1 → "I", 4 → "IV", 14 → "XIV" (birth order in the book is written this way). */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Year of a date, from the solar part or else the lunar year. */
export function yearOf(d: DateInfo | undefined): number | null {
  if (!d) return null;
  if (d.solar) return Number(d.solar.slice(0, 4));
  return d.lunar?.year ?? null;
}

/** Birth year alone, for the tree: "1890", "k. 1820", "" when unknown. */
export function birthYear(p: Pick<PersonFields, 'birth'>): string {
  const b = yearOf(p.birth);
  return b === null ? '' : `${p.birth?.approximate ? 'k. ' : ''}${b}`;
}

/** "1890 – 1950", "k. 1820 – ?", "1990" (living), "" when nothing is known. */
export function lifeSpan(p: Pick<PersonFields, 'birth' | 'death'>): string {
  const b = yearOf(p.birth);
  const d = yearOf(p.death);
  const deceased = p.death?.isDeceased === true;
  const bText = b === null ? '?' : `${p.birth?.approximate ? 'k. ' : ''}${b}`;
  if (!deceased) return b === null ? '' : bText;
  const dText = d === null ? '?' : `${p.death?.approximate ? 'k. ' : ''}${d}`;
  return `${bText} – ${dText}`;
}

/** "12/3/1950", "tháng 3/1950", "năm 1950", with "khoảng" and the lunar date when known. */
export function formatDateInfo(d: DateInfo | undefined): string {
  if (!d) return '';
  const parts: string[] = [];
  if (d.solar) {
    const [y, m, day] = d.solar.split('-');
    const solar = day ? `${Number(day)}/${Number(m)}/${y}` : m ? `tháng ${Number(m)}/${y}` : `năm ${y}`;
    parts.push(`${d.approximate ? 'khoảng ' : ''}${solar}`);
  }
  const l = d.lunar;
  if (l && (l.day || l.month || l.year)) {
    let lunar = '';
    if (l.day && l.month) lunar = `${l.day}/${l.month}${l.isLeapMonth ? ' nhuận' : ''}`;
    else if (l.month) lunar = `tháng ${l.month}${l.isLeapMonth ? ' nhuận' : ''}`;
    if (l.year) lunar += `${lunar ? ' ' : ''}năm ${canChiOfYear(l.year)}`;
    parts.push(d.solar ? `(âm lịch ${lunar})` : `${d.approximate ? 'khoảng ' : ''}${lunar} âm lịch`);
  }
  return parts.join(' ');
}

/** Role of a married-in spouse: "Vợ", "Vợ cả", "Vợ hai", "Chồng"… */
export function spouseRole(spouseGender: Gender | undefined, order: number, unionCount: number): string {
  const base = spouseGender === 'male' ? 'Chồng' : 'Vợ';
  if (unionCount <= 1) return base;
  return `${base} ${ORDINALS[order - 1] ?? order}`;
}

/** Heading for a group of children when a person had several marriages: "Con bà cả". */
export function childrenGroupLabel(spouseGender: Gender | undefined, order: number): string {
  const title = spouseGender === 'male' ? 'ông' : 'bà';
  return `Con ${title} ${ORDINALS[order - 1] ?? order}`;
}

export function genderLabel(g: Gender): string {
  return g === 'male' ? 'Nam' : 'Nữ';
}

/** Given name (last word): "Trịnh Văn An" → "An". */
export function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? fullName;
}

/**
 * Notes as shown to readers: without the book reference ("Sổ gia phả, trang 38.")
 * that the book import used to add (DECISIONS D61). Empty → null.
 */
export function visibleNotes(notes: string | undefined | null): string | null {
  if (!notes) return null;
  const text = notes
    .replace(/Sổ gia phả,?\s*trang\s*\d+\.?/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

/**
 * A person's "Tên khác" (D93): the field itself, or, for records made before it, their
 * tên húy, tên tự and tên hiệu together.
 */
export function otherName(o: { khac?: string; huy?: string; tu?: string; hieu?: string } | undefined): string {
  if (!o) return '';
  return o.khac?.trim() || [o.huy, o.tu, o.hieu].map((v) => v?.trim()).filter(Boolean).join(', ');
}

/**
 * The text of the "Tên khác" input while it is being typed: exactly what was typed, spaces
 * included (D94); the older húy/tự/hiệu joined only while nothing has been typed yet.
 */
export function otherNameDraft(o: { khac?: string; huy?: string; tu?: string; hieu?: string } | undefined): string {
  return o?.khac !== undefined ? o.khac : otherName(o);
}
