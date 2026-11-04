import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsDesktop } from '../useMediaQuery';
import { CloseIcon } from './icons';
import styles from './Sheet.module.css';

interface SheetProps {
  /** Accessible name of the dialog. */
  label: string;
  onClose(): void;
  children: ReactNode;
  /** Opening height on phones: half screen or (almost) full screen. */
  initialSnap?: 'half' | 'full';
  header?: ReactNode;
  footer?: ReactNode;
}

const CLOSE_DRAG = 90;
const EXPAND_DRAG = -60;

/**
 * Phones: bottom sheet (SPEC 5A.1) — drag the handle up for full screen, down to close.
 * Desktop: a right-hand side panel (SPEC 5.4) that leaves the page usable beside it.
 * Esc closes both; focus moves into the panel and back on close.
 */
export function Sheet({ label, onClose, children, initialSnap = 'half', header, footer }: SheetProps) {
  const desktop = useIsDesktop();
  const [snap, setSnap] = useState(initialSnap);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  // Phones only: the page behind a modal sheet must not scroll.
  useEffect(() => {
    if (desktop) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [desktop]);

  const closeButton = (
    <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng">
      <CloseIcon />
    </button>
  );

  if (desktop) {
    return (
      <div
        ref={panel}
        className={styles.side}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        tabIndex={-1}
      >
        <div className={styles.sideHeader}>
          <div className={styles.header}>{header}</div>
          {closeButton}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // Taps on buttons in the header (e.g. "Đóng") must stay clicks, not drags:
    // pointer capture would retarget their click to the handle.
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    setDrag(snap === 'full' ? Math.max(0, dy) : dy);
  };
  const onPointerUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (drag > CLOSE_DRAG) {
      if (snap === 'full') setSnap('half');
      else onClose();
    } else if (drag < EXPAND_DRAG) {
      setSnap('full');
    }
    setDrag(0);
  };

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.panel}
        data-snap={snap}
        data-dragging={drag !== 0 || undefined}
        style={drag ? { transform: `translateY(${Math.max(drag, -80)}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div
          className={styles.grab}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setSnap((s) => (s === 'full' ? 'half' : 'full'))}
        >
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.headerRow}>
            <div className={styles.header}>{header}</div>
            {closeButton}
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
