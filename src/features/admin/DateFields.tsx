import { canChiOfYear, lunarToSolar, solarToLunar } from '@/lib/lunar';
import type { DateInfo } from '@/lib/types';
import styles from './AdminForms.module.css';

interface Props {
  idPrefix: string;
  legend: string;
  value: DateInfo | undefined;
  onChange(next: DateInfo | undefined): void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const LUNAR_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

function parseSolar(s: string | undefined) {
  const [y = '', m = '', d = ''] = (s ?? '').split('-');
  return { y, m: m ? String(Number(m)) : '', d: d ? String(Number(d)) : '' };
}
const pad = (n: string) => n.padStart(2, '0');

/**
 * A date that may be partial (SPEC §6): year only, year + month, or a full date,
 * with "khoảng" for uncertain dates, the lunar date and the place. Entering one
 * calendar suggests the other.
 */
export function DateFields({ idPrefix, legend, value, onChange }: Props) {
  const v = value ?? {};
  const { y, m, d } = parseSolar(v.solar);
  const l = v.lunar ?? {};

  const update = (patch: Partial<DateInfo>) => {
    const next: DateInfo = { ...v, ...patch };
    const empty = !next.solar && !next.lunar && !next.place && !next.approximate;
    onChange(empty ? undefined : next);
  };
  const setSolar = (ny: string, nm: string, nd: string) => {
    const year = ny.replace(/\D/g, '').slice(0, 4);
    const solar = year.length === 4 ? [year, nm && pad(nm), nm && nd && pad(nd)].filter(Boolean).join('-') : year ? year : '';
    update({ solar: solar || undefined });
  };
  const setLunar = (patch: Partial<NonNullable<DateInfo['lunar']>>) => {
    const next = { ...l, ...patch };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, x]) => x !== undefined && x !== false));
    update({ lunar: Object.keys(cleaned).length ? (cleaned as DateInfo['lunar']) : undefined });
  };

  // Suggestions between the two calendars.
  let suggestion: { text: string; apply(): void } | null = null;
  if (y.length === 4 && m && d) {
    const lunar = solarToLunar(Number(d), Number(m), Number(y));
    if (lunar.day !== l.day || lunar.month !== l.month || lunar.year !== l.year) {
      suggestion = {
        text: `Âm lịch tương ứng: ngày ${lunar.day} tháng ${lunar.month}${lunar.isLeapMonth ? ' (nhuận)' : ''} năm ${canChiOfYear(lunar.year)} (${lunar.year})`,
        apply: () => setLunar({ day: lunar.day, month: lunar.month, year: lunar.year, isLeapMonth: lunar.isLeapMonth || undefined }),
      };
    }
  } else if (!v.solar && l.day && l.month && l.year) {
    const solar = lunarToSolar(l.day, l.month, l.year, l.isLeapMonth ?? false);
    if (solar) {
      suggestion = {
        text: `Dương lịch tương ứng: ${solar.day}/${solar.month}/${solar.year}`,
        apply: () => update({ solar: `${solar.year}-${pad(String(solar.month))}-${pad(String(solar.day))}` }),
      };
    }
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.row3}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-y`}>Năm</label>
          <input
            id={`${idPrefix}-y`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="vd. 1890"
            value={y}
            onChange={(e) => setSolar(e.target.value, m, d)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-m`}>Tháng</label>
          <select id={`${idPrefix}-m`} value={m} disabled={y.length !== 4} onChange={(e) => setSolar(y, e.target.value, e.target.value ? d : '')}>
            <option value="">—</option>
            {MONTHS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-d`}>Ngày</label>
          <select id={`${idPrefix}-d`} value={d} disabled={!m} onChange={(e) => setSolar(y, m, e.target.value)}>
            <option value="">—</option>
            {DAYS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className={styles.check} htmlFor={`${idPrefix}-approx`}>
        <input
          id={`${idPrefix}-approx`}
          type="checkbox"
          checked={v.approximate === true}
          onChange={(e) => update({ approximate: e.target.checked || undefined })}
        />
        Không chắc chắn (ghi “khoảng”)
      </label>

      <p className={styles.subLegend}>Âm lịch</p>
      <div className={styles.row3}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-ld`}>Ngày</label>
          <select id={`${idPrefix}-ld`} value={l.day ?? ''} onChange={(e) => setLunar({ day: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">—</option>
            {LUNAR_DAYS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-lm`}>Tháng</label>
          <select id={`${idPrefix}-lm`} value={l.month ?? ''} onChange={(e) => setLunar({ month: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">—</option>
            {MONTHS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-ly`}>Năm</label>
          <input
            id={`${idPrefix}-ly`}
            inputMode="numeric"
            autoComplete="off"
            value={l.year ?? ''}
            onChange={(e) => {
              const n = e.target.value.replace(/\D/g, '').slice(0, 4);
              setLunar({ year: n ? Number(n) : undefined });
            }}
          />
        </div>
      </div>
      <label className={styles.check} htmlFor={`${idPrefix}-leap`}>
        <input id={`${idPrefix}-leap`} type="checkbox" checked={l.isLeapMonth === true} onChange={(e) => setLunar({ isLeapMonth: e.target.checked || undefined })} />
        Tháng nhuận
      </label>
      {suggestion && (
        <p className={styles.suggest} role="status">
          {suggestion.text}.{' '}
          <button type="button" className={styles.textButton} onClick={suggestion.apply}>
            Điền vào
          </button>
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-place`}>Nơi</label>
        <input id={`${idPrefix}-place`} value={v.place ?? ''} onChange={(e) => update({ place: e.target.value || undefined })} />
      </div>
    </fieldset>
  );
}
