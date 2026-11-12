/**
 * A person's profile, laid out like a social-network profile page: cover band,
 * round portrait, name and key facts on top, then cards for the details, the
 * biography and the family. Used in the detail sheet and on /nguoi/:id.
 * It shows only what is known. Editors get one button, "Chỉnh sửa hồ sơ", which opens the whole
 * edit form: fields, portrait, relatives and other actions in one place (D84).
 */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BirthIcon,
  EditIcon,
  MemorialIcon,
  PersonIcon,
  PlaceIcon,
  WorkIcon,
} from '@/app/ui/icons';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { formatDateInfo, lifeSpan, spouseRole, toRoman, visibleNotes, otherName } from '@/lib/format';
import { daysBetween, nextLunarAnniversary, type SolarDate } from '@/lib/lunar';
import { useCanEdit } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { Avatar } from './Avatar';
import styles from './Profile.module.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function today(): SolarDate {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Public link to a person's profile page. */
export function personUrl(id: string): string {
  return `${window.location.origin}/nguoi/${encodeURIComponent(id)}`;
}

interface ProfileProps {
  model: ClanModel;
  person: PersonRec;
  /** 'page' is the full /nguoi/:id page; 'sheet' is the narrower detail panel. */
  variant: 'page' | 'sheet';
  /** Opens another person (in the sheet, or as a page). */
  onPick(p: PersonRec): void;
}

export function Profile({ model, person, variant, onPick }: ProfileProps) {
  const isAdmin = useCanEdit();
  const openAdmin = useAdminUi((s) => s.open);
  const edit = () => openAdmin('edit', person.id);

  const fam = model.family(person.id);
  const children = fam?.partnerships.flatMap((x) => x.children) ?? [];
  const parent = model.bloodlineParent(person.id);
  const o = person.otherNames;
  // "Tên khác" in place of húy, tự, hiệu (D93); the name people call them by stays.
  const other = otherName(o);
  const aka = [other && `Tên khác: ${other}`, o?.thuong && `Thường gọi: ${o.thuong}`]
    .filter(Boolean)
    .join(' · ');

  const gio = person.deathAnniversaryLunar;
  const yearsParts = [
    lifeSpan(person) || null,
    person.death?.isDeceased ? 'đã mất' : null,
    gio ? `giỗ ${gio.day}/${gio.month} âm lịch` : null,
  ].filter(Boolean);

  return (
    <article className={styles.profile} data-variant={variant} aria-label={`Trang của ${person.fullName}`}>
      <header className={styles.top}>
        <div className={styles.identity}>
          <div className={styles.portrait} data-has-photo={Boolean(person.photoUrl) || undefined}>
            {/* No photo: the grey silhouette (D60). */}
            {person.photoUrl ? (
              <Avatar person={person} size={variant === 'page' ? 148 : 116} ring highPriority zoomable />
            ) : (
              <Avatar person={person} size={variant === 'page' ? 120 : 96} ring />
            )}
          </div>
          <div className={styles.titleBlock}>
            {variant === 'page' ? <h1 className={styles.name}>{person.fullName}</h1> : <h2 className={styles.name}>{person.fullName}</h2>}
            {aka && <p className={styles.aka}>{aka}</p>}
            {yearsParts.length > 0 && <p className={styles.years}>{yearsParts.join(' · ')}</p>}
          </div>
        </div>
        {/* Only editors act on a profile; family links are in the "Gia đình" card below (D57).
            One button opens the whole edit form (D84). */}
        {isAdmin && (
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={edit}>
              <EditIcon width={18} height={18} /> Chỉnh sửa hồ sơ
            </button>
          </div>
        )}
      </header>

      <div className={styles.body}>
        <Anniversary person={person} />
        <About person={person} parent={parent} />
        <FamilyCard model={model} person={person} onPick={onPick} />
        {children.length > 0 && (
          <p className={styles.printLink}>
            <Link to={`/print?goc=${encodeURIComponent(person.id)}`}>In gia phả theo chi của {person.fullName} →</Link>
          </p>
        )}
      </div>
    </article>
  );
}

function Anniversary({ person }: { person: PersonRec }) {
  const info = useMemo(() => {
    const a = person.deathAnniversaryLunar;
    if (!a || !person.death?.isDeceased) return null;
    const t = today();
    const next = nextLunarAnniversary(a.day, a.month, t);
    const inDays = daysBetween(t, next);
    const weekday = WEEKDAYS[new Date(next.year, next.month - 1, next.day).getDay()];
    return {
      lunar: `${a.day}/${a.month} âm lịch`,
      next: `${weekday}, ${next.day}/${next.month}/${next.year}`,
      when: inDays === 0 ? 'Hôm nay' : `Còn ${inDays} ngày`,
    };
  }, [person.deathAnniversaryLunar, person.death?.isDeceased]);
  if (!info) return null;
  return (
    <section className={styles.gio} aria-label="Ngày giỗ">
      <MemorialIcon width={26} height={26} />
      <div>
        <p className={styles.gioTitle}>Giỗ ngày {info.lunar}</p>
        <p className={styles.gioNext}>
          Năm nay: {info.next} · <strong>{info.when}</strong>
        </p>
      </div>
    </section>
  );
}

