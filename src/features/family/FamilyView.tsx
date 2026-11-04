import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isInDialog, useHotkeys } from '@/app/useHotkeys';
import { useOverlays } from '@/app/useOverlays';
import { ChevronIcon, TreeIcon, UpIcon } from '@/app/ui/icons';
import type { ClanModel, Partnership, PersonRec } from '@/lib/clanModel';
import { childrenGroupLabel, givenName, lifeSpan, spouseRole } from '@/lib/format';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';
import { PersonCard, roleOf } from '../person/PersonCard';
import styles from './FamilyView.module.css';

/**
 * "Gia đình" — the default mobile view (SPEC 5A.1): one person in the middle,
 * parents above, spouses beside, children below in a horizontal row.
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

  return (
    <div className={styles.view} ref={top}>
      <Lineage model={model} centerId={centerId} onPick={go} />

      <section className={styles.parents} aria-label="Cha mẹ">
        {family.father || family.mother ? (
          <div className={styles.pair}>
            {family.father && <PersonCard person={family.father} caption="Cha" onClick={() => go(family.father!)} />}
            {family.mother && <PersonCard person={family.mother} caption="Mẹ" onClick={() => go(family.mother!)} />}
          </div>
        ) : (
          <p className={styles.note}>
            {centerId === model.rootId
              ? 'Thủy tổ — đời đầu tiên được ghi trong gia phả.'
              : family.person.isBloodline
                ? 'Chưa ghi cha mẹ.'
                : 'Cha mẹ chưa được ghi (dâu/rể của dòng họ).'}
          </p>
        )}
      </section>

      <div className={styles.connector} aria-hidden="true" />

      <CenterCard
        key={centerId}
        model={model}
        person={family.person}
        generation={generation}
        onOpen={() => open('ct', centerId)}
        onSwipeUp={goUp}
      />

      {family.partnerships.length > 0 && (
        <section className={styles.spouses} aria-label="Vợ chồng">
          {family.partnerships.map(({ union, partner }) =>
            partner ? (
              <PersonCard
                key={union.id}
                person={partner}
                caption={
                  family.person.isBloodline
                    ? spouseRole(partner.gender, union.order, family.partnerships.length)
                    : partner.gender === 'male'
                      ? 'Chồng'
                      : 'Vợ'
                }
                onClick={() => go(partner)}
              />
            ) : (
              <p key={union.id} className={styles.note}>
                {spouseRole(family.person.gender === 'male' ? 'female' : 'male', union.order, family.partnerships.length)}: chưa rõ
              </p>
            ),
          )}
        </section>
      )}

      <Children model={model} person={family.person} partnerships={family.partnerships} showMaternal={showMaternal} onPick={go} />

      {family.siblings.length > 0 && (
        <section className={styles.group} aria-labelledby="siblings">
          <h2 id="siblings" className={styles.groupTitle}>
            Anh chị em ({family.siblings.length})
          </h2>
          <div className={styles.row}>
            {family.siblings.map((s) => (
              <PersonCard
                key={s.id}
                person={s}
                size="child"
                caption={s.birthOrder ? `Con thứ ${s.birthOrder}` : undefined}
                onClick={() => go(s)}
              />
            ))}
          </div>
        </section>
      )}

      {goUp && (
        <button type="button" className={styles.upButton} onClick={goUp}>
          <UpIcon /> Lên đời trước{generation ? ` (Đời ${generation - 1})` : ''}
        </button>
      )}
    </div>
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
  onOpen(): void;
  onSwipeUp?: () => void;
}

function CenterCard({ model, person, generation, onOpen, onSwipeUp }: CenterProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const years = lifeSpan(person);
  const deceased = person.death?.isDeceased === true;
  const facts = [
    generation ? `Đời ${generation}` : null,
    person.branchLabel ?? null,
    !person.isBloodline ? (person.gender === 'female' ? 'Dâu' : 'Rể') : null,
    model.isMaternal(person.id) ? 'Bên ngoại' : null,
  ].filter(Boolean);
  const otherNames = person.otherNames
    ? [
        person.otherNames.huy && `Húy ${person.otherNames.huy}`,
        person.otherNames.tu && `Tự ${person.otherNames.tu}`,
        person.otherNames.hieu && `Hiệu ${person.otherNames.hieu}`,
        person.otherNames.thuong && `Thường gọi ${person.otherNames.thuong}`,
      ].filter(Boolean)
    : [];

  return (
    <section
      className={styles.center}
      data-role={roleOf(person)}
      aria-label={`Đang xem: ${person.fullName}`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) start.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        const s = start.current;
        start.current = null;
        if (!t || !s || !onSwipeUp) return;
        const dy = t.clientY - s.y;
        if (dy < -60 && Math.abs(t.clientX - s.x) < 50) onSwipeUp();
      }}
    >
      <p className={styles.facts}>{facts.join(' · ')}</p>
      <h1 className={styles.centerName}>{person.fullName}</h1>
      {otherNames.length > 0 && <p className={styles.otherNames}>{otherNames.join(' · ')}</p>}
      {(years || deceased) && (
        <p className={styles.years}>
          {years}
          {deceased && <span className={styles.deceased}>{years ? ' · ' : ''}đã mất</span>}
        </p>
      )}
      <div className={styles.centerActions}>
        <button type="button" className={styles.detailButton} onClick={onOpen}>
          Xem chi tiết <ChevronIcon width={18} height={18} />
        </button>
        <button
          type="button"
          className={styles.treeButton}
          onClick={() => navigate(`/so-do?f=${encodeURIComponent(person.id)}`)}
        >
          <TreeIcon width={18} height={18} /> Trên sơ đồ
        </button>
      </div>
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
      <section className={styles.group} aria-label="Các con">
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
          ? `${childrenGroupLabel(partner?.gender ?? (person.gender === 'male' ? 'female' : 'male'), union.order)}${partner ? ` · ${partner.fullName}` : ''}`
          : 'Các con';
        const headingId = `children-${union.id}`;
        return (
          <section key={union.id} className={styles.group} aria-labelledby={headingId}>
            <h2 id={headingId} className={styles.groupTitle}>
              {title} ({children.length})
            </h2>
            {hidden ? (
              <p className={styles.note}>
                {children.length} con bên ngoại đang ẩn.{' '}
                <button type="button" className={styles.linkButton} onClick={() => setShowMaternal(true)}>
                  Hiện con cháu bên ngoại
                </button>
              </p>
            ) : (
              <div className={styles.row}>
                {children.map((c) => {
                  const kids = model.index.unionsOf(c.id).reduce((n, u) => n + model.index.childrenOf(u.id).length, 0);
                  return (
                    <PersonCard
                      key={c.id}
                      person={c}
                      size="child"
                      caption={c.birthOrder ? `Con thứ ${c.birthOrder}` : undefined}
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
