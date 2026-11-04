import { buildSearchIndex, normalizeVi, search } from '@/lib/search';

describe('normalizeVi', () => {
  it('strips Vietnamese diacritics including đ', () => {
    expect(normalizeVi('Vũ Đăng Tấn')).toBe('vu dang tan');
    expect(normalizeVi('  Nguyễn   Thị  Ngọc ')).toBe('nguyen thi ngoc');
    expect(normalizeVi('ĐỖ ĐỨC ĐẠT')).toBe('do duc dat');
  });
});

describe('search', () => {
  const index = buildSearchIndex([
    { id: '1', name: 'Vũ Đăng Tấn' },
    { id: '2', name: 'Vũ Đăng Tuyển' },
    { id: '3', name: 'Nguyễn Thị Ngọc' },
    { id: '4', name: 'Trịnh Văn An' },
    { id: '5', name: 'Trịnh Văn An Khang' },
    { id: '6', name: 'Trịnh Văn Ân' },
    { id: '7', name: 'Lê Thị Hoa', aliases: ['Cả Hoa'] },
  ]);
  const ids = (q: string) => search(index, q).map((h) => h.id);

  it('matches without diacritics', () => {
    expect(ids('vu dang tan')[0]).toBe('1');
    expect(ids('nguyen thi ngoc')).toEqual(['3']);
  });

  it('matches word prefixes in order', () => {
    expect(ids('vu tuy')).toEqual(['2']);
    expect(ids('v d t')).toEqual(['1', '2']);
  });

  it('matches the given name alone', () => {
    expect(ids('ngoc')).toEqual(['3']);
  });

  it('prefers names typed with the right diacritics', () => {
    expect(ids('Trịnh Văn Ân')[0]).toBe('6');
    expect(ids('trinh van an').slice(0, 2).sort()).toEqual(['4', '6']);
  });

  it('ranks exact and shorter names first', () => {
    expect(ids('trinh van an')).toContain('5');
    expect(ids('trinh van an').indexOf('4')).toBeLessThan(ids('trinh van an').indexOf('5'));
  });

  it('matches other names (húy, tự…)', () => {
    expect(ids('ca hoa')).toEqual(['7']);
  });

  it('returns nothing for blank queries', () => {
    expect(search(index, '   ')).toEqual([]);
  });
});
