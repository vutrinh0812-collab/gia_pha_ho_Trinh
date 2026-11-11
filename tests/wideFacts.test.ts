import { wideFacts } from '@/features/person/Profile';

describe('wideFacts (D71, D86)', () => {
  it('keeps two short facts side by side', () => {
    expect(wideFacts(['1950', 'Thầy lang'])).toEqual([false, false]);
  });
  it('gives a long fact the whole row', () => {
    expect(wideFacts(['khoảng năm 1843'])).toEqual([true]);
    expect(wideFacts(['Trịnh Công Nguyên (thứ I)', '1950', 'Thầy lang'])).toEqual([true, false, false]);
  });
  it('widens a short fact left alone next to a long one or at the end', () => {
    expect(wideFacts(['1950', 'thôn Bến Đình, xã An Hòa', 'Thầy lang'])).toEqual([true, true, true]);
    expect(wideFacts(['1950', 'Thầy lang', '1990'])).toEqual([false, false, true]);
  });
});
