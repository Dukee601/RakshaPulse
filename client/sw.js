const CACHE_NAME = 'rakshapulse-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/watch.html',
  '/index.html',
  '/police-dashboard.html',
  '/style.css',
  '/app.js',
  '/police-dashboard.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline smartwatch assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass API requests to network, cache assets
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true }))));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
