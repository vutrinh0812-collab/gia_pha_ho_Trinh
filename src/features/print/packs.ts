/**
 * Print frame packages ("gói giao diện khung tranh", DECISIONS D62): a background
 * picture of the whole A1 sheet (a painted frame, a scroll…) plus a JSON preset
 * that says where the tree goes inside it and which colours and fonts to use.
 * Anything the preset leaves out comes from a built-in print theme (`nen`).
 * Packages are kept on this device (IndexedDB), not shared through the database.
 */
import { PRINT_THEMES, getTheme } from '@/themes/registry';
import type { FontSpec, Theme } from '@/themes/types';

export const PACK_PREFIX = 'goi-';

/** What the JSON file may contain (Vietnamese keys, as people edit it by hand). */
export interface PackJson {
  phienBan?: number;
  ten: string;
  moTa?: string;
  /** Built-in theme to start from: truyen-thong-do, son-mai-vang, men-lam, giay-do. */
  nen?: string;
  hinhNen: {
    /** File name of the picture chosen together with the JSON, or a data:image/… URL. */
    tep: string;
    /** cover: fill and crop; stretch: fill exactly; contain: whole picture, may leave margins. */
    cachPhu?: 'cover' | 'stretch' | 'contain';
  };
  /** Paper direction the picture was drawn for. */
  huongGiay?: 'ngang' | 'doc';
  /** Margins (mm on the A1 sheet) of the area inside the frame where title and tree go. */
  vungNoiDungMm?: { tren: number; phai: number; duoi: number; trai: number };
  mau?: Partial<Theme['colors']>;
  chu?: Partial<Record<keyof Theme['typography'], Partial<FontSpec>>>;
  /** Google Fonts stylesheet for the fonts named in `chu`. */
  fontsCss?: string;
  oNguoi?: Partial<Theme['node']>;
  duongNoi?: Partial<Theme['connector']>;
  hienCauDoi?: boolean;
  /** Colour of the seal beside the title; null hides it. */
  mauConTrien?: string | null;
}

export interface StoredPack {
  id: string;
  json: PackJson;
  /** The background picture as a data URL. */
  image: string;
  addedAt: number;
}

export const SAMPLE_PACK: PackJson & { _huongDan: string[] } = {
  _huongDan: [
    'Gói giao diện khung tranh cho bản in A1. Sửa file này rồi bấm "Nhập gói giao diện" và chọn CÙNG LÚC file .json này và file ảnh khung.',
    'hinhNen.tep: tên file ảnh khung (PNG/JPG/WebP), nên vẽ đúng tỉ lệ A1: 841 × 594 mm (ngang) hoặc 594 × 841 mm (dọc), tối thiểu 3000 px chiều dài.',
    'hinhNen.cachPhu: "cover" (phủ kín, cắt bớt mép), "stretch" (kéo giãn vừa khít), "contain" (giữ nguyên ảnh).',
    'vungNoiDungMm: khoảng cách (mm) từ mép giấy vào vùng trống bên trong khung, nơi đặt tiêu đề và cây gia phả.',
    'nen: giao diện có sẵn để lấy màu và chữ mặc định: truyen-thong-do, son-mai-vang, men-lam, giay-do.',
    'mau, chu, oNguoi, duongNoi: chỉ ghi những gì muốn đổi; bỏ trống thì dùng của giao diện nền. Màu viết dạng #rrggbb.',
    'Các trường bắt đầu bằng _ (như _huongDan) được bỏ qua.',
  ],
  phienBan: 1,
  ten: 'Khung tranh của tôi',
  moTa: 'Ảnh khung tự thiết kế, chữ và màu theo Truyền thống đỏ.',
  nen: 'truyen-thong-do',
  hinhNen: { tep: 'khung-a1.png', cachPhu: 'cover' },
  huongGiay: 'ngang',
  vungNoiDungMm: { tren: 70, phai: 70, duoi: 60, trai: 70 },
  mau: {
    textPrimary: '#3a2216',
    textSecondary: '#6b4e3a',
    line: '#7a5638',
    accent: '#b3261e',
  },
  chu: {
    title: { family: 'Noto Serif Display', weight: 800, sizePt: 72 },
    name: { family: 'Noto Serif', weight: 700, sizePt: 11 },
  },
  oNguoi: { fill: '#fffaf0', radius: 2 },
  duongNoi: { color: '#7a5638', width: 0.6 },
  hienCauDoi: true,
  mauConTrien: '#b3261e',
};

