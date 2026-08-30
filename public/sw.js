/*
 * KharchGini service worker.
 *
 * Its only job is to make the app *open* without a network. The data is already
 * offline — Firestore's persistent cache holds the entire ledger and queues
 * writes — so this file deliberately never touches a Firebase request. Caching
 * an API response here would mean two caches disagreeing about the same money,
 * and the wrong one winning silently.
 *
 * Bump CACHE_VERSION whenever you want every client to drop its old shell.
 */

const CACHE_VERSION = 'v1';
const CACHE = `kharchgini-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A failed precache must not wedge the install: the app works fine
      // online without a service worker, and a stuck worker is worse.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Content-hashed build output. The name changes when the bytes change, so this is safe forever. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never interfere with writes, and never with anyone else's origin —
  // that rules out every Firebase, Google and font request in one line.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always try the network first, so a deploy is picked up on the
  // next open rather than after some mysterious number of visits.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match(OFFLINE_URL))
            .then((cached) => cached ?? Response.error()),
        ),
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        });
      }),
    );
  }

  // Everything else falls through to the network untouched.
});
