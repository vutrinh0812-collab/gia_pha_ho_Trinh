import { Link } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore } from '@/store/prefsStore';
import { Sheet } from './ui/Sheet';
import { ChevronIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './MoreSheet.module.css';

import { InstallCard } from './InstallCard';
import { useIsDesktop } from './useMediaQuery';

// D62: Ngày giỗ is in the navigation; "Giao diện in" and "In khổ A1" are one page;
// sharing and the data check were removed.
const LINKS = [
  { to: '/print', label: 'In ấn' },
  { to: '/admin', label: 'Chế độ Admin' },
];

/** "Cài đặt" menu: secondary pages and viewing preferences. */
export function MoreSheet() {
  const { close, open } = useOverlays();
  const desktop = useIsDesktop();
  const model = useClanStore((s) => s.model);
  const { largeText, setLargeText, showMaternal, setShowMaternal } = usePrefsStore();
  const maternalOn = showMaternal ?? model?.settings.showMaternalDescendants ?? false;

  return (
    <Sheet label="Cài đặt" onClose={() => close('them')} header={<h2 className={styles.title}>Cài đặt</h2>}>
      <InstallCard />
      <nav aria-label="Các trang khác">
        <ul className={styles.links}>
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link to={l.to} replace className={styles.link}>
                {l.label}
                <ChevronIcon width={20} height={20} />
              </Link>
            </li>
          ))}
          {desktop && (
            <li>
              <button type="button" className={styles.link} onClick={() => open('phim')}>
                Phím tắt
                <kbd className={styles.kbdHint}>?</kbd>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <h3 className={styles.section}>Hiển thị</h3>
      <div className={styles.setting}>
        <label htmlFor="pref-large" className={styles.settingLabel}>
          Chữ lớn
          <span className={styles.settingHint}>Phóng to chữ cho dễ đọc</span>
        </label>
        <input
          id="pref-large"
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={largeText}
          onChange={(e) => setLargeText(e.target.checked)}
        />
      </div>
      <div className={styles.setting}>
        <label htmlFor="pref-maternal" className={styles.settingLabel}>
          Hiện con cháu bên ngoại
          <span className={styles.settingHint}>Con cháu của con gái trong họ</span>
        </label>
        <input
          id="pref-maternal"
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={maternalOn}
          onChange={(e) => setShowMaternal(e.target.checked)}
        />
      </div>
    </Sheet>
  );
}
