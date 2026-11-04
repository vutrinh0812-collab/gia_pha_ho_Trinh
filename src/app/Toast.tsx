import { useToastStore } from '@/store/toastStore';
import styles from './Toast.module.css';

export function Toast() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  if (!toast) return null;
  return (
    <div key={toast.id} className={styles.toast} data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.text}</span>
      <button type="button" className={styles.close} onClick={hide} aria-label="Đóng thông báo">
        ×
      </button>
    </div>
  );
}
