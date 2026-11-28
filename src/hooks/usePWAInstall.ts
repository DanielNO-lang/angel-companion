import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOS: boolean;
}

const listeners = new Set<(snapshot: PWAInstallSnapshot) => void>();
let initialized = false;
let state: PWAInstallSnapshot = {
  deferredPrompt: null,
  isInstalled: false,
  isIOS: false,
};

function notifySubscribers() {
  for (const listener of listeners) {
    listener({ ...state });
  }
}

export function initPWAInstallListeners(): void {
  if (initialized || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }
  initialized = true;

  const isStandalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const userAgent = (window.navigator?.userAgent || '').toLowerCase();
  state = {
    ...state,
    isInstalled: Boolean(isStandalone),
    isIOS: /iphone|ipad|ipod/.test(userAgent),
  };

  const handleBeforeInstallPrompt = (e: Event) => {
    // Capture Chromium's deferred install prompt once globally so PWAInstallButton can trigger prompt() on click.
    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    state = {
      ...state,
      deferredPrompt: e as BeforeInstallPromptEvent,
    };
    notifySubscribers();
  };

  const handleAppInstalled = () => {
    state = {
      ...state,
      isInstalled: true,
      deferredPrompt: null,
    };
    notifySubscribers();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
}

if (typeof window !== 'undefined') {
  initPWAInstallListeners();
}

export async function triggerPWAInstallPrompt(): Promise<boolean> {
  if (!state.deferredPrompt) return false;
  const promptEvent = state.deferredPrompt;
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      state = {
        ...state,
        isInstalled: true,
        deferredPrompt: null,
      };
      notifySubscribers();
      return true;
    }
    state = {
      ...state,
      deferredPrompt: null,
    };
    notifySubscribers();
    return false;
  } catch {
    state = {
      ...state,
      deferredPrompt: null,
    };
    notifySubscribers();
    return false;
  }
}

export function resetPWAInstallStoreForTesting(): void {
  initialized = false;
  state = {
    deferredPrompt: null,
    isInstalled: false,
    isIOS: false,
  };
  listeners.clear();
}

export function usePWAInstall() {
  const [snapshot, setSnapshot] = useState<PWAInstallSnapshot>(() => {
    if (typeof window !== 'undefined') {
      initPWAInstallListeners();
    }
    return { ...state };
  });

  useEffect(() => {
    initPWAInstallListeners();
    setSnapshot({ ...state });
    const listener = (next: PWAInstallSnapshot) => setSnapshot(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isInstallable: Boolean(snapshot.deferredPrompt),
    isInstalled: snapshot.isInstalled,
    isIOS: snapshot.isIOS,
    install: triggerPWAInstallPrompt,
  };
}
