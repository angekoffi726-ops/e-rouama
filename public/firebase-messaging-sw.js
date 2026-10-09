/* eslint-disable no-undef */
// Service Worker Firebase Cloud Messaging officiel E-ROUAMA (Web Push style Wave / WhatsApp)

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

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

  // Écouteur des notifications en arrière-plan lorsque l'application est fermée ou minimisée
  messaging.onBackgroundMessage((payload) => {
    console.log('[E-ROUAMA SW] Notification reçue en arrière-plan:', payload);

    const title = payload.notification?.title || payload.data?.title || 'E-ROUAMA : Nouvelle Notification';
    const body = payload.notification?.body || payload.data?.body || 'Vous avez reçu un nouveau message sur E-ROUAMA.';
    const icon = payload.notification?.icon || payload.data?.icon || '/LOGOPRO.png';
    const badge = '/LOGOPRO.png';
    const tag = payload.data?.tag || ('erouama-push-' + Date.now());

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: badge,
      tag: tag,
      vibrate: [300, 150, 300, 150, 400],
      requireInteraction: true,
      data: {
        url: payload.data?.url || payload.fcmOptions?.link || '/',
        ...payload.data
      },
      actions: [
        { action: 'open', title: 'Ouvrir E-ROUAMA' }
      ]
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.warn('[E-ROUAMA SW] Initialisation Firebase Messaging compat non supportée:', err);
}

// Écouteur natif d'événements Push (Web Push standard)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || data.notification?.title || 'E-ROUAMA';
    const body = data.body || data.notification?.body || 'Nouvelle mise à jour disponible.';
    const icon = data.icon || data.notification?.icon || '/LOGOPRO.png';
    const tag = data.tag || ('erouama-webpush-' + Date.now());

    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: '/LOGOPRO.png',
        tag: tag,
        vibrate: [300, 150, 300],
        requireInteraction: true,
        data: data.data || { url: '/' }
      })
    );
  } catch (e) {
    const rawText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('E-ROUAMA', {
        body: rawText,
        icon: '/LOGOPRO.png',
        badge: '/LOGOPRO.png',
        vibrate: [200, 100, 200]
      })
    );
  }
});

// Écouteur de clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si une fenêtre est déjà ouverte, la focaliser
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (client.url && client.navigate) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Écouteur de messages inter-fenêtres / foreground trigger et SKIP_WAITING
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
      icon: icon || '/LOGOPRO.png',
      badge: '/LOGOPRO.png',
      tag: tag || ('erouama-msg-' + Date.now()),
      vibrate: [300, 150, 300],
      data: data || { url: '/' }
    });
  }
});

// Activation et prise de contrôle immédiate
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
