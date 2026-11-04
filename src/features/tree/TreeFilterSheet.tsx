import { Sheet } from '@/app/ui/Sheet';
import type { ClanModel } from '@/lib/clanModel';
import styles from './Tree.module.css';

interface Props {
  model: ClanModel;
  branch: string | null;
  fromGen: number | null;
  toGen: number | null;
  showSpouses: boolean;
  showMaternal: boolean;
  onChange(patch: Record<string, string | null>): void;
  onMaternal(on: boolean): void;
  onReset(): void;
  onClose(): void;
}

/** Tree filters (SPEC 5.4): branch, generation range, spouses, maternal line. */
export function TreeFilterSheet(props: Props) {
  const { model, branch, fromGen, toGen, showSpouses, showMaternal, onChange, onMaternal, onReset, onClose } = props;
  const branches = [...new Set(model.persons.map((p) => p.branchLabel).filter((b): b is string => Boolean(b)))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
  const gens = Array.from({ length: model.gens.maxGeneration }, (_, i) => i + 1);

  return (
    <Sheet label="Lọc sơ đồ" onClose={onClose} header={<h2 className={styles.sheetTitle}>Lọc sơ đồ</h2>}>
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="filter-branch">Chi</label>
          <select id="filter-branch" value={branch ?? ''} onChange={(e) => onChange({ chi: e.target.value || null })}>
            <option value="">Tất cả các chi</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="filter-from">Từ đời</label>
            <select
              id="filter-from"
              value={fromGen ?? ''}
              onChange={(e) => onChange({ tu: e.target.value || null })}
            >
              <option value="">Đời 1</option>
              {gens.slice(1).map((g) => (
                <option key={g} value={g} disabled={toGen !== null && g > toGen}>
                  Đời {g}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="filter-to">Đến đời</label>
            <select id="filter-to" value={toGen ?? ''} onChange={(e) => onChange({ den: e.target.value || null })}>
              <option value="">Đời {model.gens.maxGeneration}</option>
              {gens.slice(0, -1).map((g) => (
                <option key={g} value={g} disabled={fromGen !== null && g < fromGen}>
                  Đời {g}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className={styles.switchRow} htmlFor="filter-spouses">
          <span>Hiện dâu, rể</span>
          <input
            id="filter-spouses"
            type="checkbox"
            role="switch"
            checked={showSpouses}
            onChange={(e) => onChange({ dr: e.target.checked ? null : '0' })}
          />
        </label>
        <label className={styles.switchRow} htmlFor="filter-maternal">
          <span>Hiện con cháu bên ngoại</span>
          <input
            id="filter-maternal"
            type="checkbox"
            role="switch"
            checked={showMaternal}
            onChange={(e) => onMaternal(e.target.checked)}
          />
        </label>
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} onClick={onReset}>
            Bỏ lọc
          </button>
          <button type="button" className={styles.primary} onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </Sheet>
  );
}
