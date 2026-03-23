/**
 * Service Worker - PWA offline support
 * Caches event list, event details, QR pass for offline viewing
 */
const CACHE_NAME = 'cems-v1';
const OFFLINE_URLS = [
  '/',
  '/landing.html',
  '/login.html',
  '/register.html',
  '/register-event.html',
  '/student_dashboard.html',
  '/admin_dashboard.html',
  '/organizer_dashboard.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({ message: 'Offline - sync when online' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        if (res.status === 200 && (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('.json'))) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/landing.html')))
  );
});
