import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APP_VERSION } from './version.ts';

// Gestion du Cache et Invalideur de Version (PWA / Browser Cache)
if (typeof window !== 'undefined') {
  const VERSION_STORAGE_KEY = 'erouama_app_version';
  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (storedVersion && storedVersion !== APP_VERSION) {
    console.log(`🚀 [E-ROUAMA] Mise à jour déployée détectée : ${storedVersion} -> ${APP_VERSION}`);
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);

    // Invalider immédiatement les caches du navigateur pour charger les nouveaux actifs Vercel
    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      }).then(() => {
        console.log('🧹 [E-ROUAMA] Caches obsolètes purgés avec succès.');
      }).catch((e) => console.warn('Cache purge note:', e));
    }
  } else if (!storedVersion) {
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
  }

  // Enregistrement immédiat du Service Worker au démarrage de la PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // updateViaCache: 'none' force le navigateur à vérifier directement sur Vercel sans cache HTTP
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          console.log(`✅ Service Worker E-ROUAMA v${APP_VERSION} actif (Scope: ${reg.scope})`);
          // Forcer une vérification de mise à jour dès le chargement
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('⚠️ Service Worker note:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

