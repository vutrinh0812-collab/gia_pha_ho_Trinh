import { childrenGroupLabel, formatDateInfo, givenName, lifeSpan, spouseRole } from '@/lib/format';

describe('lifeSpan', () => {
  it('formats known, unknown and approximate years', () => {
    expect(lifeSpan({ birth: { solar: '1890-05-01' }, death: { isDeceased: true, solar: '1950' } })).toBe('1890 – 1950');
    expect(lifeSpan({ birth: { solar: '1820', approximate: true }, death: { isDeceased: true } })).toBe('k. 1820 – ?');
    expect(lifeSpan({ birth: { solar: '1990' } })).toBe('1990');
    expect(lifeSpan({})).toBe('');
    expect(lifeSpan({ death: { isDeceased: true, lunar: { day: 1, month: 2, year: 1960 } } })).toBe('? – 1960');
  });
});

describe('formatDateInfo', () => {
  it('formats full, partial and lunar dates', () => {
    expect(formatDateInfo({ solar: '1950-03-12', lunar: { day: 24, month: 1, year: 1950 } })).toBe(
      '12/3/1950 (âm lịch 24/1 năm Canh Dần)',
    );
    expect(formatDateInfo({ solar: '1950-03' })).toBe('tháng 3/1950');
    expect(formatDateInfo({ solar: '1890', approximate: true })).toBe('khoảng năm 1890');
    expect(formatDateInfo({ lunar: { day: 12, month: 3 } })).toBe('12/3 âm lịch');
    expect(formatDateInfo({ lunar: { day: 1, month: 4, isLeapMonth: true, year: 2020 } })).toBe('1/4 nhuận năm Canh Tý âm lịch');
    expect(formatDateInfo(undefined)).toBe('');
  });
});

describe('labels', () => {
  it('names spouses and children groups', () => {
    expect(spouseRole('female', 1, 1)).toBe('Vợ');
    expect(spouseRole('female', 1, 2)).toBe('Vợ cả');
    expect(spouseRole('female', 2, 2)).toBe('Vợ hai');
    expect(spouseRole('male', 1, 1)).toBe('Chồng');
    expect(childrenGroupLabel('female', 2)).toBe('Con bà hai');
    expect(givenName('Trịnh Văn An')).toBe('An');
  });
});
