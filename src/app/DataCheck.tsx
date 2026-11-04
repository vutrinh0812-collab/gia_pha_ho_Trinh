import { useEffect, useMemo, useState } from 'react';
import { loadClanSnapshot, type ClanSnapshot } from '@/lib/data';
import { buildFamilyIndex, computeGenerations, lineageOf } from '@/lib/generation';
import {
  canChiOfYear,
  daysBetween,
  lunarToSolar,
  nextLunarAnniversary,
  solarToLunar,
  type SolarDate,
} from '@/lib/lunar';
import styles from './Page.module.css';

/**
 * Temporary verification screen for phases 1–2 (replaced by the real
 * mobile views in phase 3): data summary, generations, death anniversaries
 * and a lunar calendar converter.
 */

type Load = { kind: 'loading' } | { kind: 'ok'; snap: ClanSnapshot } | { kind: 'error'; message: string };

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function todaySolar(): SolarDate {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function formatSolar(d: SolarDate, withWeekday = false): string {
  const text = `${d.day}/${d.month}/${d.year}`;
  if (!withWeekday) return text;
  const weekday = WEEKDAYS[new Date(d.year, d.month - 1, d.day).getDay()];
  return `${weekday}, ${text}`;
}

export function DataCheck() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadClanSnapshot().then(
      (snap) => !cancelled && setLoad({ kind: 'ok', snap }),
      (e: unknown) => !cancelled && setLoad({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.kind === 'loading') {
    return (
      <section className={styles.card} aria-live="polite">
        <p>Đang tải dữ liệu…</p>
      </section>
    );
  }
  if (load.kind === 'error') {
    return (
      <section className={styles.card} aria-live="polite">
        <h2>Dữ liệu</h2>
        <p className={styles.err}>✗ Không tải được dữ liệu.</p>
        <p>
          <code>{load.message}</code>
        </p>
        <p className={styles.muted}>Kiểm tra lại cấu hình Firebase, hoặc emulator đã chạy chưa.</p>
      </section>
    );
  }
  return (
    <>
      <ClanSummary snap={load.snap} />
      <LunarConverter />
    </>
  );
}

function ClanSummary({ snap }: { snap: ClanSnapshot }) {
  const analysis = useMemo(() => {
    if (!snap.settings) return null;
    const index = buildFamilyIndex(snap.persons, snap.unions);
    const gens = computeGenerations(index, snap.settings.rootPersonId);

    const rows = Array.from({ length: gens.maxGeneration }, (_, i) => ({ gen: i + 1, blood: 0, spouse: 0, maternal: 0 }));
    for (const p of snap.persons) {
      const g = gens.generation.get(p.id);
      const row = g ? rows[g - 1] : undefined;
      if (!row) continue;
      if (gens.maternal.has(p.id)) row.maternal++;
      else if (p.isBloodline) row.blood++;
      else row.spouse++;
    }

    const branches = new Map<string, number>();
    for (const p of snap.persons) {
      if (p.isBloodline && p.branchLabel) branches.set(p.branchLabel, (branches.get(p.branchLabel) ?? 0) + 1);
    }

    const multiWife = snap.unions
      .filter((u) => u.order >= 2)
      .map((u) => index.persons.get(u.bloodlinePersonId))
      .filter((p) => p !== undefined);

    const today = todaySolar();
    const upcoming = snap.persons
      .filter((p) => p.deathAnniversaryLunar)
      .map((p) => {
        const a = p.deathAnniversaryLunar!;
        const date = nextLunarAnniversary(a.day, a.month, today);
        const deathYear = p.death?.solar ? Number(p.death.solar.slice(0, 4)) : null;
        return { person: p, lunar: a, date, inDays: daysBetween(today, date), deathYear };
      })
      .sort((x, y) => x.inDays - y.inDays)
      .slice(0, 6);

    const rootName = index.persons.get(snap.settings.rootPersonId)?.fullName ?? '—';
    const deepest = [...gens.generation.entries()].find(([, g]) => g === gens.maxGeneration)?.[0];
    const lineage = deepest ? lineageOf(index, deepest).map((id) => index.persons.get(id)?.fullName ?? id) : [];

    return {
      gens,
      rows,
      branches: [...branches.entries()].sort(),
      multiWife,
      upcoming,
      rootName,
      lineage,
      unknownBirth: snap.persons.filter((p) => !p.birth).length,
      deceased: snap.persons.filter((p) => p.death?.isDeceased).length,
    };
  }, [snap]);

  if (!snap.settings || !analysis) {
    return (
      <section className={styles.card}>
        <h2>Dữ liệu</h2>
        <p>
          Chưa có dữ liệu dòng họ. Chạy <code>npm run seed</code> để tạo dữ liệu mẫu.
        </p>
      </section>
    );
  }

  const { gens, rows } = analysis;
  return (
    <>
      <section className={styles.card} aria-labelledby="clan">
        <h2 id="clan">{snap.settings.title}</h2>
        {snap.settings.subtitle && <p className={styles.muted}>{snap.settings.subtitle}</p>}
        <dl className={styles.stats}>
          <div>
            <dt>Số người</dt>
            <dd>{snap.persons.length}</dd>
          </div>
          <div>
            <dt>Số đời</dt>
            <dd>{gens.maxGeneration}</dd>
          </div>
          <div>
            <dt>Hôn nhân</dt>
            <dd>{snap.unions.length}</dd>
          </div>
        </dl>
        <p>
          Thủy tổ: <strong>{analysis.rootName}</strong>
        </p>
        {gens.unreachable.length > 0 ? (
          <p className={styles.warn}>⚠ {gens.unreachable.length} người chưa nối được vào cây.</p>
        ) : (
          <p className={styles.ok}>✓ Mọi người đều nối được về thủy tổ.</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="gens">
        <h2 id="gens">Số người theo đời</h2>
        <p className={styles.muted}>Đời được tính tự động từ thủy tổ. Dâu/rể cùng đời với người phối ngẫu.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Đời</th>
                <th scope="col">Huyết thống</th>
                <th scope="col">Dâu/rể</th>
                <th scope="col">Bên ngoại</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gen}>
                  <th scope="row">Đời {r.gen}</th>
                  <td>{r.blood}</td>
                  <td>{r.spouse}</td>
                  <td>{r.maternal || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="cases">
        <h2 id="cases">Các trường hợp đặc biệt</h2>
        <ul className={styles.list}>
          {analysis.branches.map(([label, n]) => (
            <li key={label}>
              {label}: {n} người huyết thống
            </li>
          ))}
          {analysis.multiWife.map((p) => (
            <li key={p.id}>
              Có nhiều vợ: {p.fullName}
              {p.branchLabel ? ` (${p.branchLabel})` : ''}
            </li>
          ))}
          <li>{gens.maternal.size} người bên ngoại (con cháu của con gái, mặc định ẩn trên cây)</li>
          <li>{analysis.unknownBirth} người chưa rõ năm sinh</li>
          <li>{analysis.deceased} người đã mất</li>
        </ul>
        {analysis.lineage.length > 0 && (
          <>
            <h3>Ví dụ một dòng dõi từ thủy tổ</h3>
            <ol className={styles.lineage}>
              {analysis.lineage.map((name, i) => (
                <li key={i}>
                  <span className={styles.genTag}>Đời {i + 1}</span> {name}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="anniv">
        <h2 id="anniv">Ngày giỗ sắp tới</h2>
        <p className={styles.muted}>Ngày giỗ lưu theo âm lịch, quy đổi ra dương lịch.</p>
        <ul className={styles.rows}>
          {analysis.upcoming.map(({ person, lunar, date, inDays, deathYear }) => (
            <li key={person.id}>
              <div>
                <strong>{person.fullName}</strong>
                <span className={styles.muted}>
                  {' '}
                  · Đời {gens.generation.get(person.id) ?? '?'}
                  {person.branchLabel ? ` · ${person.branchLabel}` : ''}
                  {deathYear ? ` · mất năm ${deathYear}` : ''}
                </span>
              </div>
              <div>
                {formatSolar(date, true)} · {lunar.day}/{lunar.month} âm lịch ·{' '}
                {inDays === 0 ? 'hôm nay' : `còn ${inDays} ngày`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function LunarConverter() {
  const t = todaySolar();
  const [solar, setSolar] = useState(`${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`);
  const [lDay, setLDay] = useState('15');
  const [lMonth, setLMonth] = useState('8');
  const [lYear, setLYear] = useState(String(t.year));
  const [leap, setLeap] = useState(false);

  const lunarResult = useMemo(() => {
    const [y, m, d] = solar.split('-').map(Number);
    if (!y || !m || !d) return null;
    return solarToLunar(d, m, y);
  }, [solar]);

  const solarResult = useMemo(() => {
    const d = Number(lDay);
    const m = Number(lMonth);
    const y = Number(lYear);
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 1000 || y > 2199) return undefined;
    return lunarToSolar(d, m, y, leap);
  }, [lDay, lMonth, lYear, leap]);

  return (
    <section className={styles.card} aria-labelledby="lunar">
      <h2 id="lunar">Đổi ngày âm – dương</h2>

      <div className={styles.field}>
        <label htmlFor="solar-date">Ngày dương lịch</label>
        <input id="solar-date" type="date" value={solar} onChange={(e) => setSolar(e.target.value)} />
      </div>
      <p className={styles.result} aria-live="polite">
        {lunarResult
          ? `Âm lịch: ngày ${lunarResult.day} tháng ${lunarResult.month}${lunarResult.isLeapMonth ? ' (nhuận)' : ''} năm ${canChiOfYear(lunarResult.year)} (${lunarResult.year})`
          : 'Chọn một ngày.'}
      </p>

      <fieldset className={styles.fieldset}>
        <legend>Ngày âm lịch</legend>
        <div className={styles.inline}>
          <div className={styles.field}>
            <label htmlFor="lunar-day">Ngày</label>
            <input id="lunar-day" inputMode="numeric" value={lDay} onChange={(e) => setLDay(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="lunar-month">Tháng</label>
            <input id="lunar-month" inputMode="numeric" value={lMonth} onChange={(e) => setLMonth(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="lunar-year">Năm</label>
            <input id="lunar-year" inputMode="numeric" value={lYear} onChange={(e) => setLYear(e.target.value)} />
          </div>
        </div>
        <label className={styles.check}>
          <input id="lunar-leap" type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} /> Tháng nhuận
        </label>
      </fieldset>
      <p className={styles.result} aria-live="polite">
        {solarResult === undefined
          ? 'Nhập ngày, tháng, năm.'
          : solarResult === null
            ? 'Không có ngày này trong âm lịch (ví dụ: năm đó không có tháng nhuận này, hoặc tháng chỉ có 29 ngày).'
            : `Dương lịch: ${formatSolar(solarResult, true)}`}
      </p>
    </section>
  );
}
