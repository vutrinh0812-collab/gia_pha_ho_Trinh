import { Link } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { usePrefsStore, type ThemeMode } from '@/store/prefsStore';
import { Sheet } from './ui/Sheet';
import { ChevronIcon } from './ui/icons';
import { useOverlays } from './useOverlays';
import styles from './MoreSheet.module.css';

import { useIsDesktop } from './useMediaQuery';

const LINKS = [
  { to: '/anniversaries', label: 'Lịch ngày giỗ' },
  { to: '/themes', label: 'Giao diện in (theme)' },
  { to: '/print', label: 'In khổ A1' },
  { to: '/admin', label: 'Mã admin' },
  { to: '/kiem-tra', label: 'Kiểm tra dữ liệu' },
];

const THEMES: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Theo máy' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

/** "Thêm" menu: secondary pages and viewing preferences. */
export function MoreSheet() {
  const { close, open } = useOverlays();
  const desktop = useIsDesktop();
  const model = useClanStore((s) => s.model);
  const { theme, setTheme, largeText, setLargeText, showMaternal, setShowMaternal } = usePrefsStore();
  const maternalOn = showMaternal ?? model?.settings.showMaternalDescendants ?? false;

  return (
    <Sheet label="Thêm" onClose={() => close('them')} header={<h2 className={styles.title}>Thêm</h2>}>
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
      <fieldset className={styles.themes}>
        <legend className={styles.settingLabel}>Màu nền</legend>
        <div className={styles.segment}>
          {THEMES.map((t) => (
            <label key={t.value} className={styles.segmentItem}>
              <input
                type="radio"
                name="theme"
                id={`pref-theme-${t.value}`}
                value={t.value}
                checked={theme === t.value}
                onChange={() => setTheme(t.value)}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Sheet>
  );
}
