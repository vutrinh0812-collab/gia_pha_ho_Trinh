import { useState } from 'react';
import { env } from '@/lib/env';
import { detectInAppBrowser, IN_APP_NAMES, isIos } from '@/lib/inApp';
import { usePwaStore } from './pwa';
import styles from './MoreSheet.module.css';

/**
 * "Cài lên màn hình chính" (SPEC 5A.4). In-app browsers (Zalo, Facebook…)
 * cannot install, so they get instructions to open the real browser instead.
 */
export function InstallCard() {
  const { installPrompt, installed } = usePwaStore();
  const [done, setDone] = useState(false);
  if (env.router === 'memory' || installed || done) return null;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const inApp = detectInAppBrowser(ua);

  let body: React.ReactNode = null;
  if (inApp) {
    body = (
      <p>
        Bạn đang mở trong {IN_APP_NAMES[inApp]}. Để cài gia phả lên màn hình chính và xem được khi mất mạng, bấm nút{' '}
        <strong>⋯</strong> ở góc trên, chọn <strong>“Mở bằng trình duyệt”</strong>.
      </p>
    );
  } else if (installPrompt) {
    body = (
      <button
        type="button"
        className={styles.installButton}
        onClick={async () => {
          await installPrompt.prompt();
          const choice = await installPrompt.userChoice;
          if (choice.outcome === 'accepted') setDone(true);
          usePwaStore.setState({ installPrompt: null });
        }}
      >
        Cài gia phả lên màn hình chính
      </button>
    );
  } else if (isIos(ua)) {
    body = (
      <p>
        Trên iPhone: trong Safari bấm nút <strong>Chia sẻ</strong> (ô vuông có mũi tên), rồi chọn{' '}
        <strong>“Thêm vào MH chính”</strong>.
      </p>
    );
  }
  if (!body) return null;
  return (
    <section className={styles.install} aria-labelledby="install-title">
      <h3 id="install-title" className={styles.section}>
        Cài lên điện thoại
      </h3>
      {body}
    </section>
  );
}
