import { rowStretch, stretchPath } from '@/features/print/PosterSvg';

const rows = [
  { top: 0, height: 40 },
  { top: 100, height: 60 },
  { top: 200, height: 40 },
];

describe('poster row stretch', () => {
  it('moves each row down by extra × index and keeps order', () => {
    const f = rowStretch(rows, 50);
    expect(f(0)).toBe(0);
    expect(f(120)).toBe(170);
    expect(f(210)).toBe(310);
    const ys = [0, 30, 40, 70, 100, 160, 180, 200, 240];
    const mapped = ys.map(f);
    for (let i = 1; i < mapped.length; i++) expect(mapped[i]!).toBeGreaterThanOrEqual(mapped[i - 1]!);
  });

  it('interpolates inside the gaps', () => {
    const f = rowStretch(rows, 50);
    expect(f(70)).toBe(70 + 25); // halfway between rows 0 and 1
  });

  it('rewrites the y-values of connector paths only', () => {
    const f = rowStretch(rows, 50);
    expect(stretchPath('M10,40V70M5,70H20M5,70V100', f)).toBe('M10,40V95M5,95H20M5,95V150');
  });

  it('is the identity without extra space', () => {
    expect(rowStretch(rows, 0)(123)).toBe(123);
  });
});
