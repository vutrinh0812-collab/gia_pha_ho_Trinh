import { useLongPress } from '@/app/useLongPress';
import { lifeSpan } from '@/lib/format';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import type { PersonRec } from '@/lib/clanModel';
import styles from './PersonCard.module.css';

export type PersonRole = 'male' | 'female' | 'spouse';

export function roleOf(p: PersonRec): PersonRole {
  if (!p.isBloodline) return 'spouse';
  return p.gender === 'male' ? 'male' : 'female';
}

interface Props {
  person: PersonRec;
  /** Small caption above the name, e.g. "Cha", "Vợ cả", "Con thứ 2". */
  caption?: string;
  /** Extra line under the years, e.g. "3 con". */
  extra?: string;
  size?: 'chip' | 'child' | 'row';
  onClick?: () => void;
}

/** A tappable person: colour stripe by role (nam / nữ / dâu-rể), name, years. */
export function PersonCard({ person, caption, extra, size = 'chip', onClick }: Props) {
  const years = lifeSpan(person);
  const deceased = person.death?.isDeceased === true;
  const isAdmin = useAdminStore((s) => s.status === 'admin');
  const openAdmin = useAdminUi((s) => s.open);
  // Admins press and hold a person for the action menu (SPEC 5A.2).
  const press = useLongPress(isAdmin ? () => openAdmin('menu', person.id) : null);
  return (
    <button type="button" className={styles.card} data-size={size} data-role={roleOf(person)} onClick={onClick} {...press}>
      {caption && <span className={styles.caption}>{caption}</span>}
      <span className={styles.name}>{person.fullName}</span>
      {(years || deceased) && (
        <span className={styles.meta}>
          {years}
          {deceased && <span className={styles.deceased}>{years ? ' · ' : ''}đã mất</span>}
        </span>
      )}
      {extra && <span className={styles.extra}>{extra}</span>}
    </button>
  );
}
