import { useEffect, useLayoutEffect, useRef } from 'react';
import styles from './AdminForms.module.css';

/** Height of one row of the wheel, in px (kept in step with `.wheelItem` in the CSS). */
const ITEM = 40;

export interface WheelOption {
  value: string;
  label: string;
}

/**
 * One column of the date wheel (D93): a list that scrolls and snaps, the row in the middle
 * band being the value. Also a spin button for the keyboard and screen readers: arrows,
 * Page Up/Down (10 at a time), Home/End, or type the number.
 */
export function WheelColumn({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: WheelOption[];
  value: string;
  onChange(next: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  /** Set while the list is scrolled by code, so that scroll is not read back as a choice. */
  const settling = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const typed = useRef({ text: '', at: 0 });

  // Keep the chosen row in the middle band when the value changes from outside.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || Math.round(el.scrollTop / ITEM) === index) return;
    settling.current = true;
    el.scrollTop = index * ITEM;
    window.setTimeout(() => (settling.current = false), 150);
  }, [index]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (i: number) => {
    const next = options[Math.min(options.length - 1, Math.max(0, i))];
    if (next && next.value !== value) onChange(next.value);
  };

  const onScroll = () => {
    if (settling.current) return;
    window.clearTimeout(timer.current);
    // Read the row once the scroll (and its snap) has come to rest.
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (el) pick(Math.round(el.scrollTop / ITEM));
    }, 120);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    if (e.key in step) {
      e.preventDefault();
      pick(index + step[e.key]!);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      pick(e.key === 'Home' ? 0 : options.length - 1);
    } else if (/^\d$/.test(e.key)) {
      // Typing a number goes to it ("2", "0", "2", "4" → 2024), within a second per digit.
      const now = Date.now();
      const text = (now - typed.current.at < 1000 ? typed.current.text : '') + e.key;
      typed.current = { text, at: now };
      const hit = options.findIndex((o) => o.value === String(Number(text)));
      if (hit >= 0) pick(hit);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      pick(0);
    }
  };

  const current = options[index];
  return (
    <div className={styles.wheelColumn}>
      <span className={styles.wheelLabel} aria-hidden="true">
        {label}
      </span>
      <div
        id={id}
        ref={ref}
        className={styles.wheelList}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={options.length - 1}
        aria-valuetext={current && current.value ? current.label : 'chưa chọn'}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        {options.map((o, i) => (
          <div
            key={o.value || 'none'}
            className={styles.wheelItem}
            data-selected={i === index || undefined}
            data-empty={!o.value || undefined}
            onClick={() => pick(i)}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}
