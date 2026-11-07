import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/app/ui/icons';
import type { PersonRec } from '@/lib/clanModel';
import { roleOf } from './PersonCard';
import styles from './Avatar.module.css';

interface Props {
  person: PersonRec;
  /** Diameter in px. */
  size: number;
  /** Thick ring, used on the profile header and hero portrait. */
  ring?: boolean;
  /** Eagerly load hero portraits at full sharpness. */
  highPriority?: boolean;
  /** Allow tapping the avatar to view the photo full-screen when `person.photoUrl` exists. */
  zoomable?: boolean;
}

/** The usual grey "no photo" silhouette (head and shoulders), as on social networks. */
function Silhouette() {
  return (
    <svg className={styles.silhouette} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="15.5" r="7.5" />
      <path d="M5.5 40c0-8.6 6.5-14.5 14.5-14.5S34.5 31.4 34.5 40z" />
    </svg>
  );
}

/** Round portrait: the photo when there is one, otherwise a grey person silhouette (D60). */
export function Avatar({ person, size, ring, highPriority, zoomable }: Props) {
  const deceased = person.death?.isDeceased === true;
  const [openLightbox, setOpenLightbox] = useState(false);

  useEffect(() => {
    if (!openLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenLightbox(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openLightbox]);

  const canZoom = Boolean(zoomable && person.photoUrl);

  const avatarEl = (
    <span
      className={styles.avatar}
      data-role={roleOf(person)}
      data-deceased={deceased || undefined}
      data-ring={ring || undefined}
      data-empty={person.photoUrl ? undefined : ''}
      data-zoomable={canZoom || undefined}
      style={{ width: size, height: size }}
      aria-hidden={canZoom ? undefined : 'true'}
      role={canZoom ? 'button' : undefined}
      tabIndex={canZoom ? 0 : undefined}
      aria-label={canZoom ? `Xem ảnh lớn của ${person.fullName}` : undefined}
      title={canZoom ? 'Nhấn để xem ảnh lớn' : undefined}
      onClick={
        canZoom
          ? (e) => {
              e.stopPropagation();
              setOpenLightbox(true);
            }
          : undefined
      }
      onKeyDown={
        canZoom
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setOpenLightbox(true);
              }
            }
          : undefined
      }
    >
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt=""
          loading={highPriority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <Silhouette />
      )}
    </span>
  );

  return (
    <>
      {avatarEl}
      {openLightbox &&
        person.photoUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.lightboxBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh của ${person.fullName}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenLightbox(false);
            }}
          >
            <button
              type="button"
              className={styles.lightboxClose}
              aria-label="Đóng ảnh"
              onClick={() => setOpenLightbox(false)}
            >
              <CloseIcon width={24} height={24} />
            </button>
            <figure className={styles.lightboxFigure} onClick={(e) => e.stopPropagation()}>
              <img
                src={person.photoUrl}
                alt={person.fullName}
                className={styles.lightboxImg}
                data-deceased={deceased || undefined}
              />
              <figcaption className={styles.lightboxCaption}>{person.fullName}</figcaption>
            </figure>
          </div>,
          document.body,
        )}
    </>
  );
}
