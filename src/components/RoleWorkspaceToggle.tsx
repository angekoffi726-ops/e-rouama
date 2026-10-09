import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, User, ArrowLeftRight } from 'lucide-react';
import { getDefaultRolesForMember, OFFICIAL_DEPARTMENTS } from '../data/departmentMapping';

export const RoleWorkspaceToggle: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
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

  // Trouver le nom du département principal pour l'étiquette
  const effectiveRole =
    currentUser.adminRole ||
    currentUser.member?.assignedRole ||
    defaultMeta.adminRole ||
    'SDP';

  const deptConfig = OFFICIAL_DEPARTMENTS.find(
    (d) =>
      d.adminRole === effectiveRole ||
      userDepts.includes(d.key) ||
      (d.key === 'suivi_programme' && (effectiveRole === 'SDP' || userRoles.includes('cerveau')))
  );

  const deptLabel = deptConfig ? deptConfig.shortName : 'Administration';

  const handleToggle = () => {
    const nextView = isCurrentlyAdminView ? 'MEMBER' : 'ADMIN';
    switchWorkspace(nextView, effectiveRole);
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-md active:scale-95 border ${
          isCurrentlyAdminView
            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
            : 'bg-emerald-800 hover:bg-emerald-700 text-amber-200 border-emerald-500/60'
        } ${className}`}
        title={
          isCurrentlyAdminView
            ? 'Basculer vers l’Espace Membre'
            : `Basculer vers l’Espace Administration (${deptLabel})`
        }
      >
        <ArrowLeftRight className="w-3.5 h-3.5 animate-pulse" />
        <span>
          {isCurrentlyAdminView ? '👤 Vue Membre' : `🛡️ Espace ${deptLabel}`}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-950/70 border border-amber-400/50 rounded-2xl shadow-lg backdrop-blur-md ${className}`}
    >
      <button
        onClick={() => switchWorkspace('MEMBER')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
          !isCurrentlyAdminView
            ? 'bg-gradient-to-r from-amber-400 to-[#E67E22] text-slate-950 shadow-md scale-100'
            : 'text-emerald-200 hover:text-white hover:bg-white/5 opacity-80'
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span>Espace Membre</span>
      </button>

      <button
        onClick={() => switchWorkspace('ADMIN', effectiveRole)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
          isCurrentlyAdminView
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md scale-100'
            : 'text-emerald-200 hover:text-white hover:bg-white/5 opacity-80'
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Espace Admin ({deptLabel})</span>
      </button>
    </div>
  );
};
