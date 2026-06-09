'use client';

// Registers the service worker so the app is installable (DEC-019).
import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Don't run the SW in local dev: it intercepts the Next dev server's HMR/RSC
    // requests and breaks them. Unregister any stale worker left over from a prior
    // prod-style run so localhost goes back to plain network.
    const isLocal =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]';
    if (isLocal) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      // Also drop any assets the old worker cached, so localhost stops being served
      // stale HTML/CSS/JS (which can make whole sections appear "missing").
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
