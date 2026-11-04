import { useState } from 'react';
import { useOverlays } from '@/app/useOverlays';
import { Sheet } from '@/app/ui/Sheet';
import { AdminError, deletePerson, reorderChildren, type ChangeSet } from '@/lib/admin/changes';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { lifeSpan } from '@/lib/format';
import { useAdminStore } from '@/store/adminStore';
import { useAdminUi } from '@/store/adminUiStore';
import { useClanStore } from '@/store/clanStore';
import { PersonForm } from './PersonForm';
import styles from './AdminForms.module.css';

/** Admin panels: the action menu, the person form, reordering siblings, deleting. Lazy-loaded. */
export default function AdminLayer() {
  const action = useAdminUi((s) => s.action);
  const close = useAdminUi((s) => s.close);
  const model = useClanStore((s) => s.model);
  if (!action || !model) return null;
  const person = model.get(action.personId);
  if (!person) return null;
  switch (action.kind) {
    case 'menu':
      return <ActionMenu model={model} person={person} />;
    case 'reorder':
      return <ReorderSheet model={model} person={person} onDone={close} />;
    case 'delete':
      return <DeleteSheet model={model} person={person} onDone={close} />;
    default:
      return <PersonForm key={`${action.kind}-${person.id}`} mode={action.kind} model={model} person={person} onDone={close} />;
  }
}

function ActionMenu({ model, person }: { model: ClanModel; person: PersonRec }) {
  const { open, close } = useAdminUi();
  const parentUnion = model.index.parentUnionOf(person.id);
  const siblings = parentUnion ? model.index.childrenOf(parentUnion.id).length : 0;
  const isRoot = model.founders.some((f) => f.id === person.id);
  const items: Array<[string, () => void, boolean?]> = [
    ['Sửa thông tin', () => open('edit', person.id)],
    ['Thêm con', () => open('addChild', person.id)],
    ...(person.isBloodline ? ([[person.gender === 'male' ? 'Thêm vợ' : 'Thêm chồng', () => open('addSpouse', person.id)]] as Array<[string, () => void]>) : []),
    ...(isRoot ? ([[(model.founders.length > 1 ? 'Thêm cha chung (đời trên đời 1)' : 'Thêm cha (đời trên thủy tổ)'), () => open('addFather', person.id)]] as Array<[string, () => void]>) : []),
    ...(siblings > 1 ? ([['Đổi thứ tự anh chị em', () => open('reorder', person.id)]] as Array<[string, () => void]>) : []),
    ['Xóa', () => open('delete', person.id), true],
  ];
  return (
    <Sheet label={`Thao tác với ${person.fullName}`} onClose={close} header={<h2 className={styles.title}>{person.fullName}</h2>}>
      <ul className={styles.menu}>
        {items.map(([label, run, danger]) => (
          <li key={label}>
            <button type="button" className={styles.menuItem} data-danger={danger || undefined} onClick={run}>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function ReorderSheet({ model, person, onDone }: { model: ClanModel; person: PersonRec; onDone(): void }) {
  const union = model.index.parentUnionOf(person.id)!;
  const [ids, setIds] = useState(() => model.index.childrenOf(union.id).map((c) => c.id));
  const [error, setError] = useState<string | null>(null);
  const apply = useAdminStore((s) => s.apply);
  const parent = model.get(union.bloodlinePersonId);
  const move = (i: number, d: -1 | 1) =>
    setIds((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const save = async () => {
    let set: ChangeSet;
    try {
      set = reorderChildren(model, union.id, ids);
    } catch (e) {
      setError(e instanceof AdminError ? e.message : 'Không đổi được thứ tự.');
      return;
    }
    if (await apply(set, 'Đã đổi thứ tự.')) onDone();
  };
  return (
    <Sheet
      label="Đổi thứ tự anh chị em"
      onClose={onDone}
      header={<h2 className={styles.title}>Thứ tự các con của {parent?.fullName}</h2>}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onDone}>
            Hủy
          </button>
          <button type="button" className={styles.primary} onClick={save}>
            Lưu thứ tự
          </button>
        </>
      }
    >
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ol className={styles.order}>
        {ids.map((id, i) => {
          const c = model.get(id)!;
          return (
            <li key={id}>
              <span className={styles.orderN}>{i + 1}</span>
              <span className={styles.orderName}>
                {c.fullName}
                <span className={styles.orderMeta}>{lifeSpan(c)}</span>
              </span>
              <button type="button" className={styles.iconButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa ${c.fullName} lên trước`}>
                ↑
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => move(i, 1)}
                disabled={i === ids.length - 1}
                aria-label={`Đưa ${c.fullName} xuống sau`}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

function DeleteSheet({ model, person, onDone }: { model: ClanModel; person: PersonRec; onDone(): void }) {
  const apply = useAdminStore((s) => s.apply);
  const { params, goToFamily } = useOverlays();
  let set: ChangeSet | null = null;
  let blocked: string | null = null;
  try {
    set = deletePerson(model, person.id);
  } catch (e) {
    blocked = e instanceof AdminError ? e.message : 'Không xóa được.';
  }
  const others = set ? set.changes.filter((c) => c.collection === 'persons' && c.id !== person.id).map((c) => model.get(c.id)?.fullName) : [];
  const confirm = async () => {
    if (!set) return;
    const wasOnScreen = params.get('p') === person.id || params.get('ct') === person.id;
    if (await apply(set, `Đã xóa ${person.fullName}.`)) {
      onDone();
      if (wasOnScreen) {
        const parentId = model.index.parentUnionOf(person.id)?.bloodlinePersonId;
        goToFamily(parentId ?? model.rootId, { replace: true });
      }
    }
  };
  return (
    <Sheet
      label={`Xóa ${person.fullName}`}
      onClose={onDone}
      header={<h2 className={styles.title}>Xóa {person.fullName}?</h2>}
      footer={
        blocked ? (
          <button type="button" className={styles.secondary} onClick={onDone}>
            Đóng
          </button>
        ) : (
          <>
            <button type="button" className={styles.secondary} onClick={onDone}>
              Không xóa
            </button>
            <button type="button" className={styles.danger} onClick={confirm}>
              Xóa
            </button>
          </>
        )
      }
    >
      {blocked ? (
        <p className={styles.error} role="alert">
          {blocked}
        </p>
      ) : (
        <div className={styles.confirm}>
          <p>
            Sẽ xóa <strong>{person.fullName}</strong>
            {others.length > 0 && (
              <>
                {' '}
                cùng {others.length === 1 ? 'người phối ngẫu' : 'các người phối ngẫu'} <strong>{others.join(', ')}</strong>
              </>
            )}{' '}
            khỏi gia phả.
          </p>
          <p className={styles.note}>Có thể hoàn tác trong Quản trị → Lịch sử thay đổi.</p>
        </div>
      )}
    </Sheet>
  );
}
