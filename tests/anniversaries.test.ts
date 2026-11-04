import { upcomingAnniversaries, formatSolarShort } from '@/lib/anniversaries';
import { buildClanModel } from '@/lib/clanModel';
import { loadDemoSnapshot } from '@/lib/data/demoSource';
import { solarToLunar } from '@/lib/lunar';

const model = buildClanModel(loadDemoSnapshot())!;
const from = { day: 4, month: 11, year: 2026 };

describe('upcomingAnniversaries', () => {
  const list = upcomingAnniversaries(model, from, 60);

  it('lists anniversaries in the next 60 days, soonest first', () => {
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i]!.inDays).toBeGreaterThanOrEqual(list[i - 1]!.inDays);
    expect(list.every((a) => a.inDays >= 0 && a.inDays <= 60)).toBe(true);
  });

  it('falls on the right lunar day', () => {
    for (const a of list) {
      const l = solarToLunar(a.date.day, a.date.month, a.date.year);
      expect(l.month).toBe(a.lunar.month);
      expect(l.day).toBeLessThanOrEqual(a.lunar.day); // day 30 → 29 in short months
    }
  });

  it('counts the years since the death', () => {
    const withYear = list.find((a) => a.yearsSince !== null)!;
    expect(withYear.yearsSince).toBeGreaterThan(0);
  });

  it('formats dates with the weekday', () => {
    expect(formatSolarShort({ day: 11, month: 11, year: 2026 })).toBe('Thứ tư, 11/11');
  });
});
