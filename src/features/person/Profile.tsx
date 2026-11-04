/**
 * A person's profile, laid out like a social-network profile page: cover band,
 * round portrait, name and key facts on top, then cards for the details, the
 * biography and the family. Used in the detail sheet and on /nguoi/:id.
 * Admins edit from here: the portrait, every section, and empty fields.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BirthIcon,
  CameraIcon,
  EditIcon,
  FamilyIcon,
  MemorialIcon,
  MoreIcon,
  NoteIcon,
  PersonIcon,
  PlaceIcon,
  ShareIcon,
  WorkIcon,
} from '@/app/ui/icons';
import { getAdminBackend } from '@/lib/admin/backend';
import { editPerson, personContent } from '@/lib/admin/changes';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { formatDateInfo, lifeSpan, spouseRole, toRoman } from '@/lib/format';
import { daysBetween, nextLunarAnniversary, type SolarDate } from '@/lib/lunar';
import { shareLink } from '@/lib/share';
import { useAdminStore } from '@/store/adminStore';
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

/** Everyone below a person in the book (children, grandchildren…), bloodline only. */
function descendantCount(model: ClanModel, id: string): number {
  let n = 0;
  const stack = [id];
  while (stack.length) {
    for (const u of model.index.unionsOf(stack.pop()!)) {
      for (const c of model.index.childrenOf(u.id)) {
        n++;
        stack.push(c.id);
      }
    }
  }
  return n;
}

function relationLabel(model: ClanModel, p: PersonRec): string {
  if (!p.isBloodline) return p.gender === 'female' ? 'Dâu' : 'Rể';
  return model.isMaternal(p.id) ? 'Bên ngoại' : 'Huyết thống';
}

interface ProfileProps {
  model: ClanModel;
  person: PersonRec;
  /** 'page' is the full /nguoi/:id page; 'sheet' is the narrower detail panel. */
  variant: 'page' | 'sheet';
  /** Opens another person (in the sheet, or as a page). */
  onPick(p: PersonRec): void;
  /** Extra buttons for the action row (e.g. "Dòng dõi" on the tree). */
  extraActions?: ReactNode;
}

