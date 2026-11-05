import { useEffect, useMemo, useRef, useState } from 'react';
import { useOverlays } from '@/app/useOverlays';
import { BackIcon } from '@/app/ui/icons';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import { search } from '@/lib/search';
import { useClanStore } from '@/store/clanStore';
import { roleOf } from '../person/PersonCard';
import styles from './SearchOverlay.module.css';

/** Who this person is, to tell namesakes apart: "Đời 4 · con ông Trịnh Văn A · Chi Giáp". */
export function describe(model: ClanModel, p: PersonRec): string {
  const parts: string[] = [];
  const gen = model.generationOf(p.id);
  if (gen) parts.push(`Đời ${gen}`);
  const parent = model.bloodlineParent(p.id);
  if (parent) parts.push(`con ${parent.gender === 'male' ? 'ông' : 'bà'} ${parent.fullName}`);
  else if (!p.isBloodline) {
    const partner = model.get(model.index.spouseUnionsOf(p.id)[0]?.bloodlinePersonId);
    if (partner) parts.push(`${p.gender === 'female' ? 'vợ ông' : 'chồng bà'} ${partner.fullName}`);
  }
  if (p.branchLabel) parts.push(p.branchLabel);
  return parts.join(' · ');
}

/** Full-screen search (SPEC 5A.2): type without diacritics, results show generation and parent. */
export function SearchOverlay() {
  const model = useClanStore((s) => s.model);
  const { close, goToPerson } = useOverlays();
  /** A result opens that person's branch on "Sơ đồ" and goes to them. */
  const pick = (id: string) => goToPerson(id, { replace: true });
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close('tk');
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  const results = useMemo(() => {
    if (!model) return [];
    return search(model.searchIndex(), query, 60)
      .map((h) => model.get(h.id))
      .filter((p): p is PersonRec => Boolean(p));
  }, [model, query]);

  return (
    <>
    <div className={styles.scrim} onClick={() => close('tk')} aria-hidden="true" />
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Tìm kiếm">
      <form className={styles.bar} role="search" onSubmit={(e) => {
        e.preventDefault();
        const first = results[0];
        if (first) pick(first.id);
      }}>
        <button type="button" className={styles.back} onClick={() => close('tk')} aria-label="Đóng tìm kiếm">
          <BackIcon />
        </button>
        <label htmlFor="search-input" className="visually-hidden">
          Tìm theo tên
        </label>
        <input
          id="search-input"
          ref={input}
          className={styles.input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Gõ tên, không cần dấu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className={styles.results} aria-live="polite">
        {!query.trim() ? (
          <p className={styles.hint}>
            Gõ họ tên hoặc tên gọi, có dấu hay không dấu đều được. Ví dụ: <em>trinh van</em> hoặc chỉ tên <em>an</em>.
          </p>
        ) : results.length === 0 ? (
          <p className={styles.hint}>Không tìm thấy ai tên “{query.trim()}”.</p>
        ) : (
          <>
            <p className={styles.count}>{results.length >= 60 ? 'Hơn 60' : results.length} kết quả</p>
            <ul className={styles.list}>
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.item}
                    data-role={roleOf(p)}
                    onClick={() => pick(p.id)}
                  >
                    <span className={styles.name}>{p.fullName}</span>
                    <span className={styles.meta}>{[describe(model!, p), lifeSpan(p)].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
    </>
  );
}
