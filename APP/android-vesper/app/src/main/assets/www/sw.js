// BFX VESPER service worker — app shell offline, network for API.
const V = 'vesper-v1';
const SHELL = ['/', '/index.html', '/css/app.css', '/css/fonts.css', '/js/app.js', '/js/engine.js', '/js/i18n.js', '/js/reasons.js', '/js/icons.js', '/js/callguard.js', '/js/ondevice.js', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api') || u.pathname.startsWith('/webhook')) return;
  if (u.pathname.startsWith('/fonts/')) { e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const c = res.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return res; }))); return; }
  e.respondWith(fetch(e.request).then((res) => { const c = res.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return res; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
