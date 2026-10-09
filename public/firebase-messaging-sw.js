/* eslint-disable no-undef */
// Service Worker Firebase Cloud Messaging officiel E-ROUAMA
// Notifications Push en arrière-plan (Background PWA / Android)

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Configuration Firebase E-ROUAMA
const firebaseConfig = {
  apiKey: "AIzaSyCxEO6-cd0Bld5FKxBE8j8KNoP9c7PeNI4",
  authDomain: "e-rouama-f735a.firebaseapp.com",
  projectId: "e-rouama-f735a",
  storageBucket: "e-rouama-f735a.firebasestorage.app",
  messagingSenderId: "700309956720",
  appId: "1:700309956720:web:5dc3242ea580b5f39fecb5"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

// Écouteur de messages en arrière-plan FCM
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Push reçu en arrière-plan:', payload);
    const title = payload.notification?.title || payload.data?.title || 'E-ROUAMA';
    const options = {
      body: payload.notification?.body || payload.data?.body || '',
      icon: payload.notification?.icon || '/icon-192.png',
      badge: payload.notification?.badge || '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: payload.notification?.tag || payload.data?.tag || 'erouama-push',
      requireInteraction: true,
      data: payload.data || { click_action: '/' }
    };
    return self.registration.showNotification(title, options);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Erreur initialisation Firebase Messaging:', err);
}

// Écouteur natif d'événements Push (Web Push standard / Android background fallback)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Push reçu:', payload);
    const title = payload.notification?.title || payload.webpush?.notification?.title || payload.data?.title || payload.title || 'E-ROUAMA';
    const body = payload.notification?.body || payload.webpush?.notification?.body || payload.data?.body || payload.body || '';
    const icon = payload.notification?.icon || payload.webpush?.notification?.icon || '/icon-192.png';
    const badge = payload.notification?.badge || payload.webpush?.notification?.badge || '/icon-192.png';
    const tag = payload.notification?.tag || payload.webpush?.notification?.tag || payload.data?.tag || 'erouama-push';

    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: [200, 100, 200],
        tag: tag,
        requireInteraction: true,
        data: payload.data || { click_action: payload.webpush?.fcm_options?.link || '/' }
      })
    );
  } catch (e) {
    const rawText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('E-ROUAMA', {
        body: rawText,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'erouama-push',
        requireInteraction: true,
        data: { click_action: '/' }
      })
    );
  }
});

// Écouteur de clic sur la notification (redirige l'utilisateur vers la PWA)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.click_action || event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (client.url && client.navigate) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Écouteur SKIP_WAITING et messages inter-processus
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data;
    self.registration.showNotification(title || 'E-ROUAMA', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'erouama-push',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: data || { click_action: '/' }
    });
  }
});

// Installation et activation immédiate
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
