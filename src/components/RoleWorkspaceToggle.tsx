import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, User, ArrowLeftRight } from 'lucide-react';
import { getDefaultRolesForMember, OFFICIAL_DEPARTMENTS } from '../data/departmentMapping';

export const RoleWorkspaceToggle: React.FC<{ compact?: boolean; className?: string }> = ({
  className = '',
}) => {
  const { currentUser, switchWorkspace } = useApp();

  if (!currentUser) return null;

  // Récupérer les rôles et départements du membre
  const memberId = currentUser.member?.id || currentUser.id;
  const memberFirstName = currentUser.member?.firstName || currentUser.firstName;
  const memberNickname = currentUser.member?.nickname || currentUser.nickname;

  const defaultMeta = memberId
    ? getDefaultRolesForMember(memberId, memberFirstName, memberNickname)
    : { roles: ['membre'], departments: [], adminRole: undefined };

  const userRoles = currentUser.roles || currentUser.member?.roles || defaultMeta.roles || [];
  const userDepts = currentUser.departments || currentUser.member?.departments || defaultMeta.departments || [];

  // Est-ce que cet utilisateur a une responsabilité administrative / département ?
  const hasAdminPrivileges =
    currentUser.type === 'ADMIN' ||
    userRoles.some((r) => r !== 'membre') ||
    userDepts.length > 0 ||
    Boolean(currentUser.adminRole || currentUser.member?.assignedRole || defaultMeta.adminRole);

  if (!hasAdminPrivileges) {
    return null;
  }

  const isCurrentlyAdminView =
    currentUser.activeView === 'ADMIN' ||
    (currentUser.type === 'ADMIN' && currentUser.activeView !== 'MEMBER');

  const effectiveRole =
    currentUser.adminRole ||
    currentUser.member?.assignedRole ||
    defaultMeta.adminRole ||
    'SDP';

  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-950/80 border border-amber-400/50 rounded-2xl shadow-lg backdrop-blur-md gap-1 ${className}`}
      role="group"
      aria-label="Commutateur d'espace"
    >
      {/* Bouton 1 : 👤 Espace Membre */}
      <button
        type="button"
        onClick={() => switchWorkspace('MEMBER')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
          !isCurrentlyAdminView
            ? 'bg-gradient-to-r from-amber-400 to-[#E67E22] text-slate-950 shadow-md border border-amber-300 font-black'
            : 'text-amber-100 hover:text-white hover:bg-white/10 opacity-80'
        }`}
        title="Accéder à l'Espace Membre"
      >
        <User className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">👤 Espace Membre</span>
      </button>

      {/* Bouton 2 : 🛡️ Espace Admin */}
      <button
        type="button"
        onClick={() => switchWorkspace('ADMIN', effectiveRole)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
          isCurrentlyAdminView
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400 font-black'
            : 'text-emerald-200 hover:text-white hover:bg-white/10 opacity-80'
        }`}
        title="Accéder à l'Espace Administration"
      >
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">🛡️ Espace Admin</span>
      </button>
    </div>
  );
};