export function samplePackFile(): Blob {
  return new Blob([JSON.stringify(SAMPLE_PACK, null, 2)], { type: 'application/json' });
}

const isColor = (v: unknown) => typeof v === 'string' && v.length <= 64 && /^(#[0-9a-f]{3,8}|rgba?\(.+\)|transparent)$/i.test(v.trim());
const isNum = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Checks a preset; throws an Error with a Vietnamese message that says what to fix. */
export function validatePack(raw: unknown): PackJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('File JSON không đúng dạng gói giao diện.');
  const p = raw as Record<string, unknown>;
  if (typeof p.ten !== 'string' || !p.ten.trim() || p.ten.length > 80) throw new Error('Thiếu "ten" (tên giao diện, tối đa 80 ký tự).');
  const bg = p.hinhNen as Record<string, unknown> | undefined;
  if (!bg || typeof bg.tep !== 'string' || !bg.tep.trim()) throw new Error('Thiếu "hinhNen.tep": tên file ảnh khung.');
  if (bg.cachPhu !== undefined && !['cover', 'stretch', 'contain'].includes(bg.cachPhu as string))
    throw new Error('"hinhNen.cachPhu" chỉ nhận "cover", "stretch" hoặc "contain".');
  if (p.nen !== undefined && !PRINT_THEMES.some((t) => t.id === p.nen))
    throw new Error(`"nen" phải là một trong: ${PRINT_THEMES.map((t) => t.id).join(', ')}.`);
  if (p.huongGiay !== undefined && p.huongGiay !== 'ngang' && p.huongGiay !== 'doc') throw new Error('"huongGiay" chỉ nhận "ngang" hoặc "doc".');
  const v = p.vungNoiDungMm as Record<string, unknown> | undefined;
  if (v !== undefined) {
    for (const k of ['tren', 'phai', 'duoi', 'trai'])
      if (!isNum(v[k], 0, 300)) throw new Error(`"vungNoiDungMm.${k}" phải là số mm từ 0 đến 300.`);
  }
  const mau = p.mau as Record<string, unknown> | undefined;
  if (mau !== undefined) {
    for (const [k, c] of Object.entries(mau)) if (!isColor(c)) throw new Error(`Màu "mau.${k}" không hợp lệ (dùng dạng #rrggbb).`);
  }
  if (p.mauConTrien !== undefined && p.mauConTrien !== null && !isColor(p.mauConTrien)) throw new Error('"mauConTrien" không phải màu hợp lệ.');
  if (p.fontsCss !== undefined && (typeof p.fontsCss !== 'string' || !p.fontsCss.startsWith('https://fonts.googleapis.com/')))
    throw new Error('"fontsCss" phải là link https://fonts.googleapis.com/…');
  return p as unknown as PackJson;
}

