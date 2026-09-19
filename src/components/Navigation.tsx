import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, Church, CreditCard, Newspaper, Tent, Rocket, FileText, Shield } from 'lucide-react';

export type TabType = 'DASHBOARD' | 'PRIERE_ROUAMA' | 'FINANCES' | 'NOUVELLES' | 'ACTIVITES' | 'PROJETS' | 'ARCHIVES' | 'ADMIN_CONSOLE';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, gbairaiMessages, newsItems, getMemberDuesStatus } = useApp();

  if (!currentUser) return null;

  const isAdmin = currentUser?.type === 'ADMIN';
  const currentUserId = currentUser?.member?.id || currentUser?.id || (isAdmin ? currentUser.adminRole : undefined);
  const isMember = currentUser?.type === 'MEMBER';
  const memberDuesStatus = currentUserId && isMember && getMemberDuesStatus ? getMemberDuesStatus(currentUserId) : 'RETARD';

  const rawMessages = gbairaiMessages || newsItems || [];

  // Messages actifs réellement visibles pour l'utilisateur
  const currentNick = currentUser?.member?.nickname || currentUser?.nickname;
  const activeGbairaiMessages = rawMessages.filter(msg => {
    if (msg.dispatchChannel === 'MAIL') return false;

    // Filtrage strict par targetMemberIds (Ciblage des destinataires)
    const isSpecificallyTargeted = Boolean(
      msg.targetMemberIds &&
      !msg.targetMemberIds.includes('ALL') &&
      ((currentUserId && msg.targetMemberIds.includes(currentUserId)) ||
       (currentUser?.id && msg.targetMemberIds.includes(currentUser.id)))
    );

    if (msg.targetMemberIds && msg.targetMemberIds.length > 0) {
      const isForEveryone = msg.targetMemberIds.includes('ALL');
      if (!isForEveryone && isMember && !isSpecificallyTargeted) {
        return false;
      }
    }

    // Filtrage strict par excludedMemberIds (Auteur / payeur masqué pour lui-même)
    if (msg.excludedMemberIds && msg.excludedMemberIds.length > 0) {
      if (currentUser?.id && msg.excludedMemberIds.includes(currentUser.id)) return false;
      if (currentUserId && msg.excludedMemberIds.includes(currentUserId)) return false;
    }

    // Masquage de courtoisie si l'utilisateur est le payeur (alerte générale de paiement)
    if (!isSpecificallyTargeted) {
      if (currentUser?.id && msg.payerId && String(msg.payerId) === String(currentUser.id)) return false;
      if (currentUserId && msg.payerId && String(msg.payerId) === String(currentUserId)) return false;
      
      const memberNamesToCheck = [
        currentNick,
        currentUser?.member?.firstName,
        currentUser?.member?.nickname,
        currentUser?.firstName,
        (currentUser as any)?.nickname,
      ].filter(Boolean) as string[];

      const isPaymentAnnouncement =
        (msg.category === 'ALERTE' || msg.category === 'ANNONCE') &&
        (msg.content?.includes("vient de s'acquitter") || msg.content?.includes("vient d'effectuer un versement"));

      if (isPaymentAnnouncement) {
        if (memberNamesToCheck.some(name => msg.content?.includes(name) || msg.title?.includes(name))) {
          return false;
        }
      }
    }

    if (currentUserId && msg.dismissedBy && msg.dismissedBy.includes(currentUserId)) return false;
    if (isMember) {
      if (msg.targetAudience === 'TOUS') return true;
      if (msg.targetAudience === memberDuesStatus) return true;
      return false;
    }
    return true;
  });

  // Comptage dynamique basé strictement sur les messages actifs non lus provenant de Firestore
  const unreadGbairaiCount = currentUserId
    ? activeGbairaiMessages.filter(msg => !(msg.readBy || []).includes(currentUserId) && !(currentUser?.id && (msg.readBy || []).includes(currentUser.id))).length
    : 0;

  const navItems = [
    {
      id: 'DASHBOARD' as TabType,
      label: 'ACCUEIL',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'PRIERE_ROUAMA' as TabType,
      label: 'PRIÈRE ROUAMA',
      icon: Church,
      badge: null,
    },
    {
      id: 'FINANCES' as TabType,
      label: 'DJAÏ',
      icon: CreditCard,
      badge: null,
    },
    {
      id: 'NOUVELLES' as TabType,
      label: 'GBAÏRAÏ',
      icon: Newspaper,
      badge: unreadGbairaiCount > 0 ? unreadGbairaiCount : null,
    },
    {
      id: 'ACTIVITES' as TabType,
      label: 'SHOW',
      icon: Tent,
      badge: null,
    },
    {
      id: 'PROJETS' as TabType,
      label: 'GAGNE PAIN',
      icon: Rocket,
      badge: null,
    },
    {
      id: 'ARCHIVES' as TabType,
      label: 'GRENIER',
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

                {item.badge !== null && item.badge > 0 && (
                  <span className="badge-notification w-5 h-5 rounded-full bg-warm-sunset text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow">
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