export function Profile({ model, person, variant, onPick, extraActions }: ProfileProps) {
  const isAdmin = useAdminStore((s) => s.status === 'admin');
  const openAdmin = useAdminUi((s) => s.open);
  const navigate = useNavigate();
  const [note, setNote] = useState<string | null>(null);
  const edit = () => openAdmin('edit', person.id);

  const gen = model.generationOf(person.id);
  const fam = model.family(person.id);
  const children = fam?.partnerships.flatMap((x) => x.children) ?? [];
  const partners = fam?.partnerships.filter((x) => x.partner) ?? [];
  const descendants = useMemo(() => descendantCount(model, person.id), [model, person.id]);
  const parent = model.bloodlineParent(person.id);
  const o = person.otherNames;
  const aka = [o?.huy && `Húy ${o.huy}`, o?.tu && `Tự ${o.tu}`, o?.hieu && `Hiệu ${o.hieu}`, o?.thuong && `Thường gọi ${o.thuong}`]
    .filter(Boolean)
    .join(' · ');

  const share = async () => {
    const result = await shareLink({
      title: `${person.fullName} — ${model.settings.title}`,
      text: `${person.fullName} trong ${model.settings.title}`,
      url: personUrl(person.id),
    });
    if (result.kind === 'copied') setNote('Đã sao chép đường link.');
    else if (result.kind === 'manual') setNote(`Sao chép đường link này: ${result.url}`);
  };

  const chips = [
    gen ? `Đời ${gen}` : null,
    person.birthOrder ? `Thứ ${toRoman(person.birthOrder)}` : null,
    person.branchLabel,
    relationLabel(model, person),
  ].filter((c): c is string => Boolean(c));

  const stats: Array<[number, string]> = [];
  if (partners.length) stats.push([partners.length, person.gender === 'male' ? 'vợ' : 'chồng']);
  if (person.isBloodline) stats.push([children.length, 'con']);
  if (person.isBloodline && descendants > children.length) stats.push([descendants, 'con cháu']);

  return (
    <article className={styles.profile} data-variant={variant} aria-label={`Trang của ${person.fullName}`}>
      <header className={styles.top}>
        <div className={styles.cover} aria-hidden="true">
          <span className={styles.coverText}>{model.settings.title}</span>
        </div>
        <div className={styles.identity}>
          <div className={styles.portrait}>
            <Avatar person={person} size={variant === 'page' ? 128 : 104} ring />
            {isAdmin && <PhotoButton model={model} person={person} onError={setNote} />}
          </div>
          <div className={styles.titleBlock}>
            {variant === 'page' ? <h1 className={styles.name}>{person.fullName}</h1> : <h2 className={styles.name}>{person.fullName}</h2>}
            {aka && <p className={styles.aka}>{aka}</p>}
            <p className={styles.years}>
              {lifeSpan(person) || 'Chưa rõ năm sinh'}
              {person.death?.isDeceased && <span className={styles.deceased}>Đã mất</span>}
            </p>
          </div>
        </div>
        <ul className={styles.chips} aria-label="Vị trí trong gia phả">
          {chips.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {stats.length > 0 && (
          <ul className={styles.stats}>
            {stats.map(([n, label]) => (
              <li key={label}>
                <strong>{n}</strong> {label}
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          {isAdmin && (
            <>
              <button type="button" className={styles.primary} onClick={edit}>
                <EditIcon width={18} height={18} /> Sửa hồ sơ
              </button>
              <button type="button" className={styles.secondary} onClick={() => openAdmin('menu', person.id)}>
                <MoreIcon width={18} height={18} /> Thêm con, vợ/chồng…
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => navigate({ pathname: '/', search: `?${new URLSearchParams({ p: person.id })}` })}
          >
            <FamilyIcon width={18} height={18} /> Gia đình
          </button>
          {extraActions}
          {variant === 'sheet' && (
            <Link className={styles.secondary} to={`/nguoi/${encodeURIComponent(person.id)}`}>
              <PersonIcon width={18} height={18} /> Trang cá nhân
            </Link>
          )}
          <button type="button" className={styles.secondary} onClick={share}>
            <ShareIcon width={18} height={18} /> Chia sẻ
          </button>
        </div>
        {note && (
          <p className={styles.note} role="status">
            {note}
          </p>
        )}
      </header>

      <div className={styles.body}>
        <Anniversary person={person} />
        <About person={person} parent={parent} isAdmin={isAdmin} onEdit={edit} />
        <Biography person={person} isAdmin={isAdmin} onEdit={edit} />
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

/** Admin: change the portrait right from the profile. */
function PhotoButton({ model, person, onError }: { model: ClanModel; person: PersonRec; onError(msg: string): void }) {
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
      await apply(editPerson(model, person.id, { ...personContent(person), photoUrl: url }), 'Đã đổi ảnh.');
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
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={person.photoUrl ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
        title={person.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh'}
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

function Card({ title, onEdit, children }: { title: string; onEdit?: () => void; children: ReactNode }) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h3>{title}</h3>
        {onEdit && (
          <button type="button" className={styles.cardEdit} onClick={onEdit} aria-label={`Sửa: ${title}`}>
            <EditIcon width={16} height={16} /> Sửa
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

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
  const rows: Array<{ icon: ReactNode; label: string; value: string | null | undefined; add?: string }> = [
    { icon: <BirthIcon />, label: 'Sinh', value: formatDateInfo(person.birth), add: 'Thêm ngày sinh' },
    { icon: <PlaceIcon />, label: 'Quê quán, nơi sinh', value: person.birth?.place, add: 'Thêm nơi sinh' },
    ...(deceased
      ? [
          { icon: <MemorialIcon />, label: 'Mất', value: formatDateInfo(person.death) || 'Đã mất, chưa rõ ngày' },
          { icon: <PlaceIcon />, label: 'An táng', value: person.burialPlace, add: 'Thêm nơi an táng' },
        ]
      : []),
    { icon: <WorkIcon />, label: 'Nghề nghiệp', value: person.occupation, add: 'Thêm nghề nghiệp' },
    {
      icon: <FamilyIcon />,
      label: 'Con của',
      value: parent ? `${parent.fullName}${person.birthOrder ? ` (thứ ${toRoman(person.birthOrder)})` : ''}` : null,
    },
  ];
  const shown = rows.filter((r) => r.value);
  const missing = isAdmin ? rows.filter((r) => !r.value && r.add) : [];
  return (
    <Card title="Giới thiệu" onEdit={isAdmin ? onEdit : undefined}>
      {shown.length === 0 && !isAdmin && <p className={styles.empty}>Chưa có thông tin.</p>}
      <ul className={styles.facts}>
        {shown.map((r) => (
          <li key={r.label}>
            <span className={styles.factIcon}>{r.icon}</span>
            <span>
              <span className={styles.factLabel}>{r.label}</span>
              <span className={styles.factValue}>{r.value}</span>
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className={styles.addRow}>
          {missing.map((r) => (
            <button key={r.label} type="button" className={styles.addButton} onClick={onEdit}>
              + {r.add}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Biography({ person, isAdmin, onEdit }: { person: PersonRec; isAdmin: boolean; onEdit(): void }) {
  if (!person.notes && !isAdmin) return null;
  return (
    <Card title="Tiểu sử, ghi chú" onEdit={isAdmin && person.notes ? onEdit : undefined}>
      {person.notes ? (
        <p className={styles.bio}>{person.notes}</p>
      ) : (
        <button type="button" className={styles.addWide} onClick={onEdit}>
          <NoteIcon width={18} height={18} /> Viết vài dòng về {person.fullName}
        </button>
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
    <Card title="Gia đình">
      {groups.map((g) => (
        <div key={g.label} className={styles.group}>
          <h4 className={styles.groupTitle}>{g.label}</h4>
          <ul className={styles.people}>
            {g.people.map(({ p, caption }) => (
              <li key={p.id}>
                <button type="button" className={styles.person} onClick={() => onPick(p)}>
                  <Avatar person={p} size={44} />
                  <span className={styles.personText}>
                    <span className={styles.personName}>{p.fullName}</span>
                    <span className={styles.personMeta}>{[caption, lifeSpan(p)].filter(Boolean).join(' · ') || ' '}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {isAdmin && (
        <div className={styles.addRow}>
          <button type="button" className={styles.addButton} onClick={() => openAdmin('addChild', person.id)}>
            + Thêm con
          </button>
          {person.isBloodline && (
            <button type="button" className={styles.addButton} onClick={() => openAdmin('addSpouse', person.id)}>
              + {person.gender === 'male' ? 'Thêm vợ' : 'Thêm chồng'}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
