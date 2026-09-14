import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KeyRound, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, X, Loader2, Shield } from 'lucide-react';
import { ADMIN_USERS } from '../../data/membersData';
import { AdminRole } from '../../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminRole?: AdminRole;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  adminRole,
}) => {
  const { currentUser, adminUsers, updateAdminPassword } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const targetRole = adminRole || currentUser?.adminRole;
  if (!targetRole) return null;

  const adminDef = (adminUsers && adminUsers.find(a => a.id === targetRole)) || ADMIN_USERS.find(a => a.id === targetRole);
  const roleTitle = adminDef?.roleName || targetRole;

  const handleResetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Validations préalables
    if (!currentPassword.trim()) {
      setErrorMessage("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    if (!newPassword.trim()) {
      setErrorMessage("Veuillez saisir votre nouveau mot de passe.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }

    // 2. Vérification du mot de passe actuel avec les données en mémoire/Firestore
    const expectedPassword = adminDef?.password || adminDef?.pin || '';
    if (currentPassword.trim() !== expectedPassword.trim()) {
      setErrorMessage("Mot de passe actuel incorrect.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await updateAdminPassword(targetRole, currentPassword, newPassword, confirmPassword);
      if (res.success) {
        setSuccessMessage("Mot de passe modifié avec succès !");
        // Réinitialisation des champs
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          handleResetAndClose();
        }, 1600);
      } else {
        setErrorMessage(res.message || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setErrorMessage("Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête de la modale */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 flex items-center justify-between text-white border-b border-amber-500/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-950/30 border border-amber-300/40 flex items-center justify-center text-amber-200 shadow-inner">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                Modifier mon mot de passe
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-amber-100 font-semibold">
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>Poste : {roleTitle}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-slate-950/20 hover:bg-slate-950/40 text-amber-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps du Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 font-normal leading-relaxed">
            Votre nouveau mot de passe sera synchronisé instantanément avec <strong className="text-amber-400 font-semibold">Firestore</strong> et consultable en temps réel par le <strong className="text-emerald-400 font-semibold">CERVEAU</strong>.
          </p>

          {/* Message d'erreur clair en rouge */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Message de succès vert */}
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Mot de passe actuel */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
              Mot de passe actuel <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Saisissez votre mot de passe actuel..."
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. Nouveau mot de passe */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
              Nouveau mot de passe <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Définissez votre nouveau mot de passe..."
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Confirmer le nouveau mot de passe */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
              Confirmer le nouveau mot de passe <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Retapez le nouveau mot de passe..."
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Boutons d'actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 border border-amber-300"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer le mot de passe</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
