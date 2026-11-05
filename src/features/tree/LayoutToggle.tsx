import { OutlineIcon, TreeIcon } from '@/app/ui/icons';
import type { TreeLayoutPref } from '@/store/prefsStore';
import styles from './LayoutToggle.module.css';

const OPTIONS: Array<{ value: TreeLayoutPref; label: string; title: string; Icon: typeof TreeIcon }> = [
  { value: 'doc', label: 'Dọc', title: 'Cây dọc: cuộn lên xuống, hợp với điện thoại', Icon: OutlineIcon },
  { value: 'ngang', label: 'Ngang', title: 'Sơ đồ ngang: kéo và phóng to như bản đồ', Icon: TreeIcon },
];

/** One two-way switch between the two layouts of "Sơ đồ" (DECISIONS D55). */
export function LayoutToggle({ value, onChange }: { value: TreeLayoutPref; onChange(next: TreeLayoutPref): void }) {
  return (
    <div className={styles.toggle} role="group" aria-label="Kiểu sơ đồ">
      {OPTIONS.map(({ value: v, label, title, Icon }) => (
        <button
          key={v}
          type="button"
          className={styles.option}
          aria-pressed={value === v}
          title={title}
          onClick={() => value !== v && onChange(v)}
        >
          <Icon width={18} height={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
