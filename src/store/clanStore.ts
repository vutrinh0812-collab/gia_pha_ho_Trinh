import { create } from 'zustand';
import { buildClanModel, type ClanModel } from '@/lib/clanModel';
import { subscribeClan } from '@/lib/data';
import { env, missingEnv } from '@/lib/env';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ClanState {
  status: Status;
  error: string | null;
  model: ClanModel | null;
  /** Starts the (realtime) subscription once; safe to call repeatedly. */
  start(): void;
}

let unsubscribe: (() => void) | null = null;
let retriedWithoutCache = false;

export const useClanStore = create<ClanState>((set, get) => ({
  status: 'idle',
  error: null,
  model: null,
  start() {
    if (unsubscribe || get().status === 'ready') return;
    if (env.dataSource === 'firebase' && missingEnv.length) {
      set({
        status: 'error',
        error:
          `Trang web thiếu cấu hình: ${missingEnv.join(', ')}. ` +
          'Vào Vercel → Settings → Environment Variables, thêm các biến này cho cả Production và Preview, rồi Redeploy.',
      });
      return;
    }
    set({ status: 'loading', error: null });
    let failed = false;
    unsubscribe = subscribeClan(
      (snap) => {
        const model = buildClanModel(snap);
        set({ model, status: model ? 'ready' : 'empty', error: null });
      },
      (e) => {
        if (failed) return; // each of the listeners reports the same failure
        failed = true;
        unsubscribe?.();
        unsubscribe = null;
        void import('@/lib/firebase').then(async (fb) => {
          if (retriedWithoutCache || !fb.isOfflineCacheError(e)) {
            set({ status: 'error', error: e.message });
            return;
          }
          // The browser's offline cache is broken: carry on without it.
          retriedWithoutCache = true;
          await fb.fallBackToMemoryCache();
          set({ status: 'idle' });
          get().start();
        });
      },
    );
  },
}));
