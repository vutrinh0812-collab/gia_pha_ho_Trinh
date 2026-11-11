import { useMemo, useState } from 'react';
import { Sheet } from '@/app/ui/Sheet';
import type { ClanModel } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import { useAdminUi } from '@/store/adminUiStore';
import styles from './AdminForms.module.css';

/**
 * "Thêm đời" — extend the tree upward (a common ancestor above generation 1)
 * or downward (a child for anyone, which opens the next generation).
 */
export function GenerationsSheet({ model }: { model: ClanModel }) {
  const { open, close } = useAdminUi();
  const max = model.gens.maxGeneration;
  const byGen = useMemo(() => {
    const groups = new Map<number, ReturnType<ClanModel['get']>[]>();
    for (const p of model.persons) {
      if (!p.isBloodline) continue;
      const g = model.generationOf(p.id) ?? 0;
      groups.set(g, [...(groups.get(g) ?? []), p]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [model]);
  const [parentId, setParentId] = useState(() => byGen[0]?.[1][0]?.id ?? '');
  const parentGen = model.generationOf(parentId);
  const founders = model.founders;

  return (
    <Sheet label="Thêm đời" onClose={close} header={<h2 className={styles.title}>Thêm đời</h2>}>
      <div className={styles.form}>
        <section className={styles.genSection} aria-labelledby="gen-up">
          <h3 id="gen-up" className={styles.genTitle}>
            Thêm đời phía trên
          </h3>
          <p className={styles.note}>
            {founders.length > 1
              ? `Thêm một tổ tiên làm cha chung của ${founders.length} gia đình đang ở Đời 1. Mọi người lùi xuống một đời; người mới là Đời 1.`
              : `Thêm cha của ${founders[0]?.fullName ?? 'thủy tổ'}. Mọi người lùi xuống một đời; người mới là thủy tổ (Đời 1).`}
          </p>
          <button type="button" className={styles.primary} onClick={() => open('addFather', model.rootId)}>
            Thêm tổ tiên ở đời trên
          </button>
        </section>

        <section className={styles.genSection} aria-labelledby="gen-down">
          <h3 id="gen-down" className={styles.genTitle}>
            Thêm đời phía dưới
          </h3>
          <p className={styles.note}>
            Chọn cha hoặc mẹ rồi thêm con. Hiện có {max} đời; thêm con cho người ở Đời {max} sẽ mở Đời {max + 1}.
          </p>
          <div className={styles.field}>
            <label htmlFor="gen-parent">Thêm con cho</label>
            <select id="gen-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              {byGen.map(([gen, people]) => (
                <optgroup key={gen} label={`Đời ${gen}`}>
                  {people.map((p) => (
                    <option key={p!.id} value={p!.id}>
                      {p!.fullName}
                      {lifeSpan(p!) ? ` (${lifeSpan(p!)})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="button" className={styles.primary} disabled={!parentId} onClick={() => open('addChild', parentId)}>
            {parentGen ? `Thêm con (Đời ${parentGen + 1})` : 'Thêm con'}
          </button>
        </section>

        <p className={styles.note}>
          Muốn sửa một người: chạm vào người đó trên sơ đồ, mở chi tiết, rồi bấm “Chỉnh sửa hồ sơ”.
        </p>
      </div>
    </Sheet>
  );
}
