import { registerSW } from 'virtual:pwa-register';

let swInitialized = false;
let swRegistered = false;

export function registerAngelServiceWorker(): void {
  if (swInitialized || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  swInitialized = true;

  try {
    registerSW({
      immediate: true,
      onRegisteredSW() {
        swRegistered = true;
      },
      onRegisterError(error) {
        console.warn('[PWA] Service worker registration skipped:', error);
      },
    });
  } catch (error) {
    console.warn('[PWA] Service worker initialization error:', error);
  }
}

export function isServiceWorkerRegistered(): boolean {
  return swRegistered;
}
