/**
 * Vietnamese lunar calendar (âm lịch) conversion.
 *
 * Port of Hồ Ngọc Đức's algorithm ("Âm lịch Việt Nam", based on
 * "Astronomical Algorithms" by Jean Meeus), computed for UTC+7.
 * Valid roughly for years 1200–2199.
 */

export const VN_TIME_ZONE = 7;

export interface SolarDate {
  day: number;
  month: number;
  year: number;
}

export interface LunarDateFull {
  day: number;
  month: number;
  year: number;
  isLeapMonth: boolean;
}

const PI = Math.PI;
const INT = Math.floor;
/** Mean synodic month in days. */
const SYNODIC = 29.530588853;
/** Julian day of the new moon of 1900-01-01 (epoch for lunation numbers). */
const NEW_MOON_EPOCH = 2415021.076998695;

/** Julian day number of a Gregorian (or Julian, before 1582-10-15) date. */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/** Inverse of {@link jdFromDate}. */
export function jdToDate(jd: number): SolarDate {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

/** Julian date (with fraction, UT) of the k-th new moon after 1900-01-01. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltaT;
}

/** Sun's apparent longitude in radians [0, 2π) at Julian date `jdn` (UT). */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  return L;
}

/** Sector (0–11) of the sun's longitude at local midnight starting `dayNumber`. */
function getSunLongitudeSector(dayNumber: number, timeZone: number): number {
  return INT((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

function getNewMoonDay(k: number, timeZone: number): number {
  return INT(newMoon(k) + 0.5 + timeZone / 24);
}

/** Julian day of the first day of lunar month 11 of the given solar year. */
function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / SYNODIC);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitudeSector(nm, timeZone);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

/** Offset (in months after month 11) of the leap month in a 13-month lunar year. */
function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - NEW_MOON_EPOCH) / SYNODIC + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitudeSector(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitudeSector(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export function solarToLunar(day: number, month: number, year: number, timeZone = VN_TIME_ZONE): LunarDateFull {
  const dayNumber = jdFromDate(day, month, year);
  // The mean-lunation estimate can be off by one near month boundaries
  // (e.g. 2054-05-07), so search for the last new moon on or before the day.
  let k = INT((dayNumber - NEW_MOON_EPOCH) / SYNODIC) + 1;
  let monthStart = getNewMoonDay(k, timeZone);
  while (monthStart > dayNumber) monthStart = getNewMoonDay(--k, timeZone);
  while (getNewMoonDay(k + 1, timeZone) <= dayNumber) monthStart = getNewMoonDay(++k, timeZone);

  let a11 = getLunarMonth11(year, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = getLunarMonth11(year - 1, timeZone);
  } else {
    lunarYear = year + 1;
    b11 = getLunarMonth11(year + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let isLeapMonth = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) isLeapMonth = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth };
}

/** Julian day of day 1 of the given lunar month, or null if that (leap) month does not exist. */
function lunarMonthStartJd(month: number, year: number, isLeapMonth: boolean, timeZone: number): number | null {
  let a11: number;
  let b11: number;
  if (month < 11) {
    a11 = getLunarMonth11(year - 1, timeZone);
    b11 = getLunarMonth11(year, timeZone);
  } else {
    a11 = getLunarMonth11(year, timeZone);
    b11 = getLunarMonth11(year + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - NEW_MOON_EPOCH) / SYNODIC);
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (isLeapMonth && month !== leapMonth) return null;
    if (isLeapMonth || off >= leapOff) off += 1;
  } else if (isLeapMonth) {
    return null;
  }
  return getNewMoonDay(k + off, timeZone);
}

/**
 * Converts a lunar date to the solar calendar.
 * Returns null for a leap month that does not exist in that year or an invalid day.
 */
export function lunarToSolar(
  day: number,
  month: number,
  year: number,
  isLeapMonth = false,
  timeZone = VN_TIME_ZONE,
): SolarDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  const start = lunarMonthStartJd(month, year, isLeapMonth, timeZone);
  if (start === null) return null;
  if (day > lunarMonthLengthFromStart(start, timeZone)) return null;
  return jdToDate(start + day - 1);
}

function lunarMonthLengthFromStart(startJd: number, timeZone: number): number {
  const k = INT(0.5 + (startJd - NEW_MOON_EPOCH) / SYNODIC);
  // The next new moon after `startJd`.
  let next = getNewMoonDay(k + 1, timeZone);
  if (next <= startJd) next = getNewMoonDay(k + 2, timeZone);
  return next - startJd;
}

/** Number of days (29 or 30) in a lunar month; null if the month does not exist. */
export function lunarMonthLength(
  month: number,
  year: number,
  isLeapMonth = false,
  timeZone = VN_TIME_ZONE,
): number | null {
  const start = lunarMonthStartJd(month, year, isLeapMonth, timeZone);
  return start === null ? null : lunarMonthLengthFromStart(start, timeZone);
}

/** The leap month (1–12) of a lunar year, or 0 if the year has none. */
export function leapMonthOf(year: number, timeZone = VN_TIME_ZONE): number {
  // Months 1–10 of lunar year Y lie in the span month11(Y-1) → month11(Y);
  // months 11–12 of lunar year Y lie in the span month11(Y) → month11(Y+1).
  const first = leapMonthInSpan(year - 1, timeZone);
  if (first >= 1 && first <= 10) return first;
  const second = leapMonthInSpan(year, timeZone);
  if (second === 11 || second === 12) return second;
  return 0;
}

/** Leap month number inside the span starting at lunar month 11 of `solarYear`, or 0. */
function leapMonthInSpan(solarYear: number, timeZone: number): number {
  const a11 = getLunarMonth11(solarYear, timeZone);
  const b11 = getLunarMonth11(solarYear + 1, timeZone);
  if (b11 - a11 <= 365) return 0;
  let leap = getLeapMonthOffset(a11, timeZone) - 2;
  if (leap <= 0) leap += 12;
  return leap;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const;
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'] as const;

/** Can Chi name of a lunar year, e.g. 2024 → "Giáp Thìn". */
export function canChiOfYear(lunarYear: number): string {
  const can = CAN[(((lunarYear + 6) % 10) + 10) % 10]!;
  const chi = CHI[(((lunarYear + 8) % 12) + 12) % 12]!;
  return `${can} ${chi}`;
}

/** Day-of-anniversary for a lunar day/month in a given lunar year (giỗ). */
function anniversaryInLunarYear(day: number, month: number, lunarYear: number): SolarDate | null {
  // Giỗ follows the regular (non-leap) month. If the month has only 29 days,
  // a death on day 30 is commemorated on the last day of the month (day 29).
  const length = lunarMonthLength(month, lunarYear, false);
  if (length === null) return null;
  return lunarToSolar(Math.min(day, length), month, lunarYear, false);
}

function compareSolar(a: SolarDate, b: SolarDate): number {
  return jdFromDate(a.day, a.month, a.year) - jdFromDate(b.day, b.month, b.year);
}

/**
 * Next solar date (on or after `from`) of a lunar anniversary (ngày giỗ).
 */
export function nextLunarAnniversary(day: number, month: number, from: SolarDate): SolarDate {
  const fromLunarYear = solarToLunar(from.day, from.month, from.year).year;
  for (let y = fromLunarYear - 1; y <= fromLunarYear + 2; y++) {
    const candidate = anniversaryInLunarYear(day, month, y);
    if (candidate && compareSolar(candidate, from) >= 0) return candidate;
  }
  // Unreachable for valid input (day 1–30, month 1–12).
  throw new RangeError(`Invalid lunar day/month: ${day}/${month}`);
}

/** Days between two solar dates (b - a). */
export function daysBetween(a: SolarDate, b: SolarDate): number {
  return compareSolar(b, a);
}

export function formatLunar(d: Pick<LunarDateFull, 'day' | 'month'> & Partial<LunarDateFull>): string {
  const base = `${d.day}/${d.month}${d.isLeapMonth ? ' nhuận' : ''}`;
  return d.year !== undefined ? `${base} năm ${canChiOfYear(d.year)}` : `${base} âm lịch`;
}
