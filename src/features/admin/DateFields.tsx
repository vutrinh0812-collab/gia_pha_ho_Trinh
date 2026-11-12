import { useEffect, useState } from 'react';
import { canChiOfYear, lunarToSolar, solarToLunar } from '@/lib/lunar';
import type { DateInfo } from '@/lib/types';
import { WheelColumn, type WheelOption } from './DateWheel';
import styles from './AdminForms.module.css';

interface Props {
  idPrefix: string;
  legend: string;
  value: DateInfo | undefined;
  onChange(next: DateInfo | undefined): void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const LUNAR_DAYS_LIST = Array.from({ length: 30 }, (_, i) => i + 1);
/** Oldest year on the wheel: genealogies go back a few centuries. */
const FIRST_YEAR = 1000;

const none = (label: string): WheelOption => ({ value: '', label });
const MONTH_OPTIONS: WheelOption[] = [none('Tháng'), ...MONTHS.map((x) => ({ value: String(x), label: `tháng ${x}` }))];
/** Newest first: the wheel starts at this year and scrolls back in time. */
const YEAR_OPTIONS: WheelOption[] = [
  none('Năm'),
  ...Array.from({ length: new Date().getFullYear() - FIRST_YEAR + 1 }, (_, i) => {
    const y = String(new Date().getFullYear() - i);
    return { value: y, label: y };
  }),
];
function dayOptions(month: string, year: string): WheelOption[] {
  const n = month ? new Date(year ? Number(year) : 2000, Number(month), 0).getDate() : 31;
  return [none('Ngày'), ...Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))];
}

function parseSolar(s: string | undefined) {
  const [y = '', m = '', d = ''] = (s ?? '').split('-');
  return { y, m: m ? String(Number(m)) : '', d: d ? String(Number(d)) : '' };
}
const pad = (n: string) => n.padStart(2, '0');
/** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'; empty without a year. A day needs its month. */
const toSolar = (y: string, m: string, d: string) => (y ? [y, m && pad(m), m && d && pad(d)].filter(Boolean).join('-') : '');

/**
 * A date that may be partial (SPEC §6): year only, year + month, or a full date,
 * with "khoảng" for uncertain dates, the lunar date and the place. Entering one
 * calendar suggests the other.
 */
export function DateFields({ idPrefix, legend, value, onChange }: Props) {
  const v = value ?? {};
  // The wheel keeps a day or month turned before the year is (D93); the date is saved once
  // it has a year: year only, year + month, or the full date.
  const [wheel, setWheel] = useState(() => parseSolar(v.solar));
  useEffect(() => {
    const saved = parseSolar(v.solar);
    // A date set from outside (the lunar suggestion, another person) replaces the wheel's.
    setWheel((w) => (toSolar(w.y, w.m, w.d) === (v.solar ?? '') ? w : saved));
  }, [v.solar]);
  const { y, m, d } = wheel;
  const l = v.lunar ?? {};

  const update = (patch: Partial<DateInfo>) => {
    const next: DateInfo = { ...v, ...patch };
    const empty = !next.solar && !next.lunar && !next.place && !next.approximate;
    onChange(empty ? undefined : next);
  };
  const setSolar = (ny: string, nm: string, nd: string) => {
    // A day past the end of the month (31 → February) comes back to its last day.
    const max = nm ? new Date(ny ? Number(ny) : 2000, Number(nm), 0).getDate() : 31;
    const day = nd && Number(nd) > max ? String(max) : nd;
    setWheel({ y: ny, m: nm, d: day });
    const solar = toSolar(ny, nm, day);
    if (solar !== (v.solar ?? '')) update({ solar: solar || undefined });
  };
  const setLunar = (patch: Partial<NonNullable<DateInfo['lunar']>>) => {
    const next = { ...l, ...patch };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, x]) => x !== undefined && x !== false));
    update({ lunar: Object.keys(cleaned).length ? (cleaned as DateInfo['lunar']) : undefined });
  };

  // Suggestions between the two calendars.
  let suggestion: { text: string; apply(): void } | null = null;
  if (y && m && d) {
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
      {/* One wheel, day – month – year (D93); turn each column or type the number. */}
      <div className={styles.wheel} role="group" aria-label={`${legend} (dương lịch): ngày, tháng, năm`}>
        <WheelColumn id={`${idPrefix}-d`} label="Ngày" options={dayOptions(m, y)} value={d} onChange={(nd) => setSolar(y, m, nd)} />
        <WheelColumn id={`${idPrefix}-m`} label="Tháng" options={MONTH_OPTIONS} value={m} onChange={(nm) => setSolar(y, nm, d)} />
        <WheelColumn id={`${idPrefix}-y`} label="Năm" options={YEAR_OPTIONS} value={y} onChange={(ny) => setSolar(ny, m, d)} />
      </div>
      <p className={styles.wheelValue} aria-live="polite">
        {y ? `Đã chọn: ${[m && d ? `ngày ${d}` : '', m ? `tháng ${m}` : '', `năm ${y}`].filter(Boolean).join(' ')}` : m || d ? 'Chọn thêm năm để lưu ngày này.' : 'Chưa chọn ngày. Có thể chỉ chọn năm, hoặc tháng và năm.'}
      </p>
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
            {LUNAR_DAYS_LIST.map((x) => (
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
