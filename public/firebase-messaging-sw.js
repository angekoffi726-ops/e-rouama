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

// Versioning et stratégie de cache PWA (2026.10.22.1)
const APP_VERSION = '2026.10.22.1';
const CACHE_NAME = 'erouama-cache-v-' + APP_VERSION;

// Installation : forcer le nouveau Service Worker à devenir actif immédiatement
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Installation nouvelle version:', APP_VERSION);
  self.skipWaiting();
});

// Activation : suppression stricte de tous les anciens caches obsolètes et prise de contrôle
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Activation nouvelle version:', APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[firebase-messaging-sw.js] Invalidation ancien cache PWA:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de mise en cache HTTP / PWA :
// - HTML & Navigations : Network First avec timeout puis fallback cache
// - Actifs statiques locaux (JS/CSS versionnés, images) : StaleWhileRevalidate
// - Firestore / Firebase APIs / requêtes POST / PUT : Network Only direct (aucun cache)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorer les requêtes non-GET et les requêtes internes/externes Firebase
  if (req.method !== 'GET') return;
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('fcmregistrations.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('version.json')
  ) {
    return; // Laisser passer directement au réseau
  }

  // 1. Pour les requêtes de navigation (HTML index) : NETWORK FIRST STRICT
  // Garantit que le navigateur charge toujours le tout dernier index.html de Vercel
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      (async () => {
        try {
          // Tente le réseau avec timeout de 2.5 secondes
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const networkResponse = await fetch(req, {
            cache: 'no-cache',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, networkResponse.clone());
            return networkResponse;
          }
        } catch (_) {
          // Hors ligne ou échec réseau : retour de secours sur le cache
        }
        const cachedResponse = await caches.match(req);
        if (cachedResponse) return cachedResponse;
        const rootMatch = await caches.match('/index.html');
        if (rootMatch) return rootMatch;
        return fetch(req);
      })()
    );
    return;
  }

  // 2. Pour les actifs statiques locaux (assets JS/CSS hashés Vite) : StaleWhileRevalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

