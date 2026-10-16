import { useEffect, useState } from 'react';

/** Chrome / Edge / Samsung Internet fire this when the app is installable. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

const EVENT = 'scaler:installable';

/** Call once at startup, before React renders — the browser may fire the event very early. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__installPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(EVENT));
  });
  window.addEventListener('appinstalled', () => {
    window.__installPrompt = null;
    window.dispatchEvent(new Event(EVENT));
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function useInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(() => window.__installPrompt ?? null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const sync = () => {
      setPrompt(window.__installPrompt ?? null);
      setInstalled(isStandalone());
    };
    window.addEventListener(EVENT, sync);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      mq.removeEventListener('change', sync);
    };
  }, []);

  const platform = detectPlatform();
  const touch = navigator.maxTouchPoints > 0;
  return {
    installed,
    platform,
    /** Show the button when the browser can install directly, or on any phone/tablet (with instructions). */
    available: !installed && (prompt !== null || touch || platform !== 'desktop'),
    /** Returns true if the native prompt was shown; false means "show instructions". */
    async install(): Promise<boolean> {
      if (!prompt) return false;
      await prompt.prompt();
      await prompt.userChoice;
      window.__installPrompt = null;
      setPrompt(null);
      return true;
    },
  };
}
