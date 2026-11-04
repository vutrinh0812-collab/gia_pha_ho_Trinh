import { useMemo } from 'react';
import { useOverlays } from '@/app/useOverlays';
import { formatSolarShort, todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import { canChiOfYear, solarToLunar } from '@/lib/lunar';
import { useClanStore } from '@/store/clanStore';
import styles from './AnniversariesPage.module.css';

const WINDOW_DAYS = 60;

/** Ngày giỗ (SPEC §9): anniversaries in the next 60 days, converted to this year's solar dates. */
export function AnniversariesPage() {
  const model = useClanStore((s) => s.model)!;
  const { open } = useOverlays();
  const today = todaySolar();
  const items = useMemo(() => upcomingAnniversaries(model, todaySolar(), WINDOW_DAYS), [model]);
  const lunarToday = solarToLunar(today.day, today.month, today.year);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Ngày giỗ</h1>
        <p>
          Hôm nay {formatSolarShort(today, true).toLowerCase()}, tức ngày {lunarToday.day} tháng {lunarToday.month}
          {lunarToday.isLeapMonth ? ' nhuận' : ''} năm {canChiOfYear(lunarToday.year)}. {items.length} ngày giỗ trong{' '}
          {WINDOW_DAYS} ngày tới.
        </p>
      </header>
      {items.length === 0 ? (
        <p className={styles.empty}>Không có ngày giỗ nào trong {WINDOW_DAYS} ngày tới.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((a) => {
            const gen = model.generationOf(a.person.id);
            const meta = [
              gen ? `Đời ${gen}` : null,
              a.person.branchLabel ?? null,
              a.yearsSince !== null ? `mất ${a.yearsSince} năm` : null,
            ].filter(Boolean);
            return (
              <li key={a.person.id}>
                <button type="button" className={styles.item} onClick={() => open('ct', a.person.id)}>
                  <span className={styles.when} data-soon={a.inDays <= 7 || undefined}>
                    {a.inDays === 0 ? 'Hôm nay' : `Còn ${a.inDays} ngày`}
                  </span>
                  <span className={styles.name}>{a.person.fullName}</span>
                  <span className={styles.meta}>{meta.join(' · ')}</span>
                  <span className={styles.date}>
                    {formatSolarShort(a.date, true)} · {a.lunar.day}/{a.lunar.month} âm lịch
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
