const SC_PWA_CACHE_NAME = 'sweet-city-v2026-final';
const SC_PWA_CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SC_PWA_CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        SC_PWA_CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== SC_PWA_CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url);
  } catch (e) {
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return;
  }

  // Network-Only للسيرفر وبيانات Google Sheets / Apps Script / Drive
  const host = parsedUrl.hostname.toLowerCase();
  if (
    host.includes('script.google.com') ||
    host.includes('script.googleusercontent.com') ||
    host.includes('docs.google.com') ||
    host.includes('drive.google.com') ||
    host.includes('googleusercontent.com') ||
    host.includes('googleapis.com')
  ) {
    return;
  }

  // Network-First لصفحات HTML والتنقل
  const acceptHeader = req.headers ? (req.headers.get('accept') || '') : '';
  const isHtmlRequest =
    req.mode === 'navigate' ||
    acceptHeader.includes('text/html') ||
    parsedUrl.pathname.endsWith('/') ||
    parsedUrl.pathname.endsWith('.html');

  if (isHtmlRequest) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(SC_PWA_CACHE_NAME).then((cache) => {
              cache.put(req, clone).catch(() => {});
            }).catch(() => {});
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match('./index.html').then((idx) => idx || caches.match('./'));
          });
        })
    );
    return;
  }

  // Network-First مع حفظ احتياطي لبقية الأصول الثابتة
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (
          networkRes &&
          networkRes.status === 200 &&
          (networkRes.type === 'basic' || networkRes.type === 'cors')
        ) {
          const clone = networkRes.clone();
          caches.open(SC_PWA_CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          }).catch(() => {});
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
