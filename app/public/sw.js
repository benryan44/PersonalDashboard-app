// Offline shell: network-first for pages, cache-first for built assets and fonts.
const CACHE = 'daily-brief-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      caches.open(CACHE).then(c => c.put('/', res.clone()));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  const cacheable = url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') caches.open(CACHE).then(c => c.put(req, res.clone()));
    return res;
  })));
});

// Tapping a reminder focuses the app on the tab it's about.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = e.notification.data?.tab || 'brief';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const client = list[0];
    if (client) { client.postMessage({ tab }); return client.focus(); }
    return self.clients.openWindow('/?tab=' + tab);
  }));
});
