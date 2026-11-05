import type { CSSProperties } from 'react';
import { CloseIcon } from '@/app/ui/icons';
import styles from './GenRangeSlider.module.css';

interface Props {
  /** Number of generations in the clan. */
  max: number;
  /** Shown range, 1…max. */
  from: number;
  to: number;
  onChange(from: number, to: number): void;
}

/**
 * The only filter of "Sơ đồ" (DECISIONS D56): which generations to show, on one
 * compact header row — the range as text, then a slider with two thumbs. Two native
 * range inputs share one track, so touch, mouse, keyboard and screen readers work.
 */
export function GenRangeSlider({ max, from, to, onChange }: Props) {
  if (max < 2) return null;
  const pct = (g: number) => ((g - 1) / (max - 1)) * 100;
  const all = from === 1 && to === max;
  const summary = all ? `Đời 1–${max}` : from === to ? `Đời ${from}` : `Đời ${from}–${to}`;
  const fill = { '--lo': `${pct(from)}%`, '--hi': `${pct(to)}%` } as CSSProperties;

  return (
    <div className={styles.wrap} role="group" aria-label="Hiển thị theo đời" data-filtered={all ? undefined : ''}>
      <span className={styles.summary} aria-live="polite">
        {summary}
      </span>
      <div className={styles.slider} style={fill}>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.range} />
        </div>
        <input
          type="range"
          min={1}
          max={max}
          step={1}
          value={from}
          aria-label="Từ đời"
          aria-valuetext={`Từ đời ${from}`}
          onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        />
        <input
          type="range"
          min={1}
          max={max}
          step={1}
          value={to}
          aria-label="Đến đời"
          aria-valuetext={`Đến đời ${to}`}
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        />
      </div>
      {!all && (
        <button type="button" className={styles.reset} onClick={() => onChange(1, max)} aria-label="Hiện tất cả các đời">
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </div>
  );
}
