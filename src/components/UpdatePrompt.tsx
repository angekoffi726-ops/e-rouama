import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export const UpdatePrompt: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      // 1. Envoyer le message SKIP_WAITING au nouveau Service Worker en attente
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Nettoyer les anciens caches pour garantir le rafraîchissement complet
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        } catch (cacheErr) {
          console.debug('Nettoyage cache Service Worker:', cacheErr);
        }
      }

      // Petit délai pour laisser le service worker s'activer
      setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (err) {
      console.warn('Erreur mise à jour:', err);
      window.location.reload();
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;

    // Écoute de l'événement controllerchange (lorsque le nouveau Service Worker prend le contrôle)
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Fonction de surveillance de l'enregistrement du Service Worker
    const trackInstalling = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          // Un nouveau Service Worker est installé et attend d'être activé
          setWaitingWorker(worker);
          setHasUpdate(true);
        }
      });
    };

    const registerOrCheck = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // 1. Si un worker est déjà en attente
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setHasUpdate(true);
          }

          // 2. Si un worker est en cours d'installation
          if (registration.installing) {
            trackInstalling(registration.installing);
          }

          // 3. Écoute de nouvelles versions détectées (onupdatefound)
          registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
              trackInstalling(newWorker);
            }
          };

          // 4. Vérification périodique des mises à jour sur le serveur (ex: déploiement Vercel)
          const intervalId = setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 1000); // Toutes les 60 secondes

          // Vérifier également lorsque l'utilisateur revient sur l'onglet ou se reconnecte
          const handleFocus = () => {
            registration.update().catch(() => {});
          };
          window.addEventListener('focus', handleFocus);
          window.addEventListener('online', handleFocus);

          return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleFocus);
          };
        }
      } catch (err) {
        console.debug('Service Worker update track note:', err);
      }
    };

    registerOrCheck();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!hasUpdate) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[9999] max-w-sm w-[calc(100vw-2.5rem)] animate-bounce-short"
    >
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white p-4 sm:p-4.5 rounded-2xl shadow-2xl border-2 border-amber-400/80 backdrop-blur-md flex items-center justify-between gap-3 relative overflow-hidden">
        {/* Glow décoratif */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-[#E67E22] text-slate-950 flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-5 h-5 text-slate-950 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide truncate">
              Mise à jour disponible !
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-200 font-medium leading-tight">
              Une nouvelle version d'E-ROUAMA est disponible !
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative z-10">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-[#E67E22] hover:from-amber-300 hover:to-[#D35400] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform active:scale-95 border border-amber-200 cursor-pointer disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Chargement...' : 'Mettre à jour'}</span>
          </button>

          <button
            type="button"
            onClick={() => setHasUpdate(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Ignorer pour l'instant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
