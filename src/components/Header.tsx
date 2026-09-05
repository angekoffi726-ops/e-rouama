import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Download, Shield, User } from 'lucide-react';
import { ADMIN_USERS } from '../data/membersData';

export const Header: React.FC<{ onOpenAdminModal?: () => void }> = ({ onOpenAdminModal }) => {
  const { currentUser, logout, members } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const registeredCount = members ? members.filter(m => m.isRegistered).length : 1;
  const totalMembers = members ? members.length : 13;

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('Pour installer E-ROUAMA :\n- Sur Chrome/Android : Appuyez sur le menu (⋮) puis "Ajouter à l\'écran d\'accueil".\n- Sur Safari/iOS : Appuyez sur Partager (⎋) puis "Sur l\'écran d\'accueil".');
    }
  };

  if (!currentUser) return null;

  const isMember = currentUser?.type === 'MEMBER' && !!currentUser?.member;
  const isAdmin = currentUser?.type === 'ADMIN' && !!currentUser?.adminRole;

  const nicknameDisplay = isMember
    ? currentUser?.member?.nickname || ''
    : isAdmin
    ? ADMIN_USERS.find(a => a.id === currentUser?.adminRole)?.roleName || currentUser?.adminRole || ''
    : '';

  const fullNameDisplay = isMember
    ? currentUser?.member?.fullRosterName || ''
    : 'Administrateur Système';

  return (
    <header className="sticky top-0 z-40 bg-forest-moss text-white shadow-xl rounded-b-[2rem] border-b border-emerald-800/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-300/60 bg-white p-0 shrink-0 shadow-sm">
              <img 
                src="/LOGOPRO.png" 
                alt="Logo E-ROUAMA" 
                className="w-full h-full object-cover p-0" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-wider text-amber-200 uppercase">
                  E-ROUAMA
                </h1>
                <span className="text-[10px] uppercase tracking-widest bg-[#E67E22] text-white font-black px-2.5 py-0.5 rounded-full border border-amber-300/30 shadow-sm">
                  {registeredCount} / {totalMembers} Inscrits
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100 font-medium italic opacity-90 max-w-md line-clamp-1">
                « DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »
              </p>
            </div>
          </div>

          {/* User Nickname Badge & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2.5 md:pt-0 border-emerald-800/60">
            {/* Prominent Nickname Display */}
            <div className="bg-emerald-900/90 border border-amber-300/40 rounded-2xl px-3.5 py-1.5 flex items-center gap-2 shadow-inner">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-forest-moss font-bold flex items-center justify-center text-sm shadow">
                {isMember ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-[10px] text-emerald-200 uppercase font-semibold tracking-wider">
                  {isMember ? 'Surnom Officiel' : 'Rôle Actif'}
                </p>
                <p className="text-sm sm:text-base font-extrabold text-amber-300 leading-tight">
                  {nicknameDisplay}
                </p>
              </div>
            </div>

            {/* Actions: Install PWA & Logout */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isInstalled && (
                <button
                  onClick={handleInstallClick}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  title="Installer l'application PWA"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Installer l'App</span>
                </button>
              )}

              {isAdmin && onOpenAdminModal && (
                <button
                  onClick={onOpenAdminModal}
                  className="bg-emerald-700 hover:bg-emerald-600 text-amber-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-emerald-500 transition-all shadow-sm active:scale-95"
                  title="Changer de rôle Administrateur"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Changer Rôle</span>
                </button>
              )}

              <button
                onClick={logout}
                className="bg-rose-600/90 hover:bg-rose-600 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-rose-400/30"
                title="Se Déconnecter"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
