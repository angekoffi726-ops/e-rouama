import React, { Component, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/AuthScreen';
import { DashboardTab } from './components/tabs/DashboardTab';
import { FinancesTab } from './components/tabs/FinancesTab';
import { NouvellesTab } from './components/tabs/NouvellesTab';
import { ActivitesTab } from './components/tabs/ActivitesTab';
import { ProjetsTab } from './components/tabs/ProjetsTab';
import { ArchivesTab } from './components/tabs/ArchivesTab';
import { AdminPortal } from './components/admin/AdminPortal';
import { TabType } from './components/Navigation';
import { LayoutDashboard, CreditCard, Newspaper, Tent, Rocket, FileText, Download, LogOut } from 'lucide-react';
import { ADMIN_USERS } from './data/membersData';

function MainLayout() {
  const { currentUser, logout, members, newsItems } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [targetDocId, setTargetDocId] = useState<string | undefined>(undefined);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  React.useEffect(() => {
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

  const handleNavigateTab = (tab: TabType, docId?: string) => {
    setActiveTab(tab);
    if (docId) {
      setTargetDocId(docId);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        "Pour installer E-ROUAMA :\n- Sur Chrome/Android : Appuyez sur le menu (⋮) puis 'Ajouter à l'écran d'accueil'.\n- Sur Safari/iOS : Appuyez sur Partager (⎋) puis 'Sur l'écran d'accueil'."
      );
    }
  };

  // 1. SI PAS DE CONNECTÉ : AFFICHER DIRECTEMENT L'ÉCRAN DE CONNEXION / INSCRIPTION
  if (!currentUser) {
    return <AuthScreen />;
  }

  const registeredCount = members ? members.filter(m => m.isRegistered).length : 0;
  const totalMembers = members ? members.length : 13;

  const isMember = currentUser?.type === 'MEMBER' && !!currentUser?.member;
  const isAdmin = currentUser?.type === 'ADMIN' && !!currentUser?.adminRole;

  // 2. VUE ADMIN DIRECTE
  if (isAdmin) {
    const adminRoleDef = ADMIN_USERS.find(a => a.id === currentUser?.adminRole);
    return (
      <div className="min-h-screen bg-[#F5EEDC] flex flex-col font-sans text-slate-800 selection:bg-[#E67E22] selection:text-white">
        <header className="bg-[#E67E22] border-b border-[#D35400] text-white px-4 sm:px-8 py-4 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-200 bg-white p-0 shrink-0 shadow-sm">
                <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" className="w-full h-full object-cover p-0" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">E-ROUAMA</h1>
              <span className="bg-slate-900 text-amber-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-amber-300/30">
                🛡️ CONSOLE ADMIN : {adminRoleDef?.roleName || currentUser?.adminRole}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-100 italic mt-0.5">
              « DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »
            </p>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-2 px-4 py-2 bg-[#355E3B] hover:bg-[#2A4B2F] text-white rounded-full font-extrabold text-xs shadow-md transition-all active:scale-95 border border-emerald-400/30"
              >
                <Download className="w-4 h-4" />
                <span>Installer l'App</span>
              </button>
            )}

            <button
              onClick={() => logout()}
              className="flex items-center space-x-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-full text-xs font-bold transition-colors shadow-md border border-rose-500/30 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AdminPortal />
        </main>

        <footer className="bg-[#355E3B] text-white/90 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between text-[11px] font-extrabold uppercase tracking-wider gap-2 border-t border-emerald-800">
          <div className="flex items-center space-x-3">
            <span className="bg-[#E67E22] text-white px-3 py-1 rounded-full text-[11px] font-black shadow-sm tracking-widest border border-amber-300/30">
              MEMBRES INSCRITS SUR L'APP : {registeredCount} / {totalMembers}
            </span>
            <span className="text-white/40">•</span>
            <span className="text-amber-200">E-ROUAMA 2026</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-emerald-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Console Administrateur Privée & Sécurisée</span>
          </div>
        </footer>
      </div>
    );
  }

  // 3. VUE MEMBRE CONNECTÉ
  const memberNickname = currentUser?.member?.nickname || currentUser?.member?.name || 'MEMBRE';
  const memberFirstName = currentUser?.member?.firstName || currentUser?.member?.name || '';
  const userAvatar = currentUser?.member?.avatar ||
    (memberNickname.toUpperCase() === 'CAPELO' || memberFirstName.toUpperCase() === 'WILFRIED'
      ? '/PP-CAPELO.jpeg'
      : undefined);

  const memberId = currentUser?.member?.id;
  const unreadNewsCount = memberId
    ? (newsItems || []).filter(n => !(n?.readBy || []).includes(memberId)).length
    : (newsItems || []).length;

  const navItems = [
    { id: 'DASHBOARD' as TabType, label: '📊 TABLEAU DE BORD', icon: LayoutDashboard, badge: null },
    { id: 'FINANCES' as TabType, label: '💳 FINANCES', icon: CreditCard, badge: null },
    { id: 'NOUVELLES' as TabType, label: '📰 NOUVELLES', icon: Newspaper, badge: unreadNewsCount > 0 ? unreadNewsCount : null },
    { id: 'ACTIVITES' as TabType, label: '⛺ ACTIVITÉS', icon: Tent, badge: null },
    { id: 'PROJETS' as TabType, label: '🚀 PROJETS', icon: Rocket, badge: null },
    { id: 'ARCHIVES' as TabType, label: '📑 ARCHIVES', icon: FileText, badge: null },
  ];

  return (
    <div className="min-h-screen bg-[#F5EEDC] flex flex-col font-sans text-slate-800 selection:bg-[#E67E22] selection:text-white">
      <header className="bg-[#E67E22] text-white border-b border-[#D35400] px-4 sm:px-8 py-4 sm:py-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-200 bg-white p-0 shrink-0 shadow-sm">
            <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" className="w-full h-full object-cover p-0" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">E-ROUAMA</h1>
            <p className="text-[11px] sm:text-xs text-amber-100 font-medium italic">
              « DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »
            </p>
          </div>
        </div>

        <div className="bg-black/20 backdrop-blur-sm px-5 py-2.5 rounded-[2rem] border border-white/20 flex items-center gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt={memberNickname} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#355E3B] text-white flex items-center justify-center font-black text-lg border-2 border-white shadow-md shrink-0">
              {memberNickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-[10px] text-amber-200 uppercase font-extrabold tracking-wider">MEMBRE CONNECTÉ</div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-wide">{memberNickname}</div>
          </div>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center space-x-2 px-4 sm:px-5 py-2.5 bg-[#355E3B] hover:bg-[#2A4B2F] text-white rounded-[2rem] font-extrabold text-xs sm:text-sm shadow-md active:scale-95 transition-all border border-emerald-300/30"
            >
              <Download className="w-4 h-4" />
              <span>Installer l'App</span>
            </button>
          )}

          <button
            onClick={logout}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-[2rem] text-xs sm:text-sm font-black transition-colors shadow-md border border-rose-500/30 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </header>

      <nav className="bg-[#E67E22]/95 border-b border-[#D35400] px-4 sm:px-8 py-3 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-black text-xs sm:text-sm transition-all whitespace-nowrap active:scale-95 shadow-sm ${
                  isActive
                    ? 'bg-[#355E3B] text-white border-2 border-emerald-300/50 shadow-lg scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge !== null && (
                  <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse border border-white/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'DASHBOARD' && <DashboardTab onNavigateTab={setActiveTab} />}
        {activeTab === 'FINANCES' && <FinancesTab />}
        {activeTab === 'NOUVELLES' && <NouvellesTab onNavigateTab={handleNavigateTab} />}
        {activeTab === 'ACTIVITES' && <ActivitesTab />}
        {activeTab === 'PROJETS' && <ProjetsTab />}
        {activeTab === 'ARCHIVES' && <ArchivesTab highlightedDocId={targetDocId} />}
      </main>

      <footer className="bg-[#355E3B] text-white/90 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between text-[11px] font-extrabold uppercase tracking-wider gap-2 border-t border-emerald-800">
        <div className="flex items-center space-x-3">
          <span className="bg-[#E67E22] text-white px-3.5 py-1 rounded-full text-[11px] font-black shadow-sm tracking-widest border border-amber-300/30">
            MEMBRES INSCRITS SUR L'APP : {registeredCount} / {totalMembers}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-amber-200">E-ROUAMA 2026</span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-emerald-100">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Espace Fraternel d'Échanges & d'Entraide</span>
        </div>
      </footer>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error during render:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5EEDC] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md shadow-2xl border border-rose-200 space-y-4">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-slate-900">Transition de Vue Protégée</h2>
            <p className="text-xs text-slate-600 font-medium">
              Une anomalie d'affichage est survenue. Cliquez sur le bouton ci-dessous pour réinitialiser la session en toute sécurité.
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg transition-all text-sm active:scale-95"
            >
              Recharger l'Application E-ROUAMA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
