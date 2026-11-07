/**
 * A person's profile, laid out like a social-network profile page: cover band,
 * round portrait, name and key facts on top, then cards for the details, the
 * biography and the family. Used in the detail sheet and on /nguoi/:id.
 * Admins edit from here: the portrait, every section, and empty fields.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BirthIcon,
  CameraIcon,
  EditIcon,
  MemorialIcon,
  PersonIcon,
  PlaceIcon,
  PlusIcon,
  WorkIcon,
} from '@/app/ui/icons';
import { getAdminBackend } from '@/lib/admin/backend';
import { editPerson, personContent } from '@/lib/admin/changes';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { formatDateInfo, lifeSpan, spouseRole, toRoman, visibleNotes } from '@/lib/format';
import { daysBetween, nextLunarAnniversary, type SolarDate } from '@/lib/lunar';
import { useAdminStore, useCanEdit } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { resizeImage } from '../admin/resizeImage';
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
  const [note, setNote] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const edit = () => openAdmin('edit', person.id);

  const fam = model.family(person.id);
  const children = fam?.partnerships.flatMap((x) => x.children) ?? [];
  const parent = model.bloodlineParent(person.id);
  const o = person.otherNames;
  const aka = [o?.huy && `Húy ${o.huy}`, o?.tu && `Tự ${o.tu}`, o?.hieu && `Hiệu ${o.hieu}`, o?.thuong && `Thường gọi ${o.thuong}`]
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
            {isAdmin && (
              <PhotoButton
                model={model}
                person={person}
                onSuccess={(msg) => {
                  setPhotoError(null);
                  setNote(msg);
                }}
                onError={(msg) => {
                  setNote(null);
                  setPhotoError(msg);
                }}
              />
            )}
          </div>
          <div className={styles.titleBlock}>
            {variant === 'page' ? <h1 className={styles.name}>{person.fullName}</h1> : <h2 className={styles.name}>{person.fullName}</h2>}
            {aka && <p className={styles.aka}>{aka}</p>}
            {yearsParts.length > 0 && <p className={styles.years}>{yearsParts.join(' · ')}</p>}
          </div>
        </div>
        {/* Only admins act on a profile; family links are in the "Gia đình" card below (D57). */}
        {isAdmin && (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={edit}>
              <EditIcon width={18} height={18} /> Sửa hồ sơ
            </button>
            <button type="button" className={styles.secondary} onClick={() => openAdmin('menu', person.id)}>
              <PlusIcon width={18} height={18} /> Thêm người thân
            </button>
          </div>
        )}
        {photoError && (
          <p className={styles.errorNote} role="alert">
            {photoError}
          </p>
        )}
        {note && (
          <p className={styles.note} role="status">
            {note}
          </p>
        )}
      </header>

      <div className={styles.body}>
        <Anniversary person={person} />
        <About person={person} parent={parent} isAdmin={isAdmin} onEdit={edit} />
        <FamilyCard model={model} person={person} isAdmin={isAdmin} onPick={onPick} />
        {children.length > 0 && (
          <p className={styles.printLink}>
            <Link to={`/print?goc=${encodeURIComponent(person.id)}`}>In gia phả theo chi của {person.fullName} →</Link>
          </p>
        )}
      </div>
    </article>
  );
}

