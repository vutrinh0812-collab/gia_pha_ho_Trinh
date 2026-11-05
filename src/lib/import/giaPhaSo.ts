/**
 * Converts the family-book transcription format (JSON written from a paper
 * "sổ gia phả") into clan data: persons, unions and settings.
 *
 * The book lists, for each household, the head of the family, the spouse and
 * the children with their own spouses and children. It carries no gender, so
 * the caller supplies one (see `inferGender`), and a person whose gender is a
 * guess is flagged in the notes for the family to confirm.
 */
import type { ClanSettings, Gender, PersonFields, UnionFields, WithId } from '../types';

export interface BookPerson {
  ho_ten: string;
  stt?: number;
  ghi_chu?: string;
  can_kiem_tra?: string;
  ten_goi_khac?: string[];
  vo_chong?: { ho_ten: string; ghi_chu?: string; can_kiem_tra?: string } | null;
  con?: BookPerson[];
}

export interface BookFamily {
  id: string;
  trang: number | null;
  ten_gia_dinh: string;
  doi_III: {
    nguoi_ho_trinh: { ho_ten: string; ghi_chu?: string; can_kiem_tra?: string; ten_goi_khac?: string[] };
    vo_chong?: { ho_ten: string; ghi_chu?: string; can_kiem_tra?: string } | null;
  };
  con?: BookPerson[];
}

export interface Book {
  tieu_de: string;
  gia_dinh: BookFamily[];
}

export interface ConvertOptions {
  /** Gender by full name, for names the heuristics cannot decide. */
  genders?: Readonly<Record<string, Gender>>;
  /** Names whose gender is only a guess: they get a "please confirm" note. */
  guessed?: ReadonlySet<string>;
  /** Id prefix for generated documents. Default: none (ids are p001, u001…). */
  settings: Omit<ClanSettings, 'rootPersonId'>;
}

export interface ConvertedClan {
  persons: WithId<PersonFields>[];
  unions: WithId<UnionFields>[];
  settings: ClanSettings;
}

/** "Thị" in the middle of a name means a woman, "Văn" a man (Vietnamese naming convention). */
export function inferGender(fullName: string): Gender | undefined {
  const words = fullName.split(/\s+/);
  if (words.slice(1, -1).includes('Thị') || words[1] === 'Thị') return 'female';
  if (words.slice(1, -1).includes('Văn') || words[1] === 'Văn') return 'male';
  return undefined;
}

const pad = (n: number, w = 3) => String(n).padStart(w, '0');

export function convertBook(book: Book, options: ConvertOptions): ConvertedClan {
  const persons: WithId<PersonFields>[] = [];
  const unions: WithId<UnionFields>[] = [];
  const { genders = {}, guessed = new Set<string>() } = options;

  const genderOf = (name: string): Gender => {
    const g = genders[name] ?? inferGender(name);
    if (!g) throw new Error(`Chưa biết giới tính của "${name}": thêm vào danh sách giới tính.`);
    return g;
  };

  const noteOf = (name: string, extra: Array<string | undefined | null>): string | undefined => {
    const parts = extra.filter((x): x is string => Boolean(x));
    if (guessed.has(name)) parts.push('Cần xác nhận: giới tính suy từ tên.');
    return parts.length ? parts.join(' ') : undefined;
  };

  const addPerson = (
    fullName: string,
    isBloodline: boolean,
    extra: {
      parentUnionId?: string;
      birthOrder?: number;
      aliases?: string[];
      ghiChu?: string;
      canKiemTra?: string;
      page?: number | null;
    },
  ): string => {
    const id = `p${pad(persons.length + 1)}`;
    const notes = noteOf(fullName, [
      extra.ghiChu ? `${extra.ghiChu}.` : undefined,
      extra.canKiemTra ? `Cần xác nhận: ${extra.canKiemTra}.` : undefined,
    ]);
    persons.push({
      id,
      fullName,
      gender: genderOf(fullName),
      isBloodline,
      ...(extra.parentUnionId ? { parentUnionId: extra.parentUnionId } : {}),
      ...(extra.birthOrder ? { birthOrder: extra.birthOrder } : {}),
      ...(extra.aliases?.length ? { otherNames: { thuong: extra.aliases.join(', ') } } : {}),
      ...(notes ? { notes } : {}),
    });
    return id;
  };

  const addUnion = (bloodlinePersonId: string, spousePersonId: string | null): string => {
    const id = `u${pad(unions.length + 1)}`;
    unions.push({ id, bloodlinePersonId, spousePersonId, order: 1, status: 'married' });
    return id;
  };

  /** Adds the spouse and the children of a person, recursively. */
  const addFamily = (personId: string, spouse: BookPerson['vo_chong'], children: BookPerson[] | undefined): void => {
    const spouseId = spouse ? addPerson(spouse.ho_ten, false, { ghiChu: spouse.ghi_chu, canKiemTra: spouse.can_kiem_tra }) : null;
    if (!spouseId && !children?.length) return;
    const unionId = addUnion(personId, spouseId);
    (children ?? []).forEach((child, i) => {
      const childId = addPerson(child.ho_ten, true, {
        parentUnionId: unionId,
        birthOrder: child.stt ?? i + 1,
        aliases: child.ten_goi_khac,
        ghiChu: child.ghi_chu,
        canKiemTra: child.can_kiem_tra,
      });
      addFamily(childId, child.vo_chong, child.con);
    });
  };

  book.gia_dinh.forEach((family, i) => {
    const head = family.doi_III.nguoi_ho_trinh;
    const headId = addPerson(head.ho_ten, true, {
      birthOrder: i + 1,
      aliases: head.ten_goi_khac,
      ghiChu: head.ghi_chu,
      canKiemTra: head.can_kiem_tra,
      page: family.trang,
    });
    addFamily(headId, family.doi_III.vo_chong, family.con);
  });

  const first = persons[0];
  if (!first) throw new Error('Sổ gia phả không có người nào.');
  return { persons, unions, settings: { ...options.settings, rootPersonId: first.id } };
}

/**
 * The private data file kept outside Git (private-data/ho-trinh.json):
 * the book plus the gender table the book lacks and the clan settings.
 */
export interface PrivateClanFile {
  sach: Book;
  /** Gender by full name: "nam" | "nu". Names with "Thị" / "Văn" need no entry. */
  gioi_tinh?: Record<string, 'nam' | 'nu'>;
  /** Names whose gender is only a guess; they get a "please confirm" note. */
  suy_doan?: string[];
  cai_dat: Omit<ClanSettings, 'rootPersonId'>;
}

export function convertPrivateFile(file: PrivateClanFile): ConvertedClan {
  const genders: Record<string, Gender> = {};
  for (const [name, g] of Object.entries(file.gioi_tinh ?? {})) genders[name] = g === 'nam' ? 'male' : 'female';
  return convertBook(file.sach, { genders, guessed: new Set(file.suy_doan ?? []), settings: file.cai_dat });
}
