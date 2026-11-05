import { useMemo } from 'react';
import { useOverlays } from '@/app/useOverlays';
import { formatSolarShort, todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { canChiOfYear, solarToLunar } from '@/lib/lunar';
import { useClanStore } from '@/store/clanStore';
import { Avatar } from '../person/Avatar';
import styles from './AnniversariesPage.module.css';

const WINDOW_DAYS = 60;
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function spouseSummary(model: ClanModel, person: PersonRec): string | null {
  const fam = model.family(person.id);
  if (!fam) return null;
  const partners = fam.partnerships.map((x) => x.partner).filter((p): p is PersonRec => Boolean(p));
  if (partners.length === 0) return null;
  const label = person.gender === 'male' ? 'Vợ' : 'Chồng';
  return `${label}: ${partners.map((p) => p.fullName).join(', ')}`;
}

/** Ngày giỗ (SPEC §9): anniversaries in the next 60 days + full-year clan calendar. */
export function AnniversariesPage() {
  const model = useClanStore((s) => s.model)!;
  const { open } = useOverlays();
  const today = todaySolar();
  const items = useMemo(() => upcomingAnniversaries(model, todaySolar(), WINDOW_DAYS), [model]);
  const allYear = useMemo(
    () =>
      model.persons
        .filter((p) => p.death?.isDeceased && p.deathAnniversaryLunar)
        .sort((a, b) => {
          const la = a.deathAnniversaryLunar!;
          const lb = b.deathAnniversaryLunar!;
          return la.month - lb.month || la.day - lb.day;
        }),
    [model],
  );
  const lunarToday = solarToLunar(today.day, today.month, today.year);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Ngày giỗ</h1>
        <p className={styles.subLead}>
          {items.length > 0 ? `${items.length} ngày giỗ sắp tới` : `Không có ngày giỗ trong ${WINDOW_DAYS} ngày tới`}
          {' · '}Hôm nay {formatSolarShort(today, true).toLowerCase()} ({lunarToday.day}/{lunarToday.month}
          {lunarToday.isLeapMonth ? ' nhuận' : ''} năm {canChiOfYear(lunarToday.year)})
        </p>
      </header>

      <section className={styles.card} aria-label="Sắp tới">
        <div className={styles.cardTitleRow}>
          <span className={styles.diamond} aria-hidden="true">◆</span>
          <h2 className={styles.cardTitle}>Sắp tới</h2>
          <span className={styles.diamond} aria-hidden="true">◆</span>
        </div>
        {items.length === 0 ? (
          <p className={styles.empty}>Không có ngày giỗ nào trong {WINDOW_DAYS} ngày tới.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((a) => {
              const gen = model.generationOf(a.person.id);
              const spouse = spouseSummary(model, a.person);
              const meta = [
                gen ? `Đời ${gen}` : null,
                spouse,
                a.person.branchLabel ?? null,
                a.yearsSince !== null ? `mất ${a.yearsSince} năm` : null,
              ].filter(Boolean);
              const weekday = WEEKDAYS[new Date(a.date.year, a.date.month - 1, a.date.day).getDay()];
              return (
                <li key={a.person.id}>
                  <button type="button" className={styles.item} onClick={() => open('ct', a.person.id)}>
                    <div className={styles.itemMain}>
                      <div className={styles.itemInfo}>
                        <span className={styles.when} data-soon={a.inDays <= 14 || undefined}>
                          {a.inDays === 0 ? 'Hôm nay' : `Còn ${a.inDays} ngày`}
                        </span>
                        <span className={styles.name}>{a.person.fullName}</span>
                        <span className={styles.date}>
                          {formatSolarShort(a.date, true)} · {a.lunar.day}/{a.lunar.month} âm lịch
                        </span>
                      </div>
                      <div className={styles.calBox} aria-hidden="true">
                        <span className={styles.calDow}>{weekday}</span>
                        <span className={styles.calDay}>{a.date.day}</span>
                        <span className={styles.calMonth}>tháng {a.date.month}</span>
                      </div>
                    </div>
                    {meta.length > 0 && <span className={styles.meta}>{meta.join(' · ')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {allYear.length > 0 && (
        <section className={styles.card} aria-label="Cả năm">
          <div className={styles.cardTitleRow}>
            <span className={styles.diamond} aria-hidden="true">◆</span>
            <h2 className={styles.cardTitle}>Cả năm</h2>
            <span className={styles.diamond} aria-hidden="true">◆</span>
          </div>
          <ul className={styles.yearList}>
            {allYear.map((p) => {
              const gen = model.generationOf(p.id);
              const lunar = p.deathAnniversaryLunar!;
              const spouse = spouseSummary(model, p);
              const details = [`Giỗ ${lunar.day}/${lunar.month} âm lịch`, gen ? `Đời ${gen}` : null, spouse].filter(Boolean);
              return (
                <li key={p.id}>
                  <button type="button" className={styles.yearItem} onClick={() => open('ct', p.id)}>
                    {p.photoUrl ? (
                      <Avatar person={p} size={56} ring />
                    ) : (
                      gen && (
                        <span className={styles.seal} aria-hidden="true">
                          <span className={styles.sealLabel}>Đời</span>
                          <span className={styles.sealNum}>{gen}</span>
                        </span>
                      )
                    )}
                    <span className={styles.yearText}>
                      <span className={styles.yearName}>{p.fullName}</span>
                      <span className={styles.yearMeta}>{details.join(' · ')}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
