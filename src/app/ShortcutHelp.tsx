import { Sheet } from './ui/Sheet';
import { useOverlays } from './useOverlays';
import styles from './ShortcutHelp.module.css';

/** Keyboard shortcuts, grouped by where they work. Kept in sync with the useHotkeys handlers. */
export const SHORTCUTS: Array<{ title: string; keys: Array<[string[], string]> }> = [
  {
    title: 'Chung',
    keys: [
      [['/'], 'Tìm kiếm'],
      [['Ctrl', 'K'], 'Tìm kiếm'],
      [['1'], 'Sơ đồ'],
      [['2'], 'Danh sách'],
      [['3'], 'Ngày giỗ'],
      [['Esc'], 'Đóng bảng đang mở'],
      [['?'], 'Xem phím tắt'],
    ],
  },
  {
    title: 'Trang đầu',
    keys: [
      [['↑'], 'Lên đời trước (cha/mẹ)'],
      [['←', '→'], 'Anh chị em liền trước / liền sau'],
      [['↓'], 'Người con đầu'],
      [['Enter'], 'Xem chi tiết'],
    ],
  },
  {
    title: 'Sơ đồ',
    keys: [
      [['+'], 'Phóng to'],
      [['−'], 'Thu nhỏ'],
      [['0'], 'Vừa màn hình'],
      [['H'], 'Về thủy tổ'],
      [['C'], 'Thu gọn / mở hết'],
      [['L'], 'Lọc'],
      [['←', '↑', '→', '↓'], 'Di chuyển sơ đồ'],
    ],
  },
];

export function ShortcutHelp() {
  const { close } = useOverlays();
  return (
    <Sheet label="Phím tắt" onClose={() => close('phim')} header={<h2 className={styles.title}>Phím tắt</h2>}>
      {SHORTCUTS.map((group) => (
        <section key={group.title} className={styles.group} aria-labelledby={`sc-${group.title}`}>
          <h3 id={`sc-${group.title}`} className={styles.groupTitle}>
            {group.title}
          </h3>
          <dl className={styles.list}>
            {group.keys.map(([keys, label]) => (
              <div key={keys.join('+') + label} className={styles.row}>
                <dt>
                  {keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && (keys[0] === 'Ctrl' ? ' + ' : ' ')}
                      <kbd className={styles.kbd}>{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Sheet>
  );
}
