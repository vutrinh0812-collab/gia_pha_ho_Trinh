import {
  canChiOfYear,
  daysBetween,
  formatLunar,
  jdFromDate,
  jdToDate,
  leapMonthOf,
  lunarMonthLength,
  lunarToSolar,
  nextLunarAnniversary,
  solarToLunar,
} from '@/lib/lunar';

describe('julian day', () => {
  it('matches known values', () => {
    expect(jdFromDate(1, 1, 2000)).toBe(2451545);
    expect(jdToDate(2451545)).toEqual({ day: 1, month: 1, year: 2000 });
  });
});

describe('solarToLunar — known Vietnamese dates', () => {
  it.each([
    // [solar d, m, y] → [lunar d, m, y, leap]
    [[10, 2, 2024], [1, 1, 2024, false]], // Tết Giáp Thìn
    [[29, 1, 2025], [1, 1, 2025, false]], // Tết Ất Tỵ
    [[17, 2, 2026], [1, 1, 2026, false]], // Tết Bính Ngọ
    [[22, 1, 2023], [1, 1, 2023, false]], // Tết Quý Mão
    [[21, 1, 1985], [1, 1, 1985, false]], // Tết 1985 in Vietnam (differs from China)
    [[22, 3, 2023], [1, 2, 2023, true]], // 1 tháng 2 nhuận 2023
    [[23, 5, 2020], [1, 4, 2020, true]], // 1 tháng 4 nhuận 2020
    [[17, 9, 2024], [15, 8, 2024, false]], // Tết Trung thu 2024
    [[2, 9, 1945], [26, 7, 1945, false]],
    [[9, 2, 2024], [30, 12, 2023, false]], // Giao thừa (month 12 of 2023 has 30 days)
  ] as const)('%j → %j', ([d, m, y], [ld, lm, ly, leap]) => {
    expect(solarToLunar(d, m, y)).toEqual({ day: ld, month: lm, year: ly, isLeapMonth: leap });
  });
});

describe('lunarToSolar', () => {
  it('converts Tết and leap months', () => {
    expect(lunarToSolar(1, 1, 2024)).toEqual({ day: 10, month: 2, year: 2024 });
    expect(lunarToSolar(1, 2, 2023, true)).toEqual({ day: 22, month: 3, year: 2023 });
    expect(lunarToSolar(1, 2, 2023, false)).toEqual({ day: 20, month: 2, year: 2023 });
  });

  it('rejects leap months that do not exist and invalid days', () => {
    expect(lunarToSolar(1, 3, 2023, true)).toBeNull();
    expect(lunarToSolar(1, 1, 2024, true)).toBeNull();
    expect(lunarToSolar(31, 1, 2024)).toBeNull();
    expect(lunarToSolar(1, 13, 2024)).toBeNull();
  });

  it('round-trips every day from 1900 to 2100', () => {
    const start = jdFromDate(1, 1, 1900);
    const end = jdFromDate(31, 12, 2100);
    for (let jd = start; jd <= end; jd++) {
      const s = jdToDate(jd);
      const l = solarToLunar(s.day, s.month, s.year);
      const back = lunarToSolar(l.day, l.month, l.year, l.isLeapMonth);
      if (!back || back.day !== s.day || back.month !== s.month || back.year !== s.year) {
        throw new Error(`Round trip failed for ${JSON.stringify(s)} → ${JSON.stringify(l)} → ${JSON.stringify(back)}`);
      }
    }
  });
});

describe('leap months and month lengths', () => {
  it.each([
    [2020, 4],
    [2023, 2],
    [2024, 0],
    [2025, 6],
    [2028, 5],
    [2033, 11],
  ])('leap month of %i is %i', (year, leap) => {
    expect(leapMonthOf(year)).toBe(leap);
  });

  it('lunar months have 29 or 30 days', () => {
    for (let y = 2000; y <= 2030; y++) {
      for (let m = 1; m <= 12; m++) {
        expect([29, 30]).toContain(lunarMonthLength(m, y));
      }
    }
  });
});

describe('can chi', () => {
  it.each([
    [2024, 'Giáp Thìn'],
    [2025, 'Ất Tỵ'],
    [2026, 'Bính Ngọ'],
    [1945, 'Ất Dậu'],
    [1984, 'Giáp Tý'],
  ])('%i → %s', (y, name) => {
    expect(canChiOfYear(y)).toBe(name);
  });

  it('formats lunar dates in Vietnamese', () => {
    expect(formatLunar({ day: 15, month: 8 })).toBe('15/8 âm lịch');
    expect(formatLunar({ day: 1, month: 2, year: 2023, isLeapMonth: true })).toBe('1/2 nhuận năm Quý Mão');
  });
});

describe('nextLunarAnniversary (ngày giỗ)', () => {
  it('finds the next occurrence on or after a date', () => {
    // 15/8 âm lịch after 1/9/2024 → 17/9/2024
    expect(nextLunarAnniversary(15, 8, { day: 1, month: 9, year: 2024 })).toEqual({ day: 17, month: 9, year: 2024 });
    // Same day counts
    expect(nextLunarAnniversary(15, 8, { day: 17, month: 9, year: 2024 })).toEqual({ day: 17, month: 9, year: 2024 });
    // After it passed → next lunar year
    const next = nextLunarAnniversary(15, 8, { day: 18, month: 9, year: 2024 });
    expect(next.year).toBe(2025);
    expect(solarToLunar(next.day, next.month, next.year)).toMatchObject({ day: 15, month: 8, isLeapMonth: false });
  });

  it('handles anniversaries in lunar month 12 that fall in January/February', () => {
    // 20/12 âm of lunar year 2025 falls in early 2026
    const d = nextLunarAnniversary(20, 12, { day: 1, month: 1, year: 2026 });
    expect(d.year).toBe(2026);
    expect(solarToLunar(d.day, d.month, d.year)).toMatchObject({ day: 20, month: 12, year: 2025 });
  });

  it('moves day 30 to day 29 in a 29-day month', () => {
    const d = nextLunarAnniversary(30, 12, { day: 1, month: 1, year: 2024 });
    const lunar = solarToLunar(d.day, d.month, d.year);
    expect(lunar.month).toBe(12);
    expect(lunar.day).toBe(lunarMonthLength(12, lunar.year));
  });

  it('is always within about one lunar year', () => {
    const from = { day: 4, month: 11, year: 2026 };
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 15, 30]) {
        const next = nextLunarAnniversary(d, m, from);
        const gap = daysBetween(from, next);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThan(390);
      }
    }
  });
});
