/*
 * Offline support for the student/parent app (§1.3 Knowledge Hub, Open Book §19 flashcards). Network first for
 * /app/knowledge and /app/openbook/flashcards; when the phone is offline the static offline pages
 * (/app/kb-offline, /app/cards-offline) show what was saved on this device. Live records are never cached here.
 */
const CACHE = 'bjc-kb-v2';
const OFFLINE = '/app/kb-offline';
const CARDS = '/app/cards-offline';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, CARDS])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  const page = url.pathname.startsWith('/app/knowledge') ? OFFLINE : url.pathname.startsWith('/app/openbook/flashcards') || url.pathname === CARDS ? CARDS : null;
  if (!page) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(page).then((r) => r || new Response('Offline', { status: 503 }))));
});
