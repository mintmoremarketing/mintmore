const safeNotificationUrl = value => {
  try {
    const candidate = new URL(value || '/notifications', self.location.origin);
    if (candidate.origin === self.location.origin) return candidate.href;
  } catch { /* A malformed payload still needs to produce a visible notification. */ }
  return `${self.location.origin}/notifications`;
};
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('push', event => {
  let message;
  try { message = event.data?.json() || {}; } catch { message = {}; }
  const url = safeNotificationUrl(message.url);
  event.waitUntil(self.registration.showNotification(message.title || 'Creatyv', {
    body: message.body || 'You have an update on Creatyv.', icon: '/logo-dark.png',
    tag: message.tag || 'creatyv-update', data: { url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try { await existing.navigate(url); return await existing.focus(); } catch { /* The window may have closed. */ }
    }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
