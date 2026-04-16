// ============================================================
// Safe Chats – sw.js | Service Worker
// NO code caching – always fetches fresh from network
// Developer: Yahya Mundewadi (yahya.in)
// ============================================================

const SW_VERSION = 'v1.0.0'; // Bump this to force update
const CACHE_NAME = 'safe-chats-' + SW_VERSION;

// Files to cache for offline shell ONLY (minimal)
// App code is NEVER cached — always fetched fresh
const SHELL_CACHE = [
  '/manifest.json',
  '/safechat.jpg'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_CACHE))
  );
  // Immediately take control — don't wait for old SW to die
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH — NETWORK FIRST, NO CODE CACHE ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase.co')) return;

  // HTML, JS, CSS — always network first, no caching
  if (
    event.request.destination === 'document' ||
    event.request.destination === 'script' ||
    event.request.destination === 'style'
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Icons/manifest — cache allowed
  if (SHELL_CACHE.some(f => url.pathname === f)) {
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request))
    );
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});

// ── SKIP WAITING MESSAGE ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── PUSH NOTIFICATION ────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Safe Chats', body: 'New message', chatId: null, senderName: '' };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: '/safechat.jpg',
    badge: '/safechat.jpg',
    tag: data.chatId || 'safe-chats-notif',
    renotify: true,
    data: { chatId: data.chatId, url: data.chatId ? '/?chat=' + data.chatId : '/' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'OPEN_CHAT', chatId: event.notification.data?.chatId });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ── BACKGROUND SYNC (optional future use) ───────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    // Future: retry failed message sends
  }
});
