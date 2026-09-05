import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, CreditCard, Newspaper, Tent, Rocket, FileText, Shield } from 'lucide-react';

export type TabType = 'DASHBOARD' | 'FINANCES' | 'NOUVELLES' | 'ACTIVITES' | 'PROJETS' | 'ARCHIVES' | 'ADMIN_CONSOLE';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, newsItems } = useApp();

  if (!currentUser) return null;

  const isAdmin = currentUser?.type === 'ADMIN';
  const memberId = currentUser?.member?.id;

  // Unread news count for member
  const unreadNewsCount = memberId
    ? newsItems.filter(n => !n.readBy.includes(memberId)).length
    : newsItems.length;

  const navItems = [
    {
      id: 'DASHBOARD' as TabType,
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'FINANCES' as TabType,
      label: 'Finances',
      icon: CreditCard,
      badge: null,
    },
    {
      id: 'NOUVELLES' as TabType,
      label: 'Nouvelles',
      icon: Newspaper,
      badge: unreadNewsCount > 0 ? unreadNewsCount : null,
    },
    {
      id: 'ACTIVITES' as TabType,
      label: 'Activités',
      icon: Tent,
      badge: null,
    },
    {
      id: 'PROJETS' as TabType,
      label: 'Projets AGR',
      icon: Rocket,
      badge: null,
    },
    {
      id: 'ARCHIVES' as TabType,
      label: 'Archives',
      icon: FileText,
      badge: null,
    },
  ];

  return (
    <nav className="sticky top-[73px] z-30 bg-soft-wood/95 backdrop-blur-md pt-3 pb-2 px-4 border-b border-emerald-900/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-2 sm:gap-3 min-w-max mx-auto sm:mx-0">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-forest-moss text-amber-300 shadow-md border border-emerald-700'
                    : 'bg-white/80 hover:bg-white text-forest-moss border border-emerald-800/10 hover:border-emerald-800/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-forest-moss'}`} />
                <span>{item.label}</span>

                {item.badge !== null && (
                  <span className="w-5 h-5 rounded-full bg-warm-sunset text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* If user logged in as Admin, show direct Console Admin tab button */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('ADMIN_CONSOLE')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 ${
              activeTab === 'ADMIN_CONSOLE'
                ? 'bg-amber-600 text-white shadow-lg border border-amber-500'
                : 'bg-amber-100/90 hover:bg-amber-200 text-amber-900 border border-amber-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Console Admin ({currentUser.adminRole})</span>
          </button>
        )}
      </div>
    </nav>
  );
};
