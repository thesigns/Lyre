// Service worker: the whole app from one versioned cache, see docs/Lyre.md 10.1.
// Bump VERSION with every release; the new version downloads in the background
// and takes over the next time the app starts (js/pwa.js), never while playing.

const VERSION = 'lyre-2026-10-17-2';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/gesture.js',
  'js/layout.js',
  'js/melody.js',
  'js/render.js',
  'js/settings.js',
  'js/tuning.js',
  'js/pwa.js',
  'js/audio/engine.js',
  'js/audio/string-processor.js',
  'melodies/melodies.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so every file comes from the same release.
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

// The page asks a waiting new version to take over, only at app startup.
self.addEventListener('message', (event) => {
  if (event.data === 'activate') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      // Page loads (with or without a query string) get the cached app shell.
      const key = request.mode === 'navigate' ? './' : request;
      return (await cache.match(key, { ignoreSearch: true })) || fetch(request);
    }),
  );
});
