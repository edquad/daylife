self.addEventListener('push', (event) => {
  let payload = {
    title: 'Rozka',
    body: 'New message',
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
  const isChat = String(payload.tag || '').startsWith('rozka-chat-');

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Rozka', {
      body: payload.body || '',
      icon,
      badge: icon,
      tag: payload.tag || 'rozka-shared',
      renotify: true,
      silent: false,
      vibrate: isChat ? [120, 60, 120, 60, 120] : [180, 80, 180],
      data: { url: payload.url || self.registration.scope },
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
        const scopeRoot = self.registration.scope.replace(/\/$/, '');
        if (client.url.startsWith(scopeRoot) && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            return client.focus().then(() => client.navigate(targetUrl));
          }
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
