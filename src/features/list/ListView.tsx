import { useMemo, useState } from 'react';
import { useOverlays } from '@/app/useOverlays';
import { ChevronIcon } from '@/app/ui/icons';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';
import { roleOf } from '../person/PersonCard';
import styles from './ListView.module.css';

const NO_BRANCH = 'Chưa chia chi';

interface Row {
  person: PersonRec;
  spouses: PersonRec[];
}

interface GenerationGroup {
  generation: number;
  count: number;
  branches: Array<{ label: string; rows: Row[] }>;
}

/** Groups bloodline members by generation, then by branch (spouses listed with their partner). */
function groupByGeneration(model: ClanModel, showMaternal: boolean): GenerationGroup[] {
  const byGen = new Map<number, Map<string, Row[]>>();
  for (const p of model.persons) {
    if (!p.isBloodline) continue;
    if (!showMaternal && model.isMaternal(p.id)) continue;
    const gen = model.generationOf(p.id);
    if (!gen) continue;
    const spouses = model.index
      .unionsOf(p.id)
      .map((u) => model.get(u.spousePersonId))
      .filter((s): s is PersonRec => Boolean(s));
    const label = p.branchLabel ?? NO_BRANCH;
    const branches = byGen.get(gen) ?? new Map<string, Row[]>();
    byGen.set(gen, branches);
    const rows = branches.get(label) ?? [];
    branches.set(label, rows);
    rows.push({ person: p, spouses });
  }
  return [...byGen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, branches]) => ({
      generation,
      count: [...branches.values()].reduce((n, r) => n + r.length, 0),
      branches: [...branches.entries()]
        .sort(([a], [b]) => (a === NO_BRANCH ? -1 : b === NO_BRANCH ? 1 : a.localeCompare(b, 'vi')))
        .map(([label, rows]) => ({ label, rows })),
    }));
}

/**
 * "Danh sách" — people by generation (SPEC 5A.1 mode 3). Suits older readers
 * and very small screens. Only opened generations are rendered.
 */
export function ListView() {
  const model = useClanStore((s) => s.model)!;
  const showMaternal = usePrefsStore((s) => s.showMaternal) ?? model.settings.showMaternalDescendants;
  const groups = useMemo(() => groupByGeneration(model, showMaternal), [model, showMaternal]);
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([1]));
  const { open: openOverlay } = useOverlays();

  const toggle = (gen: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.title}>{model.settings.title}</h1>
        <p className={styles.sub}>
          {groups.length} đời · {groups.reduce((n, g) => n + g.count, 0)} người trong dòng họ
          {!showMaternal && model.gens.maternal.size > 0 ? ' (chưa gồm bên ngoại)' : ''}
        </p>
      </header>
      <ol className={styles.gens}>
        {groups.map((g) => {
          const isOpen = open.has(g.generation);
          const panelId = `gen-${g.generation}`;
          return (
            <li key={g.generation} className={styles.gen}>
              <button
                type="button"
                className={styles.genButton}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(g.generation)}
              >
                <span className={styles.genName}>Đời {g.generation}</span>
                <span className={styles.genCount}>{g.count} người</span>
                <ChevronIcon className={styles.chevron} width={20} height={20} />
              </button>
              {isOpen && (
                <div id={panelId} className={styles.panel}>
                  {g.branches.map((b) => (
                    <section key={b.label} aria-label={b.label}>
                      {(g.branches.length > 1 || b.label !== NO_BRANCH) && <h2 className={styles.branch}>{b.label}</h2>}
                      <ul className={styles.rows}>
                        {b.rows.map(({ person, spouses }) => (
                          <li key={person.id}>
                            <button
                              type="button"
                              className={styles.row}
                              data-role={roleOf(person)}
                              onClick={() => openOverlay('ct', person.id)}
                            >
                              <span className={styles.name}>{person.fullName}</span>
                              <span className={styles.meta}>
                                {[lifeSpan(person), person.death?.isDeceased && !lifeSpan(person) ? 'đã mất' : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              {spouses.length > 0 && (
                                <span className={styles.spouses}>
                                  {person.gender === 'male' ? 'Vợ' : 'Chồng'}: {spouses.map((s) => s.fullName).join(', ')}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
