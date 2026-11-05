import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isInDialog, useHotkeys } from '@/app/useHotkeys';
import { useOverlays } from '@/app/useOverlays';
import { NoteIcon, TreeIcon, UpIcon } from '@/app/ui/icons';
import { formatSolarShort, todaySolar, upcomingAnniversaries } from '@/lib/anniversaries';
import type { ClanModel, Partnership, PersonRec } from '@/lib/clanModel';
import { childrenGroupLabel, givenName, lifeSpan, spouseRole, toRoman } from '@/lib/format';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { Avatar } from '../person/Avatar';
import { PersonCard, roleOf } from '../person/PersonCard';
import { PhotoButton } from '../person/Profile';
import styles from './FamilyView.module.css';

function countDescendants(model: ClanModel, id: string): number {
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

/**
 * "Gia đình" — the default view (SPEC 5A.1): one person in focus, then the
 * clan's next death anniversaries, the parents, spouses, children (grouped by
 * wife) and siblings, each as a readable list (design "Ember", D51).
 * Tap anyone to make them the centre; swipe up on the centre card to go up a generation.
 */
export function FamilyView() {
  const model = useClanStore((s) => s.model)!;
  const { params, open, goToFamily } = useOverlays();
  const requested = params.get('p');
  const centerId = requested && model.get(requested) ? requested : model.rootId;
  const family = model.family(centerId)!;
  const showMaternal = usePrefsStore((s) => s.showMaternal) ?? model.settings.showMaternalDescendants;

  // New centre → back to top of the page.
  const top = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    top.current?.scrollIntoView?.({ block: 'start' });
  }, [centerId]);

  const go = (p: PersonRec) => goToFamily(p.id);
  const parentId = model.index.parentUnionOf(centerId)?.bloodlinePersonId;
  const goUp = parentId ? () => goToFamily(parentId) : undefined;
  const generation = model.generationOf(centerId);

  // Gia đình shortcuts (see ShortcutHelp).
  useHotkeys((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isInDialog(e.target)) return;
    // Let Enter/arrows act on a focused button (e.g. a person card) as usual.
    const onControl = (e.target as HTMLElement | null)?.closest?.('button, a');
    if (e.key === 'ArrowUp' && goUp) {
      goUp();
      return true;
    }
    if (e.key === 'ArrowDown') {
      const first = family.partnerships.flatMap((p) => p.children)[0];
      if (first) goToFamily(first.id);
      return Boolean(first);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const parentUnion = model.index.parentUnionOf(centerId);
      if (!parentUnion) return;
      const sibs = model.index.childrenOf(parentUnion.id);
      const i = sibs.findIndex((s) => s.id === centerId);
      const next = sibs[i + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (next) goToFamily(next.id);
      return Boolean(next);
    }
    if (e.key === 'Enter' && !onControl) {
      open('ct', centerId);
      return true;
    }
  });

  const { father, mother, partnerships, siblings, person } = family;
  const otherNames = person.otherNames
    ? [
        person.otherNames.huy && `Húy ${person.otherNames.huy}`,
        person.otherNames.tu && `Tự ${person.otherNames.tu}`,
        person.otherNames.hieu && `Hiệu ${person.otherNames.hieu}`,
        person.otherNames.thuong && `Thường gọi ${person.otherNames.thuong}`,
      ].filter(Boolean)
    : [];
  const severalSpouses = partnerships.length > 1;

  return (
    <div className={styles.view} ref={top}>
      <Lineage model={model} centerId={centerId} onPick={go} />

      <CenterCard
        key={centerId}
        model={model}
        person={person}
        generation={generation}
        otherNames={otherNames as string[]}
        onOpen={() => open('ct', centerId)}
        onUp={goUp}
      />

      <UpcomingStrip model={model} onPick={(id) => open('ct', id)} />

      <section className={styles.group} aria-labelledby="fam-parents">
        <div className={styles.titleRow}>
          <span className={styles.diamond} aria-hidden="true">◆</span>
          <h2 id="fam-parents" className={styles.groupTitle}>
            Cha mẹ
          </h2>
          <span className={styles.diamond} aria-hidden="true">◆</span>
        </div>
        {father || mother ? (
          <div className={styles.pair}>
            {father && <PersonCard person={father} caption="Cha" onClick={() => go(father)} />}
            {mother && <PersonCard person={mother} caption="Mẹ" onClick={() => go(mother)} />}
          </div>
        ) : (
          <p className={styles.note}>
            {model.founders.some((f) => f.id === centerId)
              ? model.founders.length > 1
                ? 'Đời đầu tiên được ghi trong gia phả; chưa ghi cha mẹ.'
                : 'Thủy tổ, đời đầu tiên được ghi trong gia phả.'
              : person.isBloodline
                ? 'Chưa ghi cha mẹ.'
                : 'Cha mẹ chưa được ghi (dâu, rể của dòng họ).'}
          </p>
        )}
      </section>

      {partnerships.length > 0 && (
        <section className={styles.group} aria-labelledby="fam-spouses">
          <div className={styles.titleRow}>
            <span className={styles.diamond} aria-hidden="true">◆</span>
            <h2 id="fam-spouses" className={styles.groupTitle}>
              {person.gender === 'male' ? 'Vợ' : 'Chồng'}
            </h2>
            <span className={styles.diamond} aria-hidden="true">◆</span>
          </div>
          <div className={styles.pair}>
            {partnerships.map(({ union, partner }) =>
              partner ? (
                <PersonCard
                  key={union.id}
                  person={partner}
                  caption={
                    severalSpouses && person.isBloodline
                      ? spouseRole(partner.gender, union.order, partnerships.length)
                      : undefined
                  }
                  onClick={() => go(partner)}
                />
              ) : (
                <p key={union.id} className={styles.note}>
                  {spouseRole(person.gender === 'male' ? 'female' : 'male', union.order, partnerships.length)}: chưa rõ
                </p>
              ),
            )}
          </div>
        </section>
      )}

      <Children model={model} person={person} partnerships={partnerships} showMaternal={showMaternal} onPick={go} />

      {siblings.length > 0 && (
        <section className={styles.group} aria-labelledby="siblings">
          <div className={styles.titleRow}>
            <span className={styles.diamond} aria-hidden="true">◆</span>
            <h2 id="siblings" className={styles.groupTitle}>
              Anh chị em <span className={styles.count}>{siblings.length}</span>
            </h2>
            <span className={styles.diamond} aria-hidden="true">◆</span>
          </div>
          <div className={styles.grid}>
            {siblings.map((s) => (
              <PersonCard
                key={s.id}
                person={s}
                caption={s.birthOrder ? toRoman(s.birthOrder) : undefined}
                onClick={() => go(s)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** "Ngày giỗ sắp tới": the next three anniversaries in the clan (signature block of the home screen). */
function UpcomingStrip({ model, onPick }: { model: ClanModel; onPick(id: string): void }) {
  const items = useMemo(() => upcomingAnniversaries(model, todaySolar(), 60).slice(0, 3), [model]);
  if (items.length === 0) return null;
  return (
    <section className={styles.group} aria-labelledby="fam-gio">
      <div className={styles.titleRow}>
        <span className={styles.diamond} aria-hidden="true">◆</span>
        <h2 id="fam-gio" className={styles.groupTitle}>
          Ngày giỗ sắp tới
        </h2>
        <span className={styles.diamond} aria-hidden="true">◆</span>
      </div>
      <ul className={styles.gio}>
        {items.map((a) => (
          <li key={a.person.id}>
            <button type="button" className={styles.gioItem} onClick={() => onPick(a.person.id)}>
              <span className={styles.gioWhen}>{a.inDays === 0 ? 'Hôm nay' : `Còn ${a.inDays} ngày`}</span>
              <span className={styles.gioName}>{a.person.fullName}</span>
              <span className={styles.gioDate}>
                {formatSolarShort(a.date)} · {a.lunar.day}/{a.lunar.month} âm lịch
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Lineage({ model, centerId, onPick }: { model: ClanModel; centerId: string; onPick(p: PersonRec): void }) {
  const lineage = model.lineage(centerId);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [centerId]);
  return (
    <nav className={styles.lineage} aria-label="Dòng dõi">
      <ol ref={list}>
        {lineage.map((p, i) => {
          const current = p.id === centerId;
          const gen = model.generationOf(p.id) ?? i + 1;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={styles.crumb}
                aria-current={current ? 'page' : undefined}
                onClick={() => !current && onPick(p)}
                data-role={roleOf(p)}
              >
                <span className={styles.crumbGen}>Đời {gen}</span>
                <span className={styles.crumbName}>{givenName(p.fullName)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface CenterProps {
  model: ClanModel;
  person: PersonRec;
  generation: number | undefined;
  otherNames: string[];
  onOpen(): void;
  onUp?: () => void;
}

/** The person in focus: circular Đời seal, uppercase name, primary/secondary actions, and stats. */
function CenterCard({ model, person, generation, otherNames, onOpen, onUp }: CenterProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const isAdmin = useAdminStore((s) => s.status === 'admin');
  const openAdmin = useAdminUi((s) => s.open);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const years = lifeSpan(person);
  const deceased = person.death?.isDeceased === true;
  const facts = [
    person.branchLabel ?? null,
    !person.isBloodline ? (person.gender === 'female' ? 'Dâu' : 'Rể') : null,
    model.isMaternal(person.id) ? 'Bên ngoại' : null,
  ].filter(Boolean);
  const gio = person.deathAnniversaryLunar;
  const yearsLine = [
    years || (deceased ? null : 'Chưa rõ năm sinh'),
    deceased ? 'đã mất' : null,
    gio ? `giỗ ${gio.day}/${gio.month} âm lịch` : null,
  ].filter(Boolean);

  const fam = model.family(person.id);
  const partners = fam?.partnerships.filter((x) => x.partner) ?? [];
  const children = fam?.partnerships.flatMap((x) => x.children) ?? [];
  const descendants = useMemo(() => countDescendants(model, person.id), [model, person.id]);
  const stats: Array<[number, string]> = [];
  if (partners.length) stats.push([partners.length, person.gender === 'male' ? 'vợ' : 'chồng']);
  if (person.isBloodline) stats.push([children.length, 'con']);
  if (person.isBloodline && descendants > children.length) stats.push([descendants, 'con cháu']);

  return (
    <section
      className={styles.center}
      aria-labelledby="fam-name"
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) start.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        const s = start.current;
        start.current = null;
        if (!t || !s || !onUp) return;
        if (t.clientY - s.y < -60 && Math.abs(t.clientX - s.x) < 50) onUp();
      }}
    >
      <div className={styles.centerHead}>
        <div className={styles.centerPortrait}>
          {person.photoUrl ? (
            <Avatar person={person} size={112} ring highPriority zoomable />
          ) : generation ? (
            <div className={styles.seal} aria-hidden="true">
              <span className={styles.sealLabel}>Đời</span>
              <span className={styles.sealNum}>{generation}</span>
            </div>
          ) : (
            <Avatar person={person} size={88} ring />
          )}
          {isAdmin && (
            <PhotoButton
              model={model}
              person={person}
              onSuccess={() => setPhotoError(null)}
              onError={setPhotoError}
            />
          )}
        </div>
        <div className={styles.centerTitle}>
          {facts.length > 0 && <p className={styles.facts}>{facts.join(' · ')}</p>}
          <h1 id="fam-name" className={styles.centerName}>
            {person.fullName}
          </h1>
          {otherNames.length > 0 && <p className={styles.otherNames}>{otherNames.join(' · ')}</p>}
          {yearsLine.length > 0 && <p className={styles.years}>{yearsLine.join(' · ')}</p>}
        </div>
      </div>
      {photoError && (
        <p className={styles.photoError} role="alert">
          {photoError}
        </p>
      )}
      <div className={styles.centerActions}>
        <button type="button" className={styles.primary} onClick={onOpen}>
          <NoteIcon width={18} height={18} /> Xem chi tiết
        </button>
        {onUp && (
          <button type="button" className={styles.secondary} onClick={onUp}>
            <UpIcon width={18} height={18} /> Lên đời trước
          </button>
        )}
        <button
          type="button"
          className={styles.secondary}
          onClick={() => navigate(`/so-do?f=${encodeURIComponent(person.id)}`)}
        >
          <TreeIcon width={18} height={18} /> Trên sơ đồ
        </button>
        {isAdmin && (
          <button type="button" className={styles.secondary} onClick={() => openAdmin('menu', person.id)}>
            Thao tác (Admin)
          </button>
        )}
      </div>
      {stats.length > 0 && (
        <ul className={styles.stats} aria-label="Thống kê gia đình">
          {stats.map(([n, label]) => (
            <li key={label}>
              <span>
                <strong>{n}</strong> {label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ChildrenProps {
  model: ClanModel;
  person: PersonRec;
  partnerships: Partnership[];
  showMaternal: boolean;
  onPick(p: PersonRec): void;
}

function Children({ model, person, partnerships, showMaternal, onPick }: ChildrenProps) {
  const setShowMaternal = usePrefsStore((s) => s.setShowMaternal);
  const groups = partnerships.filter((p) => p.children.length > 0);
  if (groups.length === 0) {
    return (
      <section className={styles.group} aria-labelledby="fam-kids">
        <div className={styles.titleRow}>
          <span className={styles.diamond} aria-hidden="true">◆</span>
          <h2 id="fam-kids" className={styles.groupTitle}>
            Các con
          </h2>
          <span className={styles.diamond} aria-hidden="true">◆</span>
        </div>
        <p className={styles.note}>Chưa ghi nhận con.</p>
      </section>
    );
  }
  const several = groups.length > 1;
  return (
    <>
      {groups.map(({ union, partner, children }) => {
        const hidden = !showMaternal && children.every((c) => model.isMaternal(c.id));
        const title = several
          ? childrenGroupLabel(partner?.gender ?? (person.gender === 'male' ? 'female' : 'male'), union.order)
          : 'Các con';
        const headingId = `children-${union.id}`;
        return (
          <section key={union.id} className={styles.group} aria-labelledby={headingId}>
            <div className={styles.titleRow}>
              <span className={styles.diamond} aria-hidden="true">◆</span>
              <h2 id={headingId} className={styles.groupTitle}>
                {title} <span className={styles.count}>{children.length}</span>
                {several && partner && <span className={styles.groupSub}>{partner.fullName}</span>}
              </h2>
              <span className={styles.diamond} aria-hidden="true">◆</span>
            </div>
            {hidden ? (
              <p className={styles.note}>
                {children.length} con bên ngoại đang ẩn.{' '}
                <button type="button" className={styles.linkButton} onClick={() => setShowMaternal(true)}>
                  Hiện con cháu bên ngoại
                </button>
              </p>
            ) : (
              <div className={styles.grid}>
                {children.map((c) => {
                  const kids = model.index.unionsOf(c.id).reduce((n, u) => n + model.index.childrenOf(u.id).length, 0);
                  return (
                    <PersonCard
                      key={c.id}
                      person={c}
                      caption={c.birthOrder ? toRoman(c.birthOrder) : undefined}
                      extra={kids > 0 ? `${kids} con` : undefined}
                      onClick={() => onPick(c)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
