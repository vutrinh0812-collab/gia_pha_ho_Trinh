import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOverlays } from '@/app/useOverlays';
import { FamilyIcon, LineageIcon, ShareIcon } from '@/app/ui/icons';
import { Sheet } from '@/app/ui/Sheet';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { formatDateInfo, genderLabel, lifeSpan, spouseRole } from '@/lib/format';
import { daysBetween, nextLunarAnniversary, type SolarDate } from '@/lib/lunar';
import { shareLink } from '@/lib/share';
import { useClanStore } from '@/store/clanStore';
import { roleOf } from './PersonCard';
import styles from './PersonSheet.module.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function today(): SolarDate {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Public link to a person, e.g. https://…/person/p0012 */
export function personUrl(id: string): string {
  return `${window.location.origin}/person/${encodeURIComponent(id)}`;
}

/** Detail sheet for the person in the `ct` query parameter. */
export function PersonSheet({ id }: { id: string }) {
  const model = useClanStore((s) => s.model);
  const { params, close, showPerson, goToFamily } = useOverlays();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onTree = pathname === '/so-do';
  const person = model?.get(id);
  const [shareNote, setShareNote] = useState<string | null>(null);

  if (!model || !person) {
    return (
      <Sheet label="Không tìm thấy" onClose={() => close('ct')}>
        <p>Không tìm thấy người này trong gia phả. Có thể dữ liệu đã thay đổi.</p>
      </Sheet>
    );
  }

  const share = async () => {
    const result = await shareLink({
      title: `${person.fullName} — ${model.settings.title}`,
      text: `${person.fullName} trong ${model.settings.title}`,
      url: personUrl(person.id),
    });
    if (result.kind === 'copied') setShareNote('Đã sao chép đường link.');
    else if (result.kind === 'manual') setShareNote(`Sao chép đường link này: ${result.url}`);
  };

  return (
    <Sheet
      key={person.id}
      label={`Thông tin ${person.fullName}`}
      onClose={() => close('ct')}
      header={<SheetHeader model={model} person={person} />}
      footer={
        <>
          <button type="button" className={styles.action} onClick={() => goToFamily(person.id)}>
            <FamilyIcon width={20} height={20} /> Gia đình
          </button>
          {onTree && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                // Highlight the line from the root ancestor to this person (SPEC 5.4).
                const next = new URLSearchParams(params);
                next.delete('ct');
                next.set('dd', person.id);
                navigate({ pathname, search: `?${next}` }, { replace: true });
              }}
            >
              <LineageIcon width={20} height={20} /> Dòng dõi
            </button>
          )}
          <button type="button" className={styles.action} onClick={share}>
            <ShareIcon width={20} height={20} /> Chia sẻ
          </button>
        </>
      }
    >
      {shareNote && (
        <p className={styles.shareNote} role="status">
          {shareNote}
        </p>
      )}
      <Details model={model} person={person} />
      <Relatives model={model} person={person} onPick={(p) => showPerson(p.id)} />
    </Sheet>
  );
}

function SheetHeader({ model, person }: { model: ClanModel; person: PersonRec }) {
  const gen = model.generationOf(person.id);
  const years = lifeSpan(person);
  return (
    <div className={styles.header} data-role={roleOf(person)}>
      <h2 className={styles.name}>{person.fullName}</h2>
      <p className={styles.sub}>
        {[gen ? `Đời ${gen}` : null, person.branchLabel, years].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

function Details({ model, person }: { model: ClanModel; person: PersonRec }) {
  const anniversary = useMemo(() => {
    const a = person.deathAnniversaryLunar;
    if (!a) return null;
    const t = today();
    const next = nextLunarAnniversary(a.day, a.month, t);
    const inDays = daysBetween(t, next);
    const weekday = WEEKDAYS[new Date(next.year, next.month - 1, next.day).getDay()];
    return {
      lunar: `${a.day}/${a.month} âm lịch`,
      next: `${weekday}, ${next.day}/${next.month}/${next.year}${inDays === 0 ? ' (hôm nay)' : ` (còn ${inDays} ngày)`}`,
    };
  }, [person.deathAnniversaryLunar]);

  const parent = model.bloodlineParent(person.id);
  const o = person.otherNames;
  const rows: Array<[string, string | undefined | null]> = [
    ['Tên húy', o?.huy],
    ['Tên tự', o?.tu],
    ['Tên hiệu', o?.hieu],
    ['Tên thường gọi', o?.thuong],
    ['Giới tính', genderLabel(person.gender)],
    ['Quan hệ', person.isBloodline ? (model.isMaternal(person.id) ? 'Con cháu bên ngoại' : 'Huyết thống') : person.gender === 'female' ? 'Dâu' : 'Rể'],
    ['Thứ tự', person.birthOrder && parent ? `Con thứ ${person.birthOrder} của ${parent.fullName}` : null],
    ['Sinh', formatDateInfo(person.birth) || (person.birth ? null : 'Chưa rõ')],
    ['Nơi sinh', person.birth?.place],
    ['Mất', person.death?.isDeceased ? formatDateInfo(person.death) || 'Đã mất, chưa rõ ngày' : null],
    ['Ngày giỗ', anniversary?.lunar],
    ['Giỗ năm nay', anniversary?.next],
    ['Nơi an táng', person.burialPlace],
    ['Nghề nghiệp', person.occupation],
    ['Ghi chú', person.notes],
  ];
  return (
    <dl className={styles.details}>
      {rows
        .filter((r): r is [string, string] => Boolean(r[1]))
        .map(([k, v]) => (
          <div key={k} className={styles.detailRow}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function Relatives({ model, person, onPick }: { model: ClanModel; person: PersonRec; onPick(p: PersonRec): void }) {
  const fam = model.family(person.id);
  if (!fam) return null;
  const items: Array<{ label: string; people: Array<{ p: PersonRec; caption?: string }> }> = [];
  const parents = [fam.father, fam.mother].filter((p): p is PersonRec => Boolean(p));
  if (parents.length) items.push({ label: 'Cha mẹ', people: parents.map((p) => ({ p, caption: p.gender === 'male' ? 'Cha' : 'Mẹ' })) });
  const partners = fam.partnerships.filter((x) => x.partner);
  if (partners.length) {
    items.push({
      label: person.gender === 'male' ? 'Vợ' : 'Chồng',
      people: partners.map(({ partner, union }) => ({
        p: partner!,
        caption: person.isBloodline ? spouseRole(partner!.gender, union.order, fam.partnerships.length) : undefined,
      })),
    });
  }
  const children = fam.partnerships.flatMap((x) => x.children);
  if (children.length) {
    items.push({
      label: `Con (${children.length})`,
      people: children.map((c) => ({ p: c, caption: c.birthOrder ? `Con thứ ${c.birthOrder}` : undefined })),
    });
  }
  if (fam.siblings.length) items.push({ label: `Anh chị em (${fam.siblings.length})`, people: fam.siblings.map((p) => ({ p })) });
  if (!items.length) return null;

  return (
    <div className={styles.relatives}>
      {items.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className={styles.relTitle}>{group.label}</h3>
          <ul className={styles.relList}>
            {group.people.map(({ p, caption }) => (
              <li key={p.id}>
                <button type="button" className={styles.rel} data-role={roleOf(p)} onClick={() => onPick(p)}>
                  <span className={styles.relName}>{p.fullName}</span>
                  <span className={styles.relMeta}>{[caption, lifeSpan(p)].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
