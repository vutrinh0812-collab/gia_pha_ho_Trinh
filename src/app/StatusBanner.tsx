import { usePwaStore } from './pwa';
import styles from './StatusBanner.module.css';

/** Offline notice and "new version" prompt, above the bottom bar. */
export function StatusBanner() {
  const { offline, applyUpdate } = usePwaStore();
  if (!offline && !applyUpdate) return null;
  return (
    <div className={styles.banner} role="status">
      {offline ? (
        <span>Đang mất mạng · hiển thị dữ liệu đã lưu trên máy</span>
      ) : (
        <>
          <span>Đã có phiên bản mới của gia phả.</span>
          <button type="button" className={styles.action} onClick={() => applyUpdate?.()}>
            Cập nhật
          </button>
        </>
      )}
    </div>
  );
}
