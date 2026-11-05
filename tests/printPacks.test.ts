import { packFromFiles, packTheme, SAMPLE_PACK, validatePack, type StoredPack } from '@/features/print/packs';

const json = (o: unknown) => new File([JSON.stringify(o)], 'goi.json', { type: 'application/json' });
const png = (name = 'khung-a1.png') => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: 'image/png' });

describe('print frame packages (D62)', () => {
  it('accepts the sample preset as is', () => {
    expect(() => validatePack(SAMPLE_PACK)).not.toThrow();
  });

  it('explains what is wrong in Vietnamese', () => {
    expect(() => validatePack({})).toThrow(/ten/);
    expect(() => validatePack({ ten: 'A' })).toThrow(/hinhNen\.tep/);
    expect(() => validatePack({ ten: 'A', hinhNen: { tep: 'a.png' }, nen: 'khong-co' })).toThrow(/nen/);
    expect(() => validatePack({ ten: 'A', hinhNen: { tep: 'a.png' }, mau: { accent: 'đỏ' } })).toThrow(/mau\.accent/);
    expect(() => validatePack({ ten: 'A', hinhNen: { tep: 'a.png' }, vungNoiDungMm: { tren: 10, phai: 10, duoi: 10 } })).toThrow(/trai/);
  });

  it('reads the JSON and the picture it names, chosen together', async () => {
    const pack = await packFromFiles([json(SAMPLE_PACK), png()]);
    expect(pack.id).toBe('goi-khung-tranh-cua-toi');
    expect(pack.image.startsWith('data:image/png')).toBe(true);
    await expect(packFromFiles([json(SAMPLE_PACK)])).rejects.toThrow(/khung-a1\.png/);
    await expect(packFromFiles([new File(['{oops'], 'x.json', { type: 'application/json' })])).rejects.toThrow(/cú pháp/);
  });

  it('builds a print theme on its base: the picture is the frame, the preset sets the content area and colours', () => {
    const stored: StoredPack = { id: 'goi-thu', json: SAMPLE_PACK, image: 'data:image/png;base64,AAAA', addedAt: 1 };
    const t = packTheme(stored);
    expect(t.id).toBe('goi-thu');
    expect(t.name).toBe('Khung tranh của tôi');
    expect(t.frame.enabled).toBe(false);
    expect(t.backgroundImage).toEqual({ href: 'data:image/png;base64,AAAA', fit: 'cover' });
    expect(t.contentInsetMm).toEqual({ top: 70, right: 70, bottom: 60, left: 70 });
    expect(t.colors.accent).toBe('#b3261e');
    expect(t.typography.title.sizePt).toBe(72);
    expect(t.typography.body.family).toBeTruthy(); // from the base theme
    expect(t.preferredOrientation).toBe('landscape');
  });
});
