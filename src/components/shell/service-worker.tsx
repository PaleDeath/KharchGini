'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, and only in production.
 *
 * In development it does the opposite: any worker left over from a local
 * production build is torn down and its caches deleted. Otherwise `npm run dev`
 * quietly serves yesterday's JavaScript and you lose an afternoon to a bug that
 * was fixed hours ago.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      if ('caches' in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith('kharchgini-')) void caches.delete(key);
          }
        });
      }
      return;
    }

    // After load, so registration never competes with the first paint.
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
