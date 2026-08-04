// Service Worker for PRAXiS Web Push Notifications & Background Reminders
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const action = event.action;
    const data = event.notification.data || {};

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            let matchingClient = null;

            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    matchingClient = client;
                    break;
                }
            }

            if (matchingClient) {
                if (action) {
                    matchingClient.postMessage({
                        type: 'NOTIFICATION_ACTION',
                        action: action,
                        habitId: data.habitId,
                        todayIndex: data.todayIndex
                    });
                }
                return matchingClient.focus();
            }

            if (clients.openWindow) {
                let targetUrl = '/praxis';
                if (action && data.habitId) {
                    targetUrl += `?action=${action}&habitId=${encodeURIComponent(data.habitId)}`;
                }
                return clients.openWindow(targetUrl);
            }
        })
    );
});
