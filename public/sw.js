// MaternaSync service worker. It keeps the app's own files (pages, scripts, styles, icons) so the app opens without a signal.
// It never keeps anything from the server's API: no health information, no account details, no replies. Those always come live.
const SHELL = 'maternasync-shell-v1';
const FILES = 'maternasync-files-v1';
const MOST_FILES_KEPT = 160;
// A script asked for by the page carries an Origin header that the kept copy was not asked with; a host that answers 'Vary: Origin' would
// then never match its own kept file. These are our own static files, so the header is ignored.
const SAME = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // The page and the files it names are kept at once, so the very first visit already works offline.
    const page = await fetch('/index.html', { cache: 'reload' });
    const names = [...(await page.clone().text()).matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await shell.put('/index.html', page);
    await shell.addAll(['/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']);
    const files = await caches.open(FILES);
    await Promise.all(names.map((name) => files.add(name).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('maternasync-') && name !== SHELL && name !== FILES) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// The page tells the worker which of the app's files it has already loaded (it loaded them before the worker was in charge of it),
// so those are kept too and the pages she has already opened work offline.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'keep-loaded' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const files = await caches.open(FILES);
    for (const address of data.urls) {
      const url = new URL(String(address), self.location.origin);
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) continue;
      if (await files.match(url.pathname, SAME)) continue;
      await files.add(url.pathname).catch(() => undefined);
    }
  })());
});

async function keepFile(request, response) {
  const cache = await caches.open(FILES);
  await cache.put(request, response);
  const kept = await cache.keys();
  // Older versions of the app leave their files behind; the oldest go first.
  for (const stale of kept.slice(0, Math.max(0, kept.length - MOST_FILES_KEPT))) await cache.delete(stale);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return; // the API, fonts and maps are not ours to keep

  if (request.mode === 'navigate') {
    // The newest page when there is a signal; the last one seen when there is not.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL).then((cache) => cache.put('/index.html', copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html', SAME)) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // These file names change whenever the file changes, so a kept copy is always the right one.
    event.respondWith(
      caches.match(request, SAME).then(async (kept) => {
        if (kept) return kept;
        const response = await fetch(request);
        if (response.ok) event.waitUntil(keepFile(request, response.clone()));
        return response;
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(request).catch(() => caches.match(request, SAME).then((kept) => kept ?? Response.error())));
  }
});
