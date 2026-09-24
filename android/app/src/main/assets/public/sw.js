const CACHE_NAME = 'current-news-live-v1';
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
  // Let the browser handle external analytics/ads scripts directly
  if (event.request.url.includes('google-analytics') || event.request.url.includes('doubleclick') || event.request.url.includes('pagead2')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Offline fallback logic can be added here if needed
      });
    })
  );
});

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

  const title = data.title || 'Current News';
  const targetUrl = data.url ? (data.url.startsWith('http') ? data.url : self.location.origin + (data.url.startsWith('/') ? data.url : '/' + data.url)) : self.location.origin;

  const options = {
    body: data.body || 'Breaking article published. Tap to read.',
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