function Card({ title, area, children }: { title: string; area: 'about' | 'bio' | 'family'; children: ReactNode }) {
  return (
    <section className={styles.card} data-area={area} aria-label={title}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.diamond} aria-hidden="true">◆</span>
          <h3>{title}</h3>
          <span className={styles.diamond} aria-hidden="true">◆</span>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Characters above which a fact ("Con của …", a place, "khoảng năm 1843") spans the full width
 *  of the card: half a card on a phone holds about 12 bold characters (D86). */
const WIDE_FACT = 12;

/**
 * Which facts take the whole row: long ones, and a short one that would sit alone on its row
 * (next to a long one, or last) and be squeezed into half the card for nothing (D71, D86).
 */
export function wideFacts(values: Array<string | null | undefined>): boolean[] {
  const wide = values.map((v) => (v?.length ?? 0) > WIDE_FACT);
  let pending = -1; // a short fact still waiting for a partner on its row
  wide.forEach((w, i) => {
    if (w) {
      if (pending >= 0) wide[pending] = true;
      pending = -1;
    } else if (pending >= 0) {
      pending = -1;
    } else {
      pending = i;
    }
  });
  if (pending >= 0) wide[pending] = true;
  return wide;
}

function About({ person, parent }: { person: PersonRec; parent: PersonRec | undefined }) {
  const deceased = person.death?.isDeceased === true;
  const rows: Array<{ icon: ReactNode; label: string; value: string | null | undefined }> = [
    { icon: <BirthIcon />, label: 'Sinh', value: formatDateInfo(person.birth) },
    { icon: <PlaceIcon />, label: 'Quê quán, nơi sinh', value: person.birth?.place },
    ...(deceased
      ? [
          { icon: <MemorialIcon />, label: 'Mất', value: formatDateInfo(person.death) || 'Đã mất, chưa rõ ngày' },
          { icon: <PlaceIcon />, label: 'An táng', value: person.burialPlace },
        ]
      : []),
    { icon: <WorkIcon />, label: 'Nghề nghiệp', value: person.occupation },
    {
      icon: <PersonIcon />,
      label: 'Con của',
      value: parent ? `${parent.fullName}${person.birthOrder ? ` (thứ ${toRoman(person.birthOrder)})` : ''}` : null,
    },
  ];
  const shown = rows.filter((r) => r.value);
  const wide = wideFacts(shown.map((r) => r.value));
  const bio = visibleNotes(person.notes);
  const hasBio = Boolean(bio);
  return (
    <Card title="Giới thiệu & tiểu sử" area="about">
      {shown.length === 0 && !hasBio && <p className={styles.empty}>Chưa có thông tin.</p>}
      {shown.length > 0 && (
        <ul className={styles.facts}>
          {shown.map((r, i) => (
            // A long value (a parent's full name, a long place name) takes the whole row, so it
            // is not squeezed into half the card and broken over several lines (D71, D86).
            <li key={r.label} data-wide={wide[i] || undefined}>
              <span className={styles.factIcon}>{r.icon}</span>
              <span>
                <span className={styles.factLabel}>{r.label}</span>
                <span className={styles.factValue}>{r.value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasBio && (
        <div className={shown.length > 0 ? styles.bioSection : undefined}>
          <p className={styles.bio}>{bio}</p>
        </div>
      )}
    </Card>
  );
}

function FamilyCard({
  model,
  person,
  onPick,
}: {
  model: ClanModel;
  person: PersonRec;
  onPick(p: PersonRec): void;
}) {
  const fam = model.family(person.id);
  if (!fam) return null;
  const groups: Array<{ label: string; people: Array<{ p: PersonRec; caption?: string }> }> = [];
  const parents = [fam.father, fam.mother].filter((p): p is PersonRec => Boolean(p));
  if (parents.length) groups.push({ label: 'Cha mẹ', people: parents.map((p) => ({ p, caption: p.gender === 'male' ? 'Cha' : 'Mẹ' })) });
  const partners = fam.partnerships.filter((x) => x.partner);
  if (partners.length) {
    groups.push({
      label: person.gender === 'male' ? 'Vợ' : 'Chồng',
      people: partners.map(({ partner, union }) => ({
        p: partner!,
        caption: person.isBloodline ? spouseRole(partner!.gender, union.order, fam.partnerships.length) : undefined,
      })),
    });
  }
  const children = fam.partnerships.flatMap((x) => x.children);
  if (children.length) {
    groups.push({ label: `Các con (${children.length})`, people: children.map((c) => ({ p: c, caption: c.birthOrder ? toRoman(c.birthOrder) : undefined })) });
  }
  if (fam.siblings.length) groups.push({ label: `Anh chị em (${fam.siblings.length})`, people: fam.siblings.map((p) => ({ p })) });
  if (!groups.length) return null;

  return (
    <Card title="Gia đình" area="family">
      {groups.map((g) => {
        const isNumberedList = g.label.startsWith('Các con') || g.label.startsWith('Anh chị em');
        return (
          <div key={g.label} className={styles.group}>
            <h4 className={styles.groupTitle}>
              <span>{g.label}</span>
            </h4>
            <ul className={isNumberedList ? styles.numberedPeople : styles.people}>
              {g.people.map(({ p, caption }) => (
                <li key={p.id}>
                  <button type="button" className={isNumberedList ? styles.numberedPerson : styles.person} onClick={() => onPick(p)}>
                    {isNumberedList ? (
                      <>
                        <span className={styles.romanCol}>{caption ?? ''}</span>
                        {p.photoUrl && <Avatar person={p} size={44} />}
                        <span className={styles.personText}>
                          <span className={styles.personName}>{p.fullName}</span>
                          {lifeSpan(p) && <span className={styles.personMeta}>{lifeSpan(p)}</span>}
                        </span>
                      </>
                    ) : (
                      <>
                        <Avatar person={p} size={52} />
                        <span className={styles.personText}>
                          <span className={styles.personName}>
                            {caption ? <span className={styles.inlineRole}>{caption} </span> : null}
                            {p.fullName}
                          </span>
                          {lifeSpan(p) && <span className={styles.personMeta}>{lifeSpan(p)}</span>}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Card>
  );
}
