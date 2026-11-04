import { buildFamilyIndex, computeGenerations } from '@/lib/generation';
import { generateSampleData } from '@/lib/sampleData';
import { validatePersonFields, validateSettings, validateUnionFields } from '@/lib/validators';

describe('generateSampleData', () => {
  const data = generateSampleData();
  const index = buildFamilyIndex(data.persons, data.unions);
  const gens = computeGenerations(index, data.settings.rootPersonId);

  it('is deterministic', () => {
    expect(generateSampleData()).toEqual(data);
  });

  it('has about 300 persons over 7 generations, all connected', () => {
    expect(data.persons.length).toBeGreaterThanOrEqual(270);
    expect(data.persons.length).toBeLessThanOrEqual(330);
    expect(gens.maxGeneration).toBe(7);
    expect(gens.unreachable).toEqual([]);
    expect(gens.conflicts).toEqual([]);
  });

  it('has two major branches under the root', () => {
    const rootSons = index
      .unionsOf(data.settings.rootPersonId)
      .flatMap((u) => index.childrenOf(u.id))
      .filter((p) => p.gender === 'male');
    expect(rootSons).toHaveLength(2);
    const labels = new Set(data.persons.map((p) => p.branchLabel).filter(Boolean));
    expect([...labels].sort()).toEqual(['Chi Giáp', 'Chi Ất']);
  });

  it('covers the required special cases', () => {
    expect(data.unions.some((u) => u.order === 2)).toBe(true); // a man with two wives
    expect(data.persons.some((p) => !p.isBloodline && p.gender === 'female')).toBe(true); // dâu
    expect(data.persons.some((p) => !p.isBloodline && p.gender === 'male')).toBe(true); // rể
    expect(data.persons.some((p) => p.isBloodline && !p.birth)).toBe(true); // unknown birth
    expect(gens.maternal.size).toBeGreaterThan(0); // daughters' children
  });

  it('produces documents that pass validation', () => {
    for (const { id: _id, ...p } of data.persons) expect(validatePersonFields(p)).toEqual([]);
    for (const { id: _id, ...u } of data.unions) expect(validateUnionFields(u)).toEqual([]);
    expect(validateSettings(data.settings)).toEqual([]);
  });

  it('keeps names mostly unique (a few namesakes are realistic)', () => {
    const names = data.persons.map((p) => p.fullName);
    expect(new Set(names).size).toBeGreaterThan(names.length * 0.95);
  });
});

describe('validators', () => {
  it('rejects bad persons', () => {
    expect(validatePersonFields({ fullName: '', gender: 'male', isBloodline: true })).not.toEqual([]);
    expect(validatePersonFields({ fullName: 'x'.repeat(101), gender: 'male', isBloodline: true })).not.toEqual([]);
    expect(
      validatePersonFields({ fullName: 'A', gender: 'other' as 'male', isBloodline: true }),
    ).not.toEqual([]);
    expect(
      validatePersonFields({ fullName: 'A', gender: 'male', isBloodline: true, birth: { solar: '2023-02-30' } }),
    ).not.toEqual([]);
    expect(
      validatePersonFields({ fullName: 'A', gender: 'male', isBloodline: true, hacker: 1 } as never),
    ).not.toEqual([]);
  });

  it('accepts partial dates', () => {
    for (const solar of ['1890', '1890-05', '1890-05-31']) {
      expect(validatePersonFields({ fullName: 'Nguyễn Thị Ngọc', gender: 'female', isBloodline: false, birth: { solar } })).toEqual([]);
    }
  });

  it('rejects self-marriage', () => {
    expect(validateUnionFields({ bloodlinePersonId: 'a', spousePersonId: 'a', order: 1 })).not.toEqual([]);
  });
});
