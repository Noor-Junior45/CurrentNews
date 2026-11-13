const CACHE_NAME = 'current-news-live-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/public/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Safe fallback if some assets fail to cache initially
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Required for PWA installability)
self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url;

  // Let browser handle external analytics, ads, and all admin pages/API requests directly
  // Never cache any admin page, admin API response, or requests on admin host
  try {
    const parsed = new URL(reqUrl);
    if (
      parsed.hostname.startsWith('admin.') ||
      parsed.pathname.startsWith('/admin') ||
      parsed.pathname.startsWith('/api/') ||
      reqUrl.includes('google-analytics') ||
      reqUrl.includes('doubleclick') ||
      reqUrl.includes('pagead2')
    ) {
      return;
    }
  } catch (_) {
    if (reqUrl.includes('/admin') || reqUrl.includes('/api/')) return;
  }

  // Network-First for page navigation requests (guarantees user always gets latest app release)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheControl = networkResponse.headers.get('cache-control') || '';
            // Do not cache if url is admin or response indicates no-store / no-cache
            if (!event.request.url.includes('/admin') && !cacheControl.includes('no-store')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          }
          return networkResponse || new Response('Offline', { status: 503 });
        })
        .catch(async () => {
          try {
            const cached = await caches.match(event.request);
            return (
              cached ||
              (await caches.match('/index.html')) ||
              (await caches.match('/')) ||
              new Response('Offline', { status: 503 })
            );
          } catch (_) {
            return new Response('Offline', { status: 503 });
          }
        })
    );
    return;
  }

  // Cache-First with network fallback for static hashed assets
  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).catch(() => {
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
      .catch(() => {
        return new Response('', { status: 503, statusText: 'Offline' });
      })
  );
});

function cleanNotificationText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;?|&#0*160;?|&#x0*a0;?|&(?:ensp|emsp|thinsp);?/gi, ' ')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#0*39;|&apos;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// Push Event - Displays notification on phone / browser when an article is published
self.addEventListener('push', (event) => {
  let data = {
    title: 'Current News Alert',
    body: 'A new article has just been published.',
    url: '/',
    icon: 'https://i.imgur.com/gFgShoZ.jpeg',
    badge: 'https://i.imgur.com/gFgShoZ.jpeg'
  };

  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = cleanNotificationText(data.title) || 'Current News';
  const body = cleanNotificationText(data.body) || 'Breaking article published. Tap to read.';
  const targetUrl = data.url ? (data.url.startsWith('http') ? data.url : self.location.origin + (data.url.startsWith('/') ? data.url : '/' + data.url)) : self.location.origin;

  const options = {
    body,
    icon: data.icon || 'https://i.imgur.com/gFgShoZ.jpeg',
    badge: data.badge || 'https://i.imgur.com/gFgShoZ.jpeg',
    image: data.image || undefined, // Rich full-width article image on Android
    tag: data.tag || ('post-' + (data.postId || Date.now())),
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: targetUrl,
      postId: data.postId
    },
    actions: [
      { action: 'read', title: 'Read Article' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event - Opens the article URL directly on tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const rawUrl = event.notification.data?.url || '/';
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : self.location.origin + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open to this article, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If any window of Current News is open, navigate it to the article and focus
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      // Otherwise open a new window directly to the article
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
