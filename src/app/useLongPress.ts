import { useRef } from 'react';

/**
 * Press and hold (SPEC 5A.2: admins long-press a person for the action menu).
 * Pass null to disable; the returned handlers are then inert, so hooks stay stable.
 * A long press swallows the click that follows it.
 */
export function useLongPress(onLong: (() => void) | null, ms = 550) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown(e: React.PointerEvent) {
      if (!onLong || e.button > 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        onLong();
      }, ms);
    },
    onPointerMove(e: React.PointerEvent) {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture(e: React.MouseEvent) {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
    onContextMenu(e: React.MouseEvent) {
      if (onLong) e.preventDefault();
    },
  };
}
