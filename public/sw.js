/**
 * Avoid cache-first on HTML/index: after deploy, old cached index references
 * removed hashed JS assets → blank screen. Network-first for documents;
 * stale shell only as offline fallback after network failure.
 */
const CACHE_NAME = 'finance-ai-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))
      )
      .then(() => self.clients.claim()),
  );
});

function isNavigationOrDocument(req) {
  return (
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    (req.headers.get('accept') || '').includes('text/html')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== location.origin || req.method !== 'GET') return;

  if (isNavigationOrDocument(req)) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          if (resp.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html'))),
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || Promise.reject())),
  );
});
