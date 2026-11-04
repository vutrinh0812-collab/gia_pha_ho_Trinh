import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface ToastState {
  toast: Toast | null;
  show(text: string, tone?: Toast['tone']): void;
  hide(): void;
}

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** One short message at a time ("Đã lưu", an error), above the bottom bar. */
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show(text, tone = 'ok') {
    clearTimeout(timer);
    set({ toast: { id: ++seq, text, tone } });
    timer = setTimeout(() => set({ toast: null }), tone === 'error' ? 7000 : 3500);
  },
  hide() {
    clearTimeout(timer);
    set({ toast: null });
  },
}));
