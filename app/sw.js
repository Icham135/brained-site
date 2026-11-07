// Service Worker nur für Push-Erinnerungen (kein Offline-Cache → keine veralteten Versionen).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Brained', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Brained', { body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: d.url || './' }, tag: 'streak' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(e.notification.data?.url || './');
  }));
});
