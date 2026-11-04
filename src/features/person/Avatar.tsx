import type { PersonRec } from '@/lib/clanModel';
import { givenName } from '@/lib/format';
import { roleOf } from './PersonCard';
import styles from './Avatar.module.css';

interface Props {
  person: PersonRec;
  /** Diameter in px. */
  size: number;
  /** Thick ring, used on the profile header over the cover. */
  ring?: boolean;
}

/** Round portrait: the photo when there is one, otherwise the first letter of the given name. */
export function Avatar({ person, size, ring }: Props) {
  const deceased = person.death?.isDeceased === true;
  const letter = givenName(person.fullName).charAt(0).toUpperCase();
  return (
    <span
      className={styles.avatar}
      data-role={roleOf(person)}
      data-deceased={deceased || undefined}
      data-ring={ring || undefined}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {person.photoUrl ? <img src={person.photoUrl} alt="" loading="lazy" decoding="async" /> : letter}
    </span>
  );
}
