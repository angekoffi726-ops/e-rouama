/**
 * E-ROUAMA Version Invalidator & Cache Configuration
 * Date: 2026.10.22
 * Utilisé pour invalider automatiquement le cache PWA / Vercel
 * et forcer le rechargement des derniers bundles JS/CSS et données Firestore.
 */
export const APP_VERSION = '2026.10.22.2';
export const APP_BUILD_TIMESTAMP = '2026-10-22T14:00:00Z';

if (typeof window !== 'undefined') {
  (window as any).__APP_VERSION__ = APP_VERSION;
  (window as any).__APP_BUILD_TIMESTAMP__ = APP_BUILD_TIMESTAMP;
}

