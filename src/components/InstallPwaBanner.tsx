import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, Smartphone, CheckCircle, X, Bell } from 'lucide-react';
import { requestPushPermissionAndSaveToken, isPushNotificationSupported } from '../utils/pushNotificationService';
import { useApp } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallPwaBanner: React.FC<{ variant?: 'banner' | 'button' | 'compact' }> = ({ variant = 'banner' }) => {
  const { currentUser } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    // 1. Détection mode Standalone (déjà installé sur l'écran d'accueil)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Détection iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isAppleDevice);

    // 3. Écoute de l'événement beforeinstallprompt (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Si ouvert en mode PWA / Standalone, déclencher automatiquement la permission des notifications push
    if (standalone && isPushNotificationSupported() && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        const userId = currentUser?.id || currentUser?.member?.id || (currentUser?.adminRole as string) || 'member';
        requestPushPermissionAndSaveToken(userId, currentUser?.type || 'MEMBER', currentUser?.member?.id)
          .then((res) => {
            if (res.success) {
              setPushStatus('Notifications Push Web activées !');
            }
          })
          .catch(() => {});
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [currentUser]);

  // Si l'application est déjà installée et fonctionne en standalone, ne pas afficher la bannière d'installation
  if (isStandalone) {
    return null;
  }

  // Si l'utilisateur a fermé la bannière temporairement
  if (isDismissed && variant === 'banner') {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          // Demande de permission push
          const userId = currentUser?.id || currentUser?.member?.id || 'member';
          requestPushPermissionAndSaveToken(userId, currentUser?.type || 'MEMBER', currentUser?.member?.id).catch(() => {});
        }
      } catch (err) {
        console.warn('Erreur prompt PWA:', err);
      } finally {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback si pas de deferredPrompt disponible (ex: desktop ou Safari macOS)
      setShowIosGuide(true);
    }
  };

  // Bouton compact (pour barre de navigation / header / profil)
  if (variant === 'button' || variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-[#E67E22] hover:from-amber-400 hover:to-[#D35400] text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 border border-amber-300"
          title="Installer l'application sur votre écran d'accueil"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Installer l'App</span>
        </button>

        {showIosGuide && <IosInstallModal onClose={() => setShowIosGuide(false)} />}
      </>
    );
  }

  // Bannière d'installation complète
  return (
    <>
      <div className="bg-gradient-to-r from-emerald-900 via-forest-moss to-emerald-950 text-white border border-amber-400/40 rounded-2xl p-3.5 sm:p-4 shadow-xl mb-4 relative overflow-hidden">
        {/* Glow décoratif */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0 border border-amber-200">
              <Smartphone className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm sm:text-base text-amber-200 uppercase tracking-wide">
                  Installer l'application E-ROUAMA
                </h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  PWA Mobile
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium mt-0.5 max-w-xl">
                Accédez à votre espace en 1 clic depuis votre écran d’accueil et recevez toutes les notifications push en direct (cotisations, PV, alertes).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-[#E67E22] hover:from-amber-300 hover:to-[#D35400] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-transform active:scale-95 border border-amber-200"
            >
              <Download className="w-4 h-4" />
              <span>Installer maintenant</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 text-emerald-300 hover:text-white hover:bg-emerald-800/60 rounded-xl transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pushStatus && (
          <div className="mt-2.5 pt-2 border-t border-emerald-800/60 flex items-center gap-2 text-xs text-amber-300 font-bold">
            <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>{pushStatus}</span>
          </div>
        )}
      </div>

      {showIosGuide && <IosInstallModal onClose={() => setShowIosGuide(false)} />}
    </>
  );
};

// Modale d'instructions détaillées pour iOS Safari & Android
const IosInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <Smartphone className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-300 uppercase tracking-wide">
              Installer sur iPhone / iPad
            </h3>
            <p className="text-xs text-slate-300">Instructions simples Apple Safari</p>
          </div>
        </div>

        <div className="space-y-4 my-6 bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div>
              <p className="font-bold text-white flex items-center gap-1.5">
                Appuyez sur l'icône de <span className="text-amber-300 inline-flex items-center gap-1"><Share className="w-4 h-4 inline" /> Partage</span>
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Située dans la barre de navigation Safari (en bas sur iPhone, en haut sur iPad).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p className="font-bold text-white flex items-center gap-1.5">
                Sélectionnez <span className="text-amber-300 inline-flex items-center gap-1"><PlusSquare className="w-4 h-4 inline" /> « Sur l'écran d'accueil »</span>
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Faites défiler le menu de partage vers le bas pour trouver l'option.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div>
              <p className="font-bold text-white flex items-center gap-1.5">
                Appuyez sur <span className="text-amber-300 font-black">« Ajouter »</span> en haut à droite
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5">
                L'icône E-ROUAMA apparaîtra directement sur votre écran d'accueil avec vos applications favorites.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-200 text-xs">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="leading-tight">
            Une fois ouverte depuis votre écran d’accueil, l’application vous proposera d’activer les <strong>notifications push instantanées</strong>.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg active:scale-95"
          >
            C'est compris !
          </button>
        </div>
      </div>
    </div>
  );
};
