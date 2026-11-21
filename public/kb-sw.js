/*
 * Knowledge Hub offline support for the student/parent app (§1.3). Network first for /app/knowledge pages;
 * when the phone is offline, the offline reader (/app/kb-offline) shows the articles saved on this device.
 * Live records are never cached here.
 */
const CACHE = 'bjc-kb-v1';
const OFFLINE = '/app/kb-offline';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate' || !url.pathname.startsWith('/app/knowledge')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE).then((r) => r || new Response('Offline', { status: 503 }))));
});
