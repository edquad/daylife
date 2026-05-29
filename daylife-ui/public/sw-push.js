self.addEventListener('push', (event) => {
  let payload = {
    title: 'Rozka',
    body: 'Something new from someone you share with',
    url: self.registration.scope,
    tag: 'rozka-shared',
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    /* ignore malformed payload */
  }

  const icon = new URL('icon.svg', self.registration.scope).href;
  const badge = new URL('pwa-192x192.png', self.registration.scope).href;

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Rozka', {
      body: payload.body || '',
      icon,
      badge,
      tag: payload.tag || 'rozka-shared',
      data: { url: payload.url || self.registration.scope },
      vibrate: [180, 80, 180],
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.registration.scope.slice(0, -1)) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
