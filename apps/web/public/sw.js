const CACHE_NAME = 'gratonite-v5';
const API_CACHE_NAME = 'gratonite-api-v2';
const FONT_CACHE_NAME = 'gratonite-fonts-v1';
const STATIC_ASSETS = ['/app/', '/app/index.html', '/app/manifest.json'];

// API paths that should be cached for offline access
const CACHEABLE_API_PATHS = [
  '/api/guilds/@me',
  '/api/relationships',
  '/api/relationships/channels',
  '/api/users/@me',
];

// API path prefixes for cache matching (guild channels, messages, members)
const CACHEABLE_API_PREFIXES = [
  '/api/guilds/',
  '/api/channels/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const KEEP_CACHES = [CACHE_NAME, API_CACHE_NAME, FONT_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !KEEP_CACHES.includes(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheableApiPath(url) {
  if (CACHEABLE_API_PATHS.includes(url.pathname)) return true;
  return CACHEABLE_API_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept GET requests for caching
  if (event.request.method !== 'GET') return;

  // Cache-first for Google Fonts (long-lived)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(FONT_CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Hashed JS/CSS: network-first so a new deploy always fetches matching chunks (avoids
  // "Failed to fetch dynamically imported module" when index.html updated but SW/cache had stale logic).
  // Offline: fall back to cache.
  if (url.pathname.startsWith('/app/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for API requests, fall back to cache when offline
  if (isApiRequest(url) && isCacheableApiPath(url)) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Only cache successful responses
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Network failed — serve from cache if available
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Return a synthetic offline error response
            return new Response(
              JSON.stringify({ error: 'offline', message: 'You are offline' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Network-first for HTML (SPA navigation)
  if (url.pathname.startsWith('/app') && !url.pathname.includes('.')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/app/index.html'))
    );
  }
});

// Handle push notifications — add Reply action for message notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Gratonite', body: 'You have a new notification' };

  // Build notification options
  const options = {
    body: data.body,
    icon: '/app/favicon.ico',
    badge: '/app/favicon.ico',
    tag: data.channelId ? `channel-${data.channelId}` : undefined,
    renotify: !!data.channelId,
    data: data,
  };

  // Add Reply action for message notifications that have a channelId
  if (data.channelId) {
    options.actions = [
      {
        action: 'reply',
        title: 'Reply',
        type: 'text',
        placeholder: 'Type a reply...',
      },
      {
        action: 'mark-read',
        title: 'Mark Read',
      },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get stored auth token from IndexedDB or client
async function getAuthToken() {
  // Ask any open client for the auth token
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    try {
      const response = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => resolve(event.data);
        setTimeout(() => reject(new Error('timeout')), 3000);
        client.postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
      });
      if (response && response.token) return response.token;
    } catch {
      // Try next client
    }
  }

  // Fallback: read from IndexedDB where the app stores it
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('gratonite-auth', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('tokens', 'readonly');
    const store = tx.objectStore('tokens');
    const result = await new Promise((resolve, reject) => {
      const req = store.get('accessToken');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result) return result;
  } catch {
    // IndexedDB not available or store doesn't exist
  }

  return null;
}

// Determine API base URL
function getApiBase() {
  return self.location.origin + '/api';
}

// Handle notification click and action
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  notification.close();

  // Handle Reply action
  if (action === 'reply' && data.channelId) {
    const replyText = event.reply; // The text the user typed
    if (!replyText || !replyText.trim()) return;

    event.waitUntil(
      (async () => {
        const token = await getAuthToken();
        if (!token) {
          // Can't reply without auth — open the app instead
          const clients = await self.clients.matchAll({ type: 'window' });
          if (clients.length > 0) {
            clients[0].focus();
          } else {
            await self.clients.openWindow('/app');
          }
          return;
        }

        try {
          const apiBase = getApiBase();
          const response = await fetch(`${apiBase}/channels/${data.channelId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ content: replyText.trim() }),
          });

          if (!response.ok) {
            // If reply failed, open the app so user can retry
            const clients = await self.clients.matchAll({ type: 'window' });
            if (clients.length > 0) {
              clients[0].focus();
              clients[0].postMessage({
                type: 'REPLY_FAILED',
                channelId: data.channelId,
                content: replyText,
              });
            }
          } else {
            // Show a brief confirmation notification
            await self.registration.showNotification('Reply Sent', {
              body: `Your reply was sent successfully`,
              icon: '/app/favicon.ico',
              tag: 'reply-confirmation',
              silent: true,
              requireInteraction: false,
            });
            // Auto-close the confirmation after 2 seconds
            setTimeout(async () => {
              const notifications = await self.registration.getNotifications({ tag: 'reply-confirmation' });
              notifications.forEach(n => n.close());
            }, 2000);
          }
        } catch {
          // Network error — open the app
          const clients = await self.clients.matchAll({ type: 'window' });
          if (clients.length > 0) {
            clients[0].focus();
          } else {
            await self.clients.openWindow('/app');
          }
        }
      })()
    );
    return;
  }

  // Handle Mark Read action
  if (action === 'mark-read' && data.channelId) {
    event.waitUntil(
      (async () => {
        const token = await getAuthToken();
        if (!token) return;

        try {
          const apiBase = getApiBase();
          await fetch(`${apiBase}/channels/${data.channelId}/messages/read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
        } catch {
          // Silent failure for mark-read
        }
      })()
    );
    return;
  }

  // Default: open or focus the app window, navigate to channel if applicable
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const targetUrl = data.channelId
        ? `/app/channels/${data.channelId}`
        : '/app';

      // Try to find an existing Gratonite window
      for (const client of clients) {
        if (client.url.includes('/app')) {
          client.focus();
          // Tell the app to navigate to the channel
          if (data.channelId) {
            client.postMessage({
              type: 'NAVIGATE_TO_CHANNEL',
              channelId: data.channelId,
              guildId: data.guildId || null,
            });
          }
          return;
        }
      }
      // No existing window — open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Listen for messages from the client (e.g., cache invalidation, auth token)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE_NAME);
  }

  // Store auth token for notification replies
  if (event.data?.type === 'STORE_AUTH_TOKEN' && event.data.token) {
    // Store in IndexedDB for later retrieval
    const openReq = indexedDB.open('gratonite-auth', 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains('tokens')) {
        db.createObjectStore('tokens');
      }
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction('tokens', 'readwrite');
      tx.objectStore('tokens').put(event.data.token, 'accessToken');
      db.close();
    };
  }

  // Respond to GET_AUTH_TOKEN requests from the SW itself via MessageChannel
  if (event.data?.type === 'GET_AUTH_TOKEN' && event.ports[0]) {
    // This is handled by the client-side code, not the SW
  }
});