/** Admin: change the portrait right from the profile or family center card. */
export function PhotoButton({
  model,
  person,
  onSuccess,
  onError,
}: {
  model: ClanModel;
  person: PersonRec;
  onSuccess?(msg: string): void;
  onError(msg: string): void;
}) {
  const apply = useAdminStore((s) => s.apply);
  const input = useRef<HTMLInputElement>(null);
  const [can, setCan] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void getAdminBackend().then((b) => live && setCan(Boolean(b.uploadPhoto)));
    return () => {
      live = false;
    };
  }, []);
  if (!can) return null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const backend = await getAdminBackend();
      const { image, thumb } = await resizeImage(file);
      const url = await backend.uploadPhoto!(person.id, image, thumb);
      const ok = await apply(editPerson(model, person.id, { ...personContent(person), photoUrl: url }), 'Đã đổi ảnh.');
      if (ok) onSuccess?.('Đã cập nhật ảnh đại diện.');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Không tải được ảnh lên.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.photoButton}
        onClick={(e) => {
          e.stopPropagation();
          input.current?.click();
        }}
        disabled={busy}
        aria-label={person.photoUrl ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
        title={person.photoUrl ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
      >
        {busy ? <span className={styles.spinner} /> : <CameraIcon width={18} height={18} />}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </>
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

/** Admin: a compact row of "+ …" chips for what can be added, with a short label in front. */
function AddRow({ label, items }: { label: string; items: Array<{ key: string; text: string; name: string; onClick(): void }> }) {
  return (
    <div className={styles.addRow} role="group" aria-label={label}>
      <span className={styles.addLabel} aria-hidden="true">
        {label}:
      </span>
      {items.map((it) => (
        <button key={it.key} type="button" className={styles.addButton} onClick={it.onClick} aria-label={it.name}>
          <PlusIcon width={14} height={14} aria-hidden="true" />
          {it.text}
        </button>
      ))}
    </div>
  );
}

function Card({ title, area, onEdit, children }: { title: string; area: 'about' | 'bio' | 'family'; onEdit?: () => void; children: ReactNode }) {
  return (
    <section className={styles.card} data-area={area} aria-label={title}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleWrap}>
          <span className={styles.diamond} aria-hidden="true">◆</span>
          <h3>{title}</h3>
          <span className={styles.diamond} aria-hidden="true">◆</span>
        </div>
        {onEdit && (
          <button type="button" className={styles.cardEdit} onClick={onEdit} aria-label={`Sửa: ${title}`} title="Sửa">
            <EditIcon width={16} height={16} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Characters above which a fact ("Con của …", a place) spans the full width of the card. */
const WIDE_FACT = 16;

function About({
  person,
  parent,
  isAdmin,
  onEdit,
}: {
  person: PersonRec;
  parent: PersonRec | undefined;
  isAdmin: boolean;
  onEdit(): void;
}) {
  const deceased = person.death?.isDeceased === true;
  // `add` is the full name of the admin's button, `short` the text on its chip.
  const rows: Array<{ icon: ReactNode; label: string; value: string | null | undefined; add?: string; short?: string }> = [
    { icon: <BirthIcon />, label: 'Sinh', value: formatDateInfo(person.birth), add: 'Thêm ngày sinh', short: 'Ngày sinh' },
    { icon: <PlaceIcon />, label: 'Quê quán, nơi sinh', value: person.birth?.place, add: 'Thêm nơi sinh', short: 'Nơi sinh' },
    ...(deceased
      ? [
          { icon: <MemorialIcon />, label: 'Mất', value: formatDateInfo(person.death) || 'Đã mất, chưa rõ ngày' },
          { icon: <PlaceIcon />, label: 'An táng', value: person.burialPlace, add: 'Thêm nơi an táng', short: 'Nơi an táng' },
        ]
      : []),
    { icon: <WorkIcon />, label: 'Nghề nghiệp', value: person.occupation, add: 'Thêm nghề nghiệp', short: 'Nghề nghiệp' },
    {
      icon: <PersonIcon />,
      label: 'Con của',
      value: parent ? `${parent.fullName}${person.birthOrder ? ` (thứ ${toRoman(person.birthOrder)})` : ''}` : null,
    },
  ];
  const shown = rows.filter((r) => r.value);
  const missing = isAdmin ? rows.filter((r) => !r.value && r.add) : [];
  const bio = visibleNotes(person.notes);
  const hasBio = Boolean(bio);
  return (
    <Card title="Giới thiệu & tiểu sử" area="about" onEdit={isAdmin ? onEdit : undefined}>
      {shown.length === 0 && !hasBio && !isAdmin && <p className={styles.empty}>Chưa có thông tin.</p>}
      {shown.length > 0 && (
        <ul className={styles.facts}>
          {shown.map((r) => (
            // A long value (a parent's full name, a long place name) takes the whole row, so it
            // is not squeezed into half the card and broken over several lines (D71).
            <li key={r.label} data-wide={(r.value?.length ?? 0) > WIDE_FACT || undefined}>
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
      {(missing.length > 0 || (isAdmin && !hasBio)) && (
        <AddRow
          label="Bổ sung"
          items={[
            ...missing.map((r) => ({ key: r.label, text: r.short!, name: r.add!, onClick: onEdit })),
            ...(isAdmin && !hasBio ? [{ key: 'bio', text: 'Tiểu sử', name: 'Viết tiểu sử, ghi chú', onClick: onEdit }] : []),
          ]}
        />
      )}
    </Card>
  );
}

function FamilyCard({
  model,
  person,
  isAdmin,
  onPick,
}: {
  model: ClanModel;
  person: PersonRec;
  isAdmin: boolean;
  onPick(p: PersonRec): void;
}) {
  const openAdmin = useAdminUi((s) => s.open);
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
  if (!groups.length && !isAdmin) return null;

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
      {isAdmin && (
        <AddRow
          label="Thêm"
          items={[
            { key: 'child', text: 'Con', name: 'Thêm con', onClick: () => openAdmin('addChild', person.id) },
            ...(person.isBloodline
              ? [
                  {
                    key: 'spouse',
                    text: person.gender === 'male' ? 'Vợ' : 'Chồng',
                    name: person.gender === 'male' ? 'Thêm vợ' : 'Thêm chồng',
                    onClick: () => openAdmin('addSpouse', person.id),
                  },
                ]
              : []),
          ]}
        />
      )}
    </Card>
  );
}
