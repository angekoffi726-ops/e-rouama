/* eslint-disable no-undef */
// Service Worker Firebase Cloud Messaging officiel E-ROUAMA
// Notifications Push Système Natives (Volet / Bannière Android) avec Anti-Doublon et Filtrage des Messages Supprimés

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

// Cache d'horodatage pour éviter les doubles déclenchements simultanés (push + onBackgroundMessage dans la même seconde)
const lastShownTimestamps = new Map();

function isImmediateDuplicate(tag) {
  if (!tag) return false;
  const now = Date.now();
  const lastTime = lastShownTimestamps.get(tag);
  if (lastTime && now - lastTime < 1500) {
    return true;
  }
  lastShownTimestamps.set(tag, now);
  if (lastShownTimestamps.size > 200) {
    for (const [k, t] of lastShownTimestamps.entries()) {
      if (now - t > 30000) lastShownTimestamps.delete(k);
    }
  }
  return false;
}

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Écouteur FCM en arrière-plan : FORCER L'AFFICHAGE DU BANNER SYSTÈME ANDROID
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Push reçu en arrière-plan:', payload);

    // 1. Ignorer explicitement les messages supprimés
    if (
      payload.data?.deleted === true ||
      payload.data?.deleted === 'true' ||
      payload.data?.status === 'deleted'
    ) {
      console.log('[firebase-messaging-sw.js] Message supprimé ignoré');
      return;
    }

    const title = payload.notification?.title || payload.data?.title || 'E-ROUAMA';
    const body = payload.notification?.body || payload.data?.body || '';

    // ID unique basé sur l'ID du message pour écraser les doublons au lieu de les cumuler
    const notificationTag =
      payload.data?.messageId ||
      payload.data?.id ||
      payload.notification?.tag ||
      payload.data?.tag ||
      'erouama-single-tag';

    if (isImmediateDuplicate(notificationTag)) {
      console.log('[firebase-messaging-sw.js] Doublon immédiat ignoré:', notificationTag);
      return;
    }

    return self.registration.showNotification(title, {
      body: body,
      icon: payload.notification?.icon || '/icon-192.png',
      badge: payload.notification?.badge || '/icon-192.png',
      tag: notificationTag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: payload.data || { click_action: payload.webpush?.fcm_options?.link || '/' }
    });
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Erreur initialisation Firebase Messaging:', err);
}

// Écouteur natif d'événements Push (Web Push standard / Android background fallback)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      try {
        let payload = null;
        try {
          payload = event.data.json();
        } catch (_) {
          const rawText = event.data.text();
          payload = { notification: { title: 'E-ROUAMA', body: rawText } };
        }

        console.log('[firebase-messaging-sw.js] Push natif reçu:', payload);

        // Ignorer explicitement les messages supprimés
        if (
          payload.data?.deleted === true ||
          payload.data?.deleted === 'true' ||
          payload.data?.status === 'deleted'
        ) {
          return;
        }

        const notificationTag =
          payload.data?.messageId ||
          payload.data?.id ||
          payload.notification?.tag ||
          payload.webpush?.notification?.tag ||
          payload.data?.tag ||
          'erouama-single-tag';

        if (isImmediateDuplicate(notificationTag)) {
          return;
        }

        const title =
          payload.notification?.title ||
          payload.webpush?.notification?.title ||
          payload.data?.title ||
          payload.title ||
          'E-ROUAMA';

        const body =
          payload.notification?.body ||
          payload.webpush?.notification?.body ||
          payload.data?.body ||
          payload.body ||
          '';

        const icon =
          payload.notification?.icon ||
          payload.webpush?.notification?.icon ||
          '/icon-192.png';

        const badge =
          payload.notification?.badge ||
          payload.webpush?.notification?.badge ||
          '/icon-192.png';

        await self.registration.showNotification(title, {
          body: body,
          icon: icon,
          badge: badge,
          tag: notificationTag,
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200],
          data: payload.data || { click_action: payload.webpush?.fcm_options?.link || '/' }
        });
      } catch (e) {
        console.warn('[firebase-messaging-sw.js] Erreur push natif:', e);
      }
    })()
  );
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

// Écouteur SKIP_WAITING et messages inter-processus depuis le client
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data;
    const notificationTag = tag || data?.messageId || data?.id || 'erouama-single-tag';

    if (isImmediateDuplicate(notificationTag)) {
      return;
    }

    self.registration.showNotification(title || 'E-ROUAMA', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationTag,
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: data || { click_action: '/' }
    });
  }
});

// Installation et activation immédiate
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
