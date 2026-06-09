// Minimal service worker for PWA installability + light offline resilience (DEC-019).
// Network-first for GET; falls back to cache when offline. API/non-GET pass through.
const CACHE = 'tally-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(async () => (await caches.match(req)) ?? Response.error()),
  );
});
