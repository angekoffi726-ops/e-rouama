import React from 'react';
import { Users, UserCheck, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { RouamaMember } from '../../types';

export interface EmailRecipientSelectorProps {
  recipientMode: 'ALL' | 'SPECIFIC';
  onRecipientModeChange: (mode: 'ALL' | 'SPECIFIC') => void;
  selectedMemberId: string;
  onSelectedMemberIdChange: (memberId: string) => void;
  members: RouamaMember[];
  allLabel?: string;
  specificLabel?: string;
  title?: string;
  subNotice?: string;
  className?: string;
}

/**
 * Reusable email recipient selector component.
 * Allows choosing between broadcasting to all members or selecting a single specific member from Firestore.
 */
export const EmailRecipientSelector: React.FC<EmailRecipientSelectorProps> = ({
  recipientMode,
  onRecipientModeChange,
  selectedMemberId,
  onSelectedMemberIdChange,
  members,
  allLabel = 'Tous les membres (Diffusion générale)',
  specificLabel = 'Sélectionner un membre spécifique',
  title = "Ciblage des Destinataires pour l'Envoi par Mail",
  subNotice,
  className = '',
}) => {
  // Members with valid email address
  const membersWithEmail = members.filter(m => Boolean(m.email && m.email.includes('@')));
  const selectedMember = members.find(m => m.id === selectedMemberId);
  const selectedMemberHasEmail = Boolean(selectedMember?.email && selectedMember.email.includes('@'));

  const handleSelectSpecific = () => {
    onRecipientModeChange('SPECIFIC');
    // If no member is currently selected, default to the first member with a valid email
    if (!selectedMemberId && membersWithEmail.length > 0) {
      onSelectedMemberIdChange(membersWithEmail[0].id);
    }
  };

  return (
    <div className={`p-5 bg-slate-950 border border-amber-500/40 rounded-2xl space-y-4 animate-fadeIn ${className}`}>
      {/* Title & Safety Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <label className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
          <Mail className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{title}</span>
        </label>
        <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
          Pause anti-blocage (1s) active
        </span>
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

      {/* Dropdown list when Option 2 is chosen */}
      {recipientMode === 'SPECIFIC' ? (
        <div className="pt-2 space-y-2 animate-fadeIn">
          <label className="block text-xs font-bold text-slate-300">
            Sélectionnez le membre destinataire dans la liste enregistrée :
          </label>
          <select
            value={selectedMemberId}
            onChange={e => onSelectedMemberIdChange(e.target.value)}
            className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
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

              return (
                <option key={m.id} value={m.id} disabled={!hasEmail}>
                  {displayName} {hasEmail ? `(${memberEmail})` : '(Aucun email enregistré)'}
                </option>
              );
            })}
          </select>

          {/* Recipient status preview */}
          {selectedMember && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                selectedMemberHasEmail
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {selectedMemberHasEmail ? (
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
                  ({selectedMember.email || 'Email manquant'})
                </span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  selectedMemberHasEmail
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {selectedMemberHasEmail ? '1 email unique' : 'Email requis'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {subNotice ||
            `ℹ️ L'envoi sera effectué de manière séquentielle vers tous les membres éligibles (${membersWithEmail.length} avec email valide) avec une temporisation d'1 seconde entre chaque appel EmailJS anti-saturation.`}
        </p>
      )}
    </div>
  );
};
