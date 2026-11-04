/**
 * Deterministic generator of FICTITIOUS genealogy data (SPEC §10).
 * Used by scripts/seed.ts and, later, by the /themes preview and tests.
 * All names, places and dates are invented.
 */
import { lunarToSolar, solarToLunar } from './lunar';
import type { ClanSettings, DateInfo, DeathInfo, Gender, PersonFields, UnionFields, WithId } from './types';

export interface SampleDataOptions {
  /** Clan surname, e.g. "Trịnh". */
  surname?: string;
  /** PRNG seed — same seed, same data. */
  seed?: number;
  /** Approximate total number of persons (bloodline + spouses). */
  targetSize?: number;
  /** Number of generations. */
  generations?: number;
}

export interface SampleData {
  persons: WithId<PersonFields>[];
  unions: WithId<UnionFields>[];
  settings: ClanSettings;
}

/** mulberry32 — tiny deterministic PRNG. */
function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
  };
}

// Generation names ("chữ lót theo đời") — fictitious.
const GENERATION_MIDDLE = ['', 'Đình', 'Công', 'Văn', 'Đức', 'Hữu', 'Quang', 'Minh', 'Gia', 'Bảo'];
const MALE_GIVEN = [
  'An', 'Bách', 'Bình', 'Cảnh', 'Cường', 'Danh', 'Dũng', 'Đạt', 'Định', 'Giang', 'Hải', 'Hào', 'Hiển', 'Hiếu',
  'Hoàng', 'Hùng', 'Huy', 'Khải', 'Khang', 'Khôi', 'Kiên', 'Lâm', 'Lộc', 'Long', 'Luân', 'Mạnh', 'Nam', 'Nghĩa',
  'Nguyên', 'Nhân', 'Phong', 'Phúc', 'Quân', 'Quyết', 'Sơn', 'Tài', 'Tâm', 'Thắng', 'Thành', 'Thiện', 'Thịnh',
  'Thông', 'Tiến', 'Toàn', 'Trí', 'Trung', 'Tuấn', 'Tùng', 'Tường', 'Uy', 'Việt', 'Vinh', 'Vũ', 'Xuân',
];
const FEMALE_GIVEN = [
  'An', 'Bích', 'Chi', 'Diệp', 'Dung', 'Duyên', 'Đào', 'Giang', 'Hà', 'Hạnh', 'Hằng', 'Hiền', 'Hoa', 'Huệ',
  'Hương', 'Lan', 'Liên', 'Linh', 'Loan', 'Lụa', 'Mai', 'Minh', 'My', 'Ngân', 'Ngọc', 'Nhung', 'Oanh', 'Phương',
  'Quế', 'Quyên', 'Sen', 'Tâm', 'Thảo', 'Thơm', 'Thu', 'Thủy', 'Trang', 'Trâm', 'Tuyết', 'Uyên', 'Vân', 'Yến',
];
const OTHER_SURNAMES = ['Nguyễn', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đỗ', 'Bùi', 'Đặng', 'Ngô', 'Dương', 'Lý', 'Phan', 'Đinh', 'Tạ', 'Lương'];
const FEMALE_MIDDLE = ['Thị', 'Thị', 'Thị', 'Thị Ngọc', 'Thị Thu', 'Thị Kim', 'Thị Thanh', 'Thị Minh'];
const SPOUSE_MALE_MIDDLE = ['Văn', 'Đức', 'Hữu', 'Quang', 'Xuân', 'Minh'];
const VILLAGES = ['thôn Đông Lạc', 'thôn Hòa Phú', 'thôn Bến Đình', 'thôn Thượng Hạ', 'thôn An Cư'];
const COMMUNE = 'xã An Hòa (địa danh giả định)';
const OCCUPATIONS = ['Làm ruộng', 'Thầy đồ', 'Thợ mộc', 'Buôn bán', 'Giáo viên', 'Kỹ sư', 'Bác sĩ', 'Bộ đội', 'Công nhân', 'Kế toán'];
const CAN_NAMES = ['Giáp', 'Ất', 'Bính', 'Đinh'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function generateSampleData(options: SampleDataOptions = {}): SampleData {
  const target = options.targetSize ?? 300;
  // Deterministic search for the family size that lands closest to the target.
  let best: SampleData | null = null;
  for (let fertility = 0.8; fertility <= 3.2; fertility += 0.05) {
    const data = buildSample(options, fertility);
    if (!best || Math.abs(data.persons.length - target) < Math.abs(best.persons.length - target)) best = data;
    if (data.persons.length > target * 1.3) break;
  }
  return best!;
}

/** @param fertility mean number of sons per couple (daughters ≈ 0.6×). */
function buildSample(options: SampleDataOptions, fertility: number): SampleData {
  const surname = options.surname ?? 'Trịnh';
  const maxGen = options.generations ?? 7;
  const rng = createRng(options.seed ?? 20261104);

  const persons: WithId<PersonFields>[] = [];
  const unions: WithId<UnionFields>[] = [];
  let personSeq = 0;
  let unionSeq = 0;
  const usedNames = new Set<string>();

  const nextPersonId = () => `p${pad(++personSeq, 4)}`;
  const nextUnionId = () => `u${pad(++unionSeq, 4)}`;

  const uniqueName = (build: () => string): string => {
    for (let i = 0; i < 20; i++) {
      const name = build();
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    return build();
  };

  const place = () => `${rng.pick(VILLAGES)}, ${COMMUNE}`;

  const makeBirth = (year: number, gen: number): DateInfo | undefined => {
    if (gen >= 3 && rng.chance(0.04)) return undefined; // unknown birth
    if (gen <= 2) return { solar: String(year), approximate: true, place: place() };
    if (rng.chance(0.5)) {
      const month = rng.int(1, 12);
      const day = rng.int(1, 28);
      const l = solarToLunar(day, month, year);
      return {
        solar: `${year}-${pad(month)}-${pad(day)}`,
        lunar: { day: l.day, month: l.month, year: l.year, ...(l.isLeapMonth ? { isLeapMonth: true } : {}) },
        place: place(),
      };
    }
    return { solar: String(year) };
  };

  const makeDeath = (born: number, gen: number): { death?: DeathInfo; anniversary?: { day: number; month: number } } => {
    const now = 2026;
    const deceased = born < 1935 || (born < 1960 && rng.chance(0.35)) || (born < 1990 && rng.chance(0.03));
    if (!deceased) return {};
    const lifespan = rng.int(45, 92);
    const year = Math.min(now - 1, born + lifespan);
    if (gen >= 3 && rng.chance(0.05)) return { death: { isDeceased: true } }; // unknown date
    const lunarMonth = rng.int(1, 12);
    const lunarDay = rng.int(1, 29);
    const solar = lunarToSolar(lunarDay, lunarMonth, year);
    const death: DeathInfo = {
      isDeceased: true,
      lunar: { day: lunarDay, month: lunarMonth, year },
      ...(solar ? { solar: `${solar.year}-${pad(solar.month)}-${pad(solar.day)}` } : { solar: String(year) }),
      ...(gen <= 2 ? { approximate: true } : {}),
    };
    return { death, anniversary: { day: lunarDay, month: lunarMonth } };
  };

  const addPerson = (fields: PersonFields): string => {
    const id = nextPersonId();
    persons.push({ id, ...fields });
    return id;
  };

  const addSpouse = (partnerGender: Gender, partnerBorn: number, gen: number, branchLabel?: string): string => {
    const gender: Gender = partnerGender === 'male' ? 'female' : 'male';
    const born = partnerBorn + (gender === 'female' ? rng.int(-1, 5) : rng.int(-6, 0));
    const fullName = uniqueName(() =>
      gender === 'female'
        ? `${rng.pick(OTHER_SURNAMES)} ${rng.pick(FEMALE_MIDDLE)} ${rng.pick(FEMALE_GIVEN)}`
        : `${rng.pick(OTHER_SURNAMES)} ${rng.pick(SPOUSE_MALE_MIDDLE)} ${rng.pick(MALE_GIVEN)}`,
    );
    const birth = makeBirth(born, gen);
    const { death, anniversary } = makeDeath(born, gen);
    return addPerson(
      {
        fullName,
        gender,
        isBloodline: false,
        parentUnionId: null,
        ...(birth ? { birth } : {}),
        ...(death ? { death } : {}),
        ...(anniversary ? { deathAnniversaryLunar: anniversary } : {}),
        ...(branchLabel ? { branchLabel } : {}),
      },
    );
  };

  const addUnion = (bloodlinePersonId: string, spousePersonId: string | null, order: number): string => {
    const id = nextUnionId();
    unions.push({ id, bloodlinePersonId, spousePersonId, order, status: 'married' });
    return id;
  };

  interface Pending {
    id: string;
    gen: number;
    gender: Gender;
    born: number;
    branchLabel?: string;
    maternal: boolean;
  }

  const addChild = (
    parentUnionId: string,
    order: number,
    gender: Gender,
    gen: number,
    born: number,
    branchLabel: string | undefined,
    childSurname: string,
  ): string => {
    const middle = GENERATION_MIDDLE[gen % GENERATION_MIDDLE.length] ?? 'Văn';
    const fullName = uniqueName(() =>
      gender === 'male'
        ? `${childSurname} ${middle} ${rng.pick(MALE_GIVEN)}`
        : `${childSurname} ${rng.pick(FEMALE_MIDDLE)} ${rng.pick(FEMALE_GIVEN)}`,
    );
    const birth = makeBirth(born, gen);
    const { death, anniversary } = makeDeath(born, gen);
    const isAdult = 2026 - born >= 20;
    return addPerson(
      {
        fullName,
        gender,
        isBloodline: true,
        parentUnionId,
        birthOrder: order,
        ...(birth ? { birth } : {}),
        ...(death ? { death } : {}),
        ...(anniversary ? { deathAnniversaryLunar: anniversary } : {}),
        ...(isAdult && gender === 'male' && rng.chance(0.4) ? { occupation: rng.pick(OCCUPATIONS) } : {}),
        ...(branchLabel ? { branchLabel } : {}),
      },
    );
  };

  // --- Generation 1: the root ancestor (thủy tổ) ---
  const rootBorn = 2026 - (maxGen - 1) * 28 - 40;
  const rootId = addPerson(
    {
      fullName: `${surname} Công Nguyên`,
      otherNames: { huy: 'Phúc Thiện', hieu: 'Nhân Hậu' },
      gender: 'male',
      isBloodline: true,
      parentUnionId: null,
      birth: { solar: String(rootBorn), approximate: true, place: place() },
      death: { isDeceased: true, lunar: { day: 12, month: 3 }, approximate: true },
      deathAnniversaryLunar: { day: 12, month: 3 },
      burialPlace: `Gò Đống Cao, ${COMMUNE}`,
      notes: 'Thủy tổ (nhân vật hư cấu, dùng cho dữ liệu mẫu).',
    },
    );
  usedNames.add(`${surname} Công Nguyên`);

  let frontier: Pending[] = [{ id: rootId, gen: 1, gender: 'male', born: rootBorn, maternal: false }];
  let twoWivesDone = false;
  let maternalFamilies = 0;

  for (let gen = 1; gen < maxGen && frontier.length > 0; gen++) {
    const nextFrontier: Pending[] = [];
    const gensLeft = maxGen - gen;
    for (const parent of frontier) {
      const isRoot = parent.id === rootId;
      const isMaleLine = parent.gender === 'male' && !parent.maternal;
      const adult = 2026 - parent.born >= 22;
      if (!adult) continue;

      // Daughters: some get a recorded husband; a few also get recorded children (bên ngoại).
      if (!isMaleLine) {
        if (parent.maternal || !rng.chance(gen <= 5 ? 0.45 : 0.2)) continue;
        const husbandId = addSpouse('female', parent.born, gen);
        const unionId = addUnion(parent.id, husbandId, 1);
        if (maternalFamilies < 4 && gen <= 5) {
          maternalFamilies++;
          const husband = persons.find((p) => p.id === husbandId)!;
          const childSurname = husband.fullName.split(' ')[0] ?? 'Nguyễn';
          const kids = rng.int(1, 2);
          for (let i = 1; i <= kids; i++) {
            const g: Gender = rng.chance(0.5) ? 'male' : 'female';
            const born = parent.born + 22 + i * 3;
            const childId = addChild(unionId, i, g, gen + 1, born, undefined, childSurname);
            nextFrontier.push({ id: childId, gen: gen + 1, gender: g, born, maternal: true });
          }
        }
        continue;
      }

      // Sons: married, with children.
      const wifeCount = !twoWivesDone && gen === 3 ? 2 : 1;
      if (wifeCount === 2) twoWivesDone = true;
      for (let w = 1; w <= wifeCount; w++) {
        const wifeId = gen >= 3 && rng.chance(0.03) ? null : addSpouse('male', parent.born, gen, parent.branchLabel);
        const unionId = addUnion(parent.id, wifeId, w);
        let sons: number;
        let daughters: number;
        if (isRoot) {
          sons = 2;
          daughters = 1;
        } else if (wifeCount === 2) {
          sons = w === 1 ? 2 : 1;
          daughters = 1;
        } else {
          sons = Math.floor(fertility + rng.next());
          daughters = Math.floor(fertility * 0.6 + rng.next());
          if (sons === 0 && gensLeft > 1) sons = 1;
        }
        const total = sons + daughters;
        const genders: Gender[] = [...Array<Gender>(sons).fill('male'), ...Array<Gender>(daughters).fill('female')];
        // Shuffle birth order.
        for (let i = genders.length - 1; i > 0; i--) {
          const j = rng.int(0, i);
          [genders[i], genders[j]] = [genders[j]!, genders[i]!];
        }
        let sonIndex = 0;
        for (let i = 0; i < total; i++) {
          const g = genders[i]!;
          const born = parent.born + rng.int(20, 26) + i * 2 + (w - 1) * 8;
          let branchLabel = parent.branchLabel;
          if (isRoot && g === 'male') branchLabel = `Chi ${CAN_NAMES[sonIndex++] ?? 'Phụ'}`;
          const childId = addChild(unionId, i + 1, g, gen + 1, born, branchLabel, surname);
          nextFrontier.push({
            id: childId,
            gen: gen + 1,
            gender: g,
            born,
            maternal: false,
            ...(branchLabel ? { branchLabel } : {}),
          });
        }
      }
    }
    frontier = nextFrontier;
  }

  const settings: ClanSettings = {
    clanName: surname,
    title: `Hệ Phả Họ ${surname}`,
    subtitle: `Dữ liệu mẫu hư cấu — Từ đời 1 đến đời ${maxGen}`,
    rootPersonId: rootId,
    coupletLeft: 'Tổ đức muôn đời soi lối cháu',
    coupletRight: 'Gia phong một nếp giữ tình con',
    colophon: 'Lập phả năm Bính Ngọ (2026) — bản mẫu',
    defaultThemeId: 'minimal',
    showMaternalDescendants: false,
  };

  return { persons, unions, settings };
}
