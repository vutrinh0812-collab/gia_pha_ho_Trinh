import { create } from 'zustand';
import { buildClanModel, type ClanModel } from '@/lib/clanModel';
import { subscribeClan } from '@/lib/data';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ClanState {
  status: Status;
  error: string | null;
  model: ClanModel | null;
  /** Starts the (realtime) subscription once; safe to call repeatedly. */
  start(): void;
}

let unsubscribe: (() => void) | null = null;

export const useClanStore = create<ClanState>((set, get) => ({
  status: 'idle',
  error: null,
  model: null,
  start() {
    if (unsubscribe || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    unsubscribe = subscribeClan(
      (snap) => {
        const model = buildClanModel(snap);
        set({ model, status: model ? 'ready' : 'empty', error: null });
      },
      (e) => {
        unsubscribe?.();
        unsubscribe = null;
        set({ status: 'error', error: e.message });
      },
    );
  },
}));