/** Builds the print theme of a package on top of its base theme. */
export function packTheme(pack: StoredPack): Theme {
  const j = pack.json;
  const base = getTheme(j.nen) ?? PRINT_THEMES.find((t) => t.id === 'truyen-thong-do') ?? PRINT_THEMES[0]!;
  const typo = { ...base.typography };
  for (const [k, f] of Object.entries(j.chu ?? {}) as Array<[keyof Theme['typography'], Partial<FontSpec>]>) typo[k] = { ...typo[k], ...f };
  const inset = j.vungNoiDungMm;
  return {
    ...base,
    id: pack.id,
    name: j.ten.trim(),
    description: j.moTa?.trim() || 'Gói giao diện đã nhập trên máy này.',
    usage: ['print'],
    fontsCss: j.fontsCss ?? base.fontsCss,
    colors: { ...base.colors, ...j.mau },
    typography: typo,
    node: { ...base.node, ...j.oNguoi },
    connector: { ...base.connector, ...j.duongNoi },
    // The picture is the frame: no drawn frame, texture or background ornaments.
    frame: { ...base.frame, enabled: false, borderSvg: undefined, cornerSvg: undefined },
    backgroundTexture: undefined,
    ornaments: {
      ...base.ornaments,
      titleBanner: undefined,
      decorations: undefined,
      showCouplets: j.hienCauDoi ?? base.ornaments.showCouplets,
      seal: j.mauConTrien === null ? undefined : { color: j.mauConTrien ?? base.ornaments.seal?.color ?? base.colors.accent },
    },
    backgroundImage: { href: pack.image, fit: j.hinhNen.cachPhu ?? 'cover' },
    contentInsetMm: inset ? { top: inset.tren, right: inset.phai, bottom: inset.duoi, left: inset.trai } : undefined,
    preferredOrientation: j.huongGiay === 'doc' ? 'portrait' : j.huongGiay === 'ngang' ? 'landscape' : undefined,
  };
}

function readAs(file: Blob, as: 'text' | 'dataUrl'): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được file.'));
    if (as === 'text') r.readAsText(file);
    else r.readAsDataURL(file);
  });
}

const MAX_IMAGE = 25 * 1024 * 1024;

/** Reads the chosen files (one .json and the picture it names) into a package. */
export async function packFromFiles(files: File[]): Promise<StoredPack> {
  const jsonFile = files.find((f) => f.name.toLowerCase().endsWith('.json') || f.type === 'application/json');
  if (!jsonFile) throw new Error('Hãy chọn file .json của gói (có thể chọn cùng lúc với ảnh khung).');
  let raw: unknown;
  try {
    raw = JSON.parse(await readAs(jsonFile, 'text'));
  } catch {
    throw new Error('File JSON bị lỗi cú pháp. Hãy kiểm tra dấu phẩy, ngoặc kép.');
  }
  const json = validatePack(raw);
  let image: string;
  if (json.hinhNen.tep.startsWith('data:image/')) {
    image = json.hinhNen.tep;
    json.hinhNen = { ...json.hinhNen, tep: 'anh-trong-json' };
  } else {
    const want = json.hinhNen.tep.trim().toLowerCase();
    const pictures = files.filter((f) => f.type.startsWith('image/'));
    const pic = pictures.find((f) => f.name.toLowerCase() === want) ?? (pictures.length === 1 ? pictures[0] : undefined);
    if (!pic) throw new Error(`Chưa chọn ảnh khung "${json.hinhNen.tep}". Hãy chọn cùng lúc file .json và file ảnh.`);
    if (pic.size > MAX_IMAGE) throw new Error('Ảnh khung quá lớn (tối đa 25 MB).');
    image = await readAs(pic, 'dataUrl');
  }
  const slug = json.ten
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return { id: `${PACK_PREFIX}${slug || 'khung'}`, json, image, addedAt: Date.now() };
}

// ---------- Storage on this device (IndexedDB) ----------

const DB = 'giapha-print';
const STORE = 'packs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Trình duyệt này không lưu được gói giao diện.'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Không mở được bộ nhớ của trình duyệt.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Không lưu được gói giao diện trên máy này.'));
  });
}

export async function listPacks(): Promise<StoredPack[]> {
  try {
    const all = await run<StoredPack[]>('readonly', (s) => s.getAll() as IDBRequest<StoredPack[]>);
    return all.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export const savePack = (pack: StoredPack) => run('readwrite', (s) => s.put(pack));
export const deletePack = (id: string) => run('readwrite', (s) => s.delete(id));
