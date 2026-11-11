import type { ClanModel, PersonRec } from '@/lib/clanModel';
import type { AdminActionKind } from '@/store/adminUiStore';

export interface PersonAction {
  label: string;
  kind: AdminActionKind;
  danger?: boolean;
}

/**
 * What can be done to a person besides editing their own fields: add relatives, reorder
 * siblings, delete. Shown in the action menu and at the end of the edit form (D84).
 */
export function personActions(model: ClanModel, person: PersonRec): PersonAction[] {
  const parentUnion = model.index.parentUnionOf(person.id);
  const siblings = parentUnion ? model.index.childrenOf(parentUnion.id).length : 0;
  const isRoot = model.founders.some((f) => f.id === person.id);
  const canReorder = parentUnion ? siblings > 1 : isRoot && model.founders.length > 1;
  const out: PersonAction[] = [{ label: 'Thêm con', kind: 'addChild' }];
  if (person.isBloodline) out.push({ label: person.gender === 'male' ? 'Thêm vợ' : 'Thêm chồng', kind: 'addSpouse' });
  if (isRoot)
    out.push({
      label: model.founders.length > 1 ? 'Thêm cha chung (đời trên đời 1)' : 'Thêm cha (đời trên thủy tổ)',
      kind: 'addFather',
    });
  if (canReorder)
    out.push({ label: parentUnion ? 'Đổi thứ tự anh chị em' : 'Đổi thứ tự các gia đình đời 1', kind: 'reorder' });
  out.push({ label: 'Xóa', kind: 'delete', danger: true });
  return out;
}
