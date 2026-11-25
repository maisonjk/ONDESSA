// Ondessa service worker: offline cache for the app's own static files only.
// It never sees health data (that lives in IndexedDB) and never caches cross-origin requests.
const CACHE = 'ondessa-static-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

// Precache the shell plus every same-origin script, style and font the page links to, so the
// app also opens offline after the very first visit (before this worker controlled the page).
async function precache() {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);
  const html = await (await c.match('/index.html')).text();
  const linked = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await c.addAll([...new Set(linked)]);
  const fonts = [];
  for (const css of linked.filter((a) => a.endsWith('.css'))) {
    const text = await (await c.match(css)).text();
    fonts.push(...[...text.matchAll(/url\((\/assets\/[^)]+\.woff2)\)/g)].map((m) => m[1]));
  }
  await c.addAll([...new Set(fonts)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request, { ignoreVary: true }).then((r) => r || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())),
      ),
  );
});
