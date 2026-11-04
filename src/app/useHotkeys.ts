import { useEffect, useRef } from 'react';

/** True while the user is typing in a field: single-key shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** True when focus is inside an open dialog (sheet, search…): page shortcuts step aside. */
export function isInDialog(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest?.('[role="dialog"]'));
}

/**
 * Keyboard shortcuts (SPEC 12 phase 3c). The handler returns true when it used
 * the key, which then gets preventDefault(). Typing in fields is ignored.
 */
export function useHotkeys(handler: (e: KeyboardEvent) => boolean | void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      if (ref.current(e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
