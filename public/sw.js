// Service Worker for PRAXiS Web Push Notifications & 24/7 Background Reminders
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Listen for Web Push Notifications from server (Works even when browser/site is closed)
self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = {
                title: '⏰ PRAXiS Habit Reminder',
                body: event.data.text()
            };
        }
    }

    const title = payload.title || '⏰ PRAXiS Habit Reminder';
    const habitId = payload.habitId || (payload.data && payload.data.habitId) || '';
    const targetUrl = payload.url || (payload.data && payload.data.url) || '/praxis';

    const options = {
        body: payload.body || 'You have a scheduled habit reminder.',
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        tag: payload.tag || ('praxis-remind-' + Date.now()),
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            habitId: habitId,
            url: targetUrl,
            timestamp: Date.now()
        },
        actions: payload.actions || [
            { action: 'complete', title: '✅ Mark Done' },
            { action: 'missed', title: '✕ Mark Missed' },
            { action: 'snooze', title: '⏰ Snooze 10m' }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Handle Notification Clicks & Action Buttons (Done / Missed / Snooze)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const action = event.action;
    const data = event.notification.data || {};
    const habitId = data.habitId || '';
    const baseUrl = data.url || '/praxis';

    // If an action button was clicked, optionally fire background API update
    const promises = [];
    if (action && habitId) {
        promises.push(
            fetch('/api/push/habit-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    habitId: habitId,
                    action: action,
                    timestamp: Date.now()
                })
            }).catch(() => {
                // Ignore network errors in background
            })
        );
    }

    // Handle opening or focusing window
    const windowPromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        let matchingClient = null;

        for (const client of clientList) {
            if (client.url && 'focus' in client) {
                matchingClient = client;
                break;
            }
        }

        if (matchingClient) {
            if (action && habitId) {
                matchingClient.postMessage({
                    type: 'NOTIFICATION_ACTION',
                    action: action,
                    habitId: habitId
                });
            }
            return matchingClient.focus();
        }

        if (clients.openWindow) {
            let targetUrl = baseUrl;
            if (action && habitId) {
                const separator = targetUrl.includes('?') ? '&' : '?';
                targetUrl += `${separator}action=${encodeURIComponent(action)}&habitId=${encodeURIComponent(habitId)}`;
            }
            return clients.openWindow(targetUrl);
        }
    });

    promises.push(windowPromise);
    event.waitUntil(Promise.all(promises));
});

// Re-subscribe if push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        fetch('/api/push/vapid-public-key')
            .then(res => res.json())
            .then(data => {
                if (!data.publicKey) return;
                const convertedKey = urlBase64ToUint8Array(data.publicKey);
                return self.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey
                });
            })
            .then(subscription => {
                if (!subscription) return;
                return fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: subscription,
                        refreshed: true
                    })
                });
            })
            .catch(err => {
                console.error('Error during pushsubscriptionchange:', err);
            })
    );
});

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
