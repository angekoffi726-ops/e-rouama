import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, KeyRound, UserCheck, AlertCircle, Lock, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { registerMember, loginMember, loginAdmin, members } = useApp();

  const registeredCount = members ? members.filter(m => m.isRegistered).length : 0;
  const totalMembersCount = members ? members.length : 13;

  const [mode, setMode] = useState<'REGISTER_MEMBER' | 'LOGIN_MEMBER' | 'LOGIN_ADMIN'>('REGISTER_MEMBER');

  // Member Form State
  const [memberLoginName, setMemberLoginName] = useState('');
  const [memberLoginPin, setMemberLoginPin] = useState('');

  // Member Registration State
  const [regMemberName, setRegMemberName] = useState('');
  const [regMemberPin, setRegMemberPin] = useState('');

  // Admin Form State
  const [adminRoleInput, setAdminRoleInput] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');

  // Status & Loading State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const clearAllFields = () => {
    setMemberLoginName('');
    setMemberLoginPin('');
    setRegMemberName('');
    setRegMemberPin('');
    setAdminRoleInput('');
    setAdminPinInput('');
  };

  const handleTabSwitch = (newMode: 'REGISTER_MEMBER' | 'LOGIN_MEMBER' | 'LOGIN_ADMIN') => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    clearAllFields();
  };

  const handleMemberRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regMemberName.trim()) {
      setErrorMsg('Veuillez saisir votre prénom ou surnom fraternel.');
      return;
    }

    if (!regMemberPin || regMemberPin.length !== 4) {
      setErrorMsg('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerMember(regMemberName, regMemberPin);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message + " Redirection vers la connexion...");
        // REDIRECTION AUTOMATIQUE VERS L'ONGLET CONNEXION APRES 1.5 SECONDES
        setTimeout(() => {
          setMemberLoginName(regMemberName);
          handleTabSwitch('LOGIN_MEMBER');
        }, 1500);
      }
    } catch (err) {
      setErrorMsg("Une erreur réseau est survenue lors de l'inscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!memberLoginName.trim()) {
      setErrorMsg('Veuillez saisir votre prénom ou surnom fraternel.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginMember(memberLoginName, memberLoginPin);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg("Connexion réussie ! Redirection...");
        // LAISSE LE TEMPS À L'APPLICATION DE BASCULER VERS L'ÉCRAN PRINCIPAL
      }
    } catch (err) {
      setErrorMsg("Une erreur réseau est survenue lors de la connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!adminRoleInput.trim()) {
      setErrorMsg('Veuillez saisir le rôle ou l\'identifiant administrateur.');
      return;
    }

    const res = loginAdmin(adminRoleInput, adminPinInput);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      clearAllFields();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EEDC] flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#355E3B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#E67E22]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-[#355E3B]/10 p-5 sm:p-10 relative z-10 transition-all">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center mb-3 sm:mb-4">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-amber-400 shadow-xl bg-white p-0 flex items-center justify-center transition-transform hover:scale-105">
              <img 
                src="/LOGOPRO.png" 
                alt="Logo E-ROUAMA" 
                className="w-full h-full object-cover p-0" 
              />
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#E67E22] tracking-tight">
            E-ROUAMA
          </h1>
          <p className="text-[11px] sm:text-sm text-slate-600 font-medium italic mt-1 max-w-md mx-auto">
            « DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »
          </p>
          <div className="inline-block mt-3 px-3 py-1 bg-[#355E3B]/10 text-[#355E3B] text-[10px] sm:text-xs font-black rounded-full border border-[#355E3B]/20 shadow-sm">
            Portail Fraternel Sécurisé • MEMBRES INSCRITS SUR L'APP : {registeredCount} / {totalMembersCount}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-[#F5EEDC]/80 p-1.5 rounded-2xl mb-8 border border-[#E67E22]/10">
          <button
            type="button"
            onClick={() => handleTabSwitch('REGISTER_MEMBER')}
            className={`py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'REGISTER_MEMBER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">INSCRIPTION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('LOGIN_MEMBER')}
            className={`py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'LOGIN_MEMBER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">CONNEXION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('LOGIN_ADMIN')}
            className={`py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'LOGIN_ADMIN'
                ? 'bg-[#355E3B] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ADMIN</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-2xl text-sm font-medium flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Erreur d'accès</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 rounded-2xl text-sm font-medium flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="font-bold">{successMsg}</p>
          </div>
        )}

        {mode === 'LOGIN_MEMBER' && (
          <form onSubmit={handleMemberLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#E67E22] uppercase tracking-wider mb-2">
                PRÉNOM OU SURNOM
              </label>
              <input
                type="text"
                placeholder="Ex: Wilfried ou Capelo"
                value={memberLoginName}
                onChange={e => setMemberLoginName(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/30 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#E67E22] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#E67E22] uppercase tracking-wider mb-2">
                CODE PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={memberLoginPin}
                  onChange={e => setMemberLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/30 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#E67E22] focus:outline-none focus:border-[#E67E22] transition-all"
                />
                <Lock className="w-5 h-5 text-[#E67E22] absolute right-4 top-4 opacity-50" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se Connecter à E-ROUAMA</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'REGISTER_MEMBER' && (
          <form onSubmit={handleMemberRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#355E3B] uppercase tracking-wider mb-2">
                PRÉNOM OU SURNOM
              </label>
              <input
                type="text"
                placeholder="Ex: Wilfried ou Capelo"
                value={regMemberName}
                onChange={e => setRegMemberName(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#355E3B] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#355E3B] uppercase tracking-wider mb-2">
                CRÉER VOTRE CODE PIN (4 CHIFFRES)
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={regMemberPin}
                onChange={e => setRegMemberPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#355E3B] focus:outline-none focus:border-[#355E3B] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#E67E22] hover:opacity-90 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Activation en cours...</span>
                </>
              ) : (
                <>
                  <span>Créer mon Code PIN & Activer mon Compte</span>
                  <UserCheck className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'LOGIN_ADMIN' && (
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                IDENTIFIANT ADMIN
              </label>
              <input
                type="text"
                placeholder="Identifiant"
                value={adminRoleInput}
                onChange={e => setAdminRoleInput(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/40 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#E67E22] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                MOT DE PASSE / PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                value={adminPinInput}
                onChange={e => setAdminPinInput(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/40 rounded-2xl px-4 py-3 text-center text-xl font-bold tracking-widest text-slate-900 focus:outline-none focus:border-[#E67E22] transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#E67E22] hover:opacity-90 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98"
            >
              <Shield className="w-5 h-5" />
              <span>Connexion Console Administrateur</span>
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
          <span>E-ROUAMA © 2026 • Groupe Fraternel</span>
        </div>
      </div>
    </div>
  );
};
