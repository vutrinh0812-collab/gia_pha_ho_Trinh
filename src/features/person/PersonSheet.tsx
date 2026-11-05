import { useOverlays } from '@/app/useOverlays';
import { Sheet } from '@/app/ui/Sheet';
import { useClanStore } from '@/store/clanStore';
import { Profile } from './Profile';
import styles from './PersonSheet.module.css';

export { personUrl } from './Profile';

/** Detail sheet for the person in the `ct` query parameter: their profile. */
export function PersonSheet({ id }: { id: string }) {
  const model = useClanStore((s) => s.model);
  const { close, showPerson } = useOverlays();
  const person = model?.get(id);

  if (!model || !person) {
    return (
      <Sheet label="Không tìm thấy" initialSnap="full" onClose={() => close('ct')}>
        <p>Không tìm thấy người này trong gia phả. Có thể dữ liệu đã thay đổi.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      key={person.id}
      label={`Thông tin ${person.fullName}`}
      initialSnap="full"
      onClose={() => close('ct')}
      header={<p className={styles.sheetTitle}>Hồ sơ</p>}
    >
      <Profile
        model={model}
        person={person}
        variant="sheet"
        onPick={(p) => showPerson(p.id)}
      />
    </Sheet>
  );
}
