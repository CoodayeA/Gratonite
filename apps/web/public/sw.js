const CACHE_NAME = 'gratonite-v2';
const STATIC_ASSETS = ['/app/', '/app/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Cache-first for static assets (hashed filenames)
  if (url.pathname.startsWith('/app/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first for HTML
  if (url.pathname.startsWith('/app') && !url.pathname.includes('.')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/app/index.html'))
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Gratonite', body: 'You have a new notification' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/app/favicon.ico',
      badge: '/app/favicon.ico',
      data: data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/app');
      }
    })
  );
});
