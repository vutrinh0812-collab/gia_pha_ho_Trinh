import { useLocation, useNavigate } from 'react-router-dom';
import { useOverlays } from '@/app/useOverlays';
import { LineageIcon } from '@/app/ui/icons';
import { Sheet } from '@/app/ui/Sheet';
import { useClanStore } from '@/store/clanStore';
import { Profile } from './Profile';
import styles from './PersonSheet.module.css';

export { personUrl } from './Profile';

/** Detail sheet for the person in the `ct` query parameter: their profile. */
export function PersonSheet({ id }: { id: string }) {
  const model = useClanStore((s) => s.model);
  const { params, close, showPerson } = useOverlays();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onTree = pathname === '/so-do';
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
        extraActions={
          onTree && (
            <button
              type="button"
              className={styles.lineage}
              onClick={() => {
                // Highlight the line from the root ancestor to this person (SPEC 5.4).
                const next = new URLSearchParams(params);
                next.delete('ct');
                next.set('dd', person.id);
                navigate({ pathname, search: `?${next}` }, { replace: true });
              }}
            >
              <LineageIcon width={18} height={18} /> Dòng dõi
            </button>
          )
        }
      />
    </Sheet>
  );
}
