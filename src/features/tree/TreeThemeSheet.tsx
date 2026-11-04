import { useEffect, useState } from 'react';
import { Sheet } from '@/app/ui/Sheet';
import { useThemeFonts } from '@/themes/fonts';
import { SCREEN_THEME_ID } from '@/themes/treeVars';
import type { Theme } from '@/themes/types';
import { loadThemes } from './useTreeTheme';
import styles from './Tree.module.css';

interface Props {
  value: string;
  onChange(id: string): void;
  onClose(): void;
}

/** "Chọn theme" on the tree (SPEC 5.1): the screen theme or any print theme. */
export function TreeThemeSheet({ value, onChange, onClose }: Props) {
  const [themes, setThemes] = useState<Theme[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadThemes().then((r) => {
      if (!live) return;
      const screen = r.THEMES.filter((t) => t.id === SCREEN_THEME_ID);
      setThemes([...screen, ...r.PRINT_THEMES.filter((t) => t.id !== SCREEN_THEME_ID)]);
    });
    return () => {
      live = false;
    };
  }, []);
  useThemeFonts(themes ?? []);

  return (
    <Sheet label="Giao diện sơ đồ" onClose={onClose} header={<h2 className={styles.sheetTitle}>Giao diện sơ đồ</h2>}>
      <p className={styles.themeNote}>Đổi màu và kiểu chữ của sơ đồ. Khung và hoa văn chỉ có trên bản in.</p>
      {!themes ? (
        <p className={styles.themeNote}>Đang tải…</p>
      ) : (
        <ul className={styles.themeList} role="radiogroup" aria-label="Giao diện">
          {themes.map((t) => {
            const c = t.colors;
            const checked = t.id === value || (value === 'minimal' && t.id === SCREEN_THEME_ID);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={styles.themeOption}
                  onClick={() => {
                    onChange(t.id);
                    onClose();
                  }}
                >
                  <span className={styles.swatch} style={{ background: c.background, borderColor: c.frame }} aria-hidden="true">
                    <span style={{ background: c.frame }} />
                    <span style={{ background: c.male }} />
                    <span style={{ background: c.female }} />
                  </span>
                  <span className={styles.themeText}>
                    <span className={styles.themeName} style={{ fontFamily: `'${t.typography.name.family}', serif` }}>
                      {t.name}
                    </span>
                    <span className={styles.themeDesc}>{t.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
