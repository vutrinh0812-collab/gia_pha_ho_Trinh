import { create } from 'zustand';
import { env } from '@/lib/env';

/** Chrome's install prompt event (not in the TS DOM lib). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** A new version is waiting; calling it activates the update (the page reloads). */
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
        // Reload only when the user asked for the update — never on the first
        // install, when the new worker merely takes control of this page.
        let updateRequested = false;
        const offerUpdate = (worker: ServiceWorker) =>
          usePwaStore.setState({
            applyUpdate: () => {
              updateRequested = true;
              worker.postMessage('SKIP_WAITING');
            },
          });
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
          });
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
