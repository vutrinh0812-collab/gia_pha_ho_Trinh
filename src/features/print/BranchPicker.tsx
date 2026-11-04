import type { ClanModel } from '@/lib/clanModel';
import { branchOptions } from './usePrintScope';
import styles from './Print.module.css';

interface Props {
  model: ClanModel;
  focusId: string | null;
  onChange(id: string | null): void;
}

/** Whole tree, or one person's branch: their line from the root plus all their descendants. */
export function BranchPicker({ model, focusId, onChange }: Props) {
  const options = branchOptions(model);
  const byGen = new Map<number, typeof options>();
  for (const o of options) byGen.set(o.gen, [...(byGen.get(o.gen) ?? []), o]);
  return (
    <div className={styles.field}>
      <label htmlFor="print-scope">Phạm vi in</label>
      <select id="print-scope" value={focusId ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Toàn bộ dòng họ</option>
        {[...byGen.entries()].map(([gen, list]) => (
          <optgroup key={gen} label={`Theo chi, đời ${gen}`}>
            {list.map((o) => (
              <option key={o.person.id} value={o.person.id}>
                {o.person.fullName}
                {o.person.branchLabel ? ` · ${o.person.branchLabel}` : ''} · {o.descendants} con cháu
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className={styles.hint}>
        Theo chi: in từ thủy tổ xuống người được chọn và toàn bộ con cháu của người đó; anh chị em và các nhánh khác chỉ hiện tên, ẩn con cháu.
      </span>
    </div>
  );
}
