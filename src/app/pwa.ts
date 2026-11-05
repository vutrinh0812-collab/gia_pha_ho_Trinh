import { create } from 'zustand';
import { env } from '@/lib/env';
import { useAdminUi } from '@/store/adminUiStore';

/** A new version found this soon after the app is opened or shown again is applied at once. */
const AUTO_UPDATE_WINDOW_MS = 15_000;

/** Chrome's install prompt event (not in the TS DOM lib). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** A new version is waiting and could not apply by itself; calling it activates the update (the page reloads). */
  applyUpdate: (() => void) | null;
  installPrompt: InstallPromptEvent | null;
  offline: boolean;
  installed: boolean;
}

export const usePwaStore = create<PwaState>(() => ({
  applyUpdate: null,
  installPrompt: null,
  offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  installed:
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true),
}));

/**
 * Registers the service worker (production builds with normal routing only —
 * not in dev, tests or the single-file preview) and wires the PWA signals.
 */
export function initPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => usePwaStore.setState({ offline: false }));
  window.addEventListener('offline', () => usePwaStore.setState({ offline: true }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.setState({ installPrompt: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwaStore.setState({ installPrompt: null, installed: true }));

  if (!import.meta.env.PROD || env.router !== 'browser' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Reload only for a real update (we asked the waiting worker to take over) —
        // never on the first install, when the new worker merely takes control of this page.
        let updateRequested = false;
        let waiting: ServiceWorker | null = null;
        // A phone keeps the app open in the background for days, so a new version is
        // checked for each time the app comes back to the screen (DECISIONS D53).
        let shownAt = Date.now();
        const apply = () => {
          if (!waiting || updateRequested) return;
          updateRequested = true;
          waiting.postMessage('SKIP_WAITING');
        };
        /** Updates by itself only when nothing is lost: just opened or out of sight, no admin form open. */
        const autoApply = () => {
          if (!waiting || useAdminUi.getState().action) return;
          if (document.visibilityState === 'hidden' || Date.now() - shownAt < AUTO_UPDATE_WINDOW_MS) apply();
        };
        const offerUpdate = (worker: ServiceWorker) => {
          waiting = worker;
          // The banner stays as a fallback while an update cannot apply by itself.
          usePwaStore.setState({ applyUpdate: apply });
          autoApply();
        };
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
          });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            shownAt = Date.now();
            void reg.update().catch(() => {
              // Offline: try again next time.
            });
          }
          autoApply();
        });
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!updateRequested || reloading) return;
          reloading = true;
          window.location.reload();
        });
      })
      .catch(() => {
        // Some in-app browsers refuse service workers; the app still works online.
      });
  });
}
