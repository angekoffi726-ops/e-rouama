import React from 'react';
import { Users, UserCheck, Mail, CheckCircle2, AlertCircle, X, Bell } from 'lucide-react';
import { RouamaMember } from '../../types';

export interface EmailRecipientSelectorProps {
  recipientMode: 'ALL' | 'SPECIFIC';
  onRecipientModeChange: (mode: 'ALL' | 'SPECIFIC') => void;
  selectedMemberId: string;
  onSelectedMemberIdChange: (memberId: string) => void;
  selectedMemberIds?: string[];
  onSelectedMemberIdsChange?: (memberIds: string[]) => void;
  members: RouamaMember[];
  allLabel?: string;
  specificLabel?: string;
  title?: string;
  subNotice?: string;
  className?: string;
  requireEmail?: boolean;
  hideAntiSpamBadge?: boolean;
}

/**
 * Reusable recipient selector component.
 * Supports all dispatch channels (APP, MAIL, GENERAL).
 * Allows choosing between broadcasting to all members (Option A) or selecting specific member(s) (Option B).
 */
export const EmailRecipientSelector: React.FC<EmailRecipientSelectorProps> = ({
  recipientMode,
  onRecipientModeChange,
  selectedMemberId,
  onSelectedMemberIdChange,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  members,
  allLabel = 'Tous les membres (Diffusion générale)',
  specificLabel = 'Sélectionner un membre spécifique',
  title = 'Ciblage des Destinataires',
  subNotice,
  className = '',
  requireEmail = true,
  hideAntiSpamBadge = false,
}) => {
  // Filter members according to email requirement
  const membersWithEmail = members.filter(m => Boolean(m.email && m.email.includes('@')));
  const eligibleMembers = requireEmail ? membersWithEmail : members;

  // Selected members calculation
  const currentSelectedIds = selectedMemberIds && selectedMemberIds.length > 0
    ? selectedMemberIds
    : selectedMemberId
    ? [selectedMemberId]
    : [];

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const selectedMemberHasEmail = Boolean(selectedMember?.email && selectedMember.email.includes('@'));

  const handleSelectSpecific = () => {
    onRecipientModeChange('SPECIFIC');
    // If no member is selected yet, default to first eligible member
    if (currentSelectedIds.length === 0 && eligibleMembers.length > 0) {
      const firstId = eligibleMembers[0].id;
      onSelectedMemberIdChange(firstId);
      if (onSelectedMemberIdsChange) {
        onSelectedMemberIdsChange([firstId]);
      }
    }
  };

  const handleMemberSelect = (memberId: string) => {
    if (!memberId) return;
    onSelectedMemberIdChange(memberId);

    if (onSelectedMemberIdsChange) {
      if (!currentSelectedIds.includes(memberId)) {
        onSelectedMemberIdsChange([...currentSelectedIds, memberId]);
      }
    }
  };

  const handleToggleMember = (memberId: string) => {
    if (!onSelectedMemberIdsChange) {
      onSelectedMemberIdChange(memberId);
      return;
    }

    if (currentSelectedIds.includes(memberId)) {
      const updated = currentSelectedIds.filter(id => id !== memberId);
      onSelectedMemberIdsChange(updated);
      if (selectedMemberId === memberId) {
        onSelectedMemberIdChange(updated[0] || '');
      }
    } else {
      const updated = [...currentSelectedIds, memberId];
      onSelectedMemberIdsChange(updated);
      onSelectedMemberIdChange(memberId);
    }
  };

  const handleRemoveMember = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectedMemberIdsChange) {
      const updated = currentSelectedIds.filter(id => id !== memberId);
      onSelectedMemberIdsChange(updated);
      if (selectedMemberId === memberId) {
        onSelectedMemberIdChange(updated[0] || '');
      }
    } else if (selectedMemberId === memberId) {
      onSelectedMemberIdChange('');
    }
  };

  return (
    <div className={`p-5 bg-slate-950 border border-amber-500/40 rounded-2xl space-y-4 animate-fadeIn ${className}`}>
      {/* Title & Safety Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <label className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
          {requireEmail ? (
            <Mail className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{title}</span>
        </label>
        {!hideAntiSpamBadge && requireEmail ? (
          <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
            Pause anti-blocage (1s) active
          </span>
        ) : (
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
            Diffusion ciblée sécurisée
          </span>
        )}
      </div>

      {/* 2 Options Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option 1: All members (Default) */}
        <button
          type="button"
          onClick={() => onRecipientModeChange('ALL')}
          className={`py-3 px-4 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            recipientMode === 'ALL'
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md ring-1 ring-amber-500/50'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>{allLabel}</span>
        </button>

        {/* Option 2: Specific member */}
        <button
          type="button"
          onClick={handleSelectSpecific}
          className={`py-3 px-4 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            recipientMode === 'SPECIFIC'
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md ring-1 ring-amber-500/50'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>{specificLabel}</span>
        </button>
      </div>

      {/* When Option 2 (SPECIFIC) is chosen */}
      {recipientMode === 'SPECIFIC' ? (
        <div className="pt-2 space-y-3 animate-fadeIn">
          <label className="block text-xs font-bold text-slate-300">
            Sélectionnez le ou les membres destinataires dans la liste :
          </label>

          {/* Member Dropdown */}
          <select
            value={selectedMemberId}
            onChange={e => handleMemberSelect(e.target.value)}
            className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="">-- Choisir un membre destinataire --</option>
            {members.map(m => {
              const memberEmail = m.email?.trim();
              const hasEmail = Boolean(memberEmail && memberEmail.includes('@'));
              const displayName =
                m.fullRosterName ||
                `${m.name || ''} ${m.firstName || ''}`.trim() ||
                m.nickname ||
                'Membre';

              const isDisabled = requireEmail && !hasEmail;

              return (
                <option key={m.id} value={m.id} disabled={isDisabled}>
                  {displayName}{' '}
                  {hasEmail
                    ? `(${memberEmail})`
                    : requireEmail
                    ? '(Aucun email enregistré)'
                    : '(In-App uniquement)'}
                </option>
              );
            })}
          </select>

          {/* Multi-member chips if multiple members or onSelectedMemberIdsChange is available */}
          {onSelectedMemberIdsChange && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Membres ciblés ({currentSelectedIds.length}) :</span>
                {currentSelectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedMemberIdsChange([]);
                      onSelectedMemberIdChange('');
                    }}
                    className="text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Effacer la sélection
                  </button>
                )}
              </div>

              {/* Selected Pills */}
              {currentSelectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/80 border border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                  {currentSelectedIds.map(id => {
                    const m = members.find(mem => mem.id === id);
                    if (!m) return null;
                    const label = m.nickname || m.firstName || m.name || id;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-xs font-bold"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={e => handleRemoveMember(id, e)}
                          className="hover:text-white cursor-pointer"
                          title="Retirer ce membre"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Quick toggle chips from all eligible members */}
              <div className="pt-1">
                <p className="text-[11px] text-slate-500 mb-1.5">Sélection rapide en 1 clic :</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-950/60 rounded-lg">
                  {members.map(m => {
                    const isSelected = currentSelectedIds.includes(m.id);
                    const hasEmail = Boolean(m.email && m.email.includes('@'));
                    if (requireEmail && !hasEmail) return null;
                    const label = m.nickname || m.firstName || m.name || 'Membre';

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleToggleMember(m.id)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {isSelected ? `✓ ${label}` : `+ ${label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Single recipient preview fallback if no onSelectedMemberIdsChange */}
          {!onSelectedMemberIdsChange && selectedMember && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                !requireEmail || selectedMemberHasEmail
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {!requireEmail || selectedMemberHasEmail ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  Destinataire :{' '}
                  <strong>
                    {selectedMember.fullRosterName ||
                      selectedMember.name ||
                      selectedMember.firstName ||
                      selectedMember.nickname}
                  </strong>{' '}
                  ({selectedMember.email || (requireEmail ? 'Email manquant' : 'In-App uniquement')})
                </span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  !requireEmail || selectedMemberHasEmail
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {requireEmail
                  ? selectedMemberHasEmail
                    ? '1 email unique'
                    : 'Email requis'
                  : 'Ciblé In-App'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {subNotice ||
            (requireEmail
              ? `ℹ️ L'envoi sera effectué de manière séquentielle vers tous les membres éligibles (${membersWithEmail.length} avec email valide) avec une temporisation d'1 seconde entre chaque appel EmailJS anti-saturation.`
              : `ℹ️ L'alerte sera diffusée à l'ensemble des membres de la Fraternité dans leur fil d'actualités GBAÏRAÏ.`)}
        </p>
      )}
    </div>
  );
};
