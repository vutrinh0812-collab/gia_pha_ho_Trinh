/** Upcoming death anniversaries (ngày giỗ, SPEC §9), computed from the clan model. */
import type { ClanModel, PersonRec } from './clanModel';
import { yearOf } from './format';
import { daysBetween, nextLunarAnniversary, type SolarDate } from './lunar';

export interface Anniversary {
  person: PersonRec;
  /** Solar date of the next anniversary on or after `from`. */
  date: SolarDate;
  inDays: number;
  lunar: { day: number; month: number };
  /** Years since the death, at that anniversary (null when the year is unknown). */
  yearsSince: number | null;
}

export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export function todaySolar(now = new Date()): SolarDate {
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}

export function formatSolarShort(d: SolarDate, withYear = false): string {
  const weekday = WEEKDAYS[new Date(d.year, d.month - 1, d.day).getDay()];
  return `${weekday}, ${d.day}/${d.month}${withYear ? `/${d.year}` : ''}`;
}

export function upcomingAnniversaries(model: ClanModel, from: SolarDate, withinDays = 60): Anniversary[] {
  const out: Anniversary[] = [];
  for (const person of model.persons) {
    const lunar = person.deathAnniversaryLunar;
    if (!lunar) continue;
    const date = nextLunarAnniversary(lunar.day, lunar.month, from);
    const inDays = daysBetween(from, date);
    if (inDays > withinDays) continue;
    const deathYear = yearOf(person.death);
    out.push({ person, date, inDays, lunar, yearsSince: deathYear === null ? null : date.year - deathYear });
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.person.fullName.localeCompare(b.person.fullName, 'vi'));
}
