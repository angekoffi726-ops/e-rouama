import React from 'react';

interface RbacWarningBannerProps {
  roleName: string;
  allowedActionsText: string;
}

export const RbacWarningBanner: React.FC<RbacWarningBannerProps> = ({
  roleName,
  allowedActionsText,
}) => {
  return (
    <div style={{ backgroundColor: '#0f172a', borderColor: '#f59e0b' }} className="w-full border border-amber-500/50 rounded-xl p-4 mb-6 shadow-lg flex items-center gap-3">
      <div className="text-2xl select-none">🔒</div>
      <div className="text-sm leading-relaxed">
        <span className="font-extrabold text-amber-400 block uppercase tracking-wider text-xs md:text-sm">
          SECTORISATION STRICTE RBAC • {roleName}
        </span>
        <span className="text-slate-100 font-medium">
          Accès autorisé : {allowedActionsText}
        </span>
        <span className="text-rose-400 font-bold ml-2 inline-block">
          🚫 Modification des rôles et accès non autorisés interdits.
        </span>
      </div>
    </div>
  );
};
