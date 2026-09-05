import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, UserCheck, Lock, UserPlus, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { registerMember, loginMember, loginAdmin, members } = useApp();
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LOGIN' | 'ADMIN'>('LOGIN');

  // Etats formulaires
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [adminPin, setAdminPin] = useState('');

  // Retour d'information
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const registeredCount = members ? members.filter(m => m.isRegistered).length : 0;
  const totalMembers = members ? members.length : 13;

  // SOUMISSION CONNEXION MEMBRE
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!name.trim()) {
      setStatus({ type: 'error', message: 'Veuillez saisir votre prénom ou surnom.' });
      return;
    }
    if (!pin.trim()) {
      setStatus({ type: 'error', message: 'Veuillez saisir votre code PIN.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginMember(name, pin);
      if (res.success) {
        setStatus({ type: 'success', message: 'Connexion réussie ! Redirection en cours...' });
        // Ne pas interrompre : la mise à jour du state global fait basculer la vue
      } else {
        setStatus({ type: 'error', message: res.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Une erreur de connexion est survenue.' });
    } finally {
      setIsLoading(false);
    }
  };

  // SOUMISSION INSCRIPTION / ACTIVATION
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!name.trim()) {
      setStatus({ type: 'error', message: 'Veuillez saisir votre prénom ou surnom.' });
      return;
    }
    if (pin.length !== 4) {
      setStatus({ type: 'error', message: 'Le code PIN doit comporter exactement 4 chiffres.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerMember(name, pin);
      if (res.success) {
        setStatus({ type: 'success', message: res.message });
        setTimeout(() => {
          setActiveTab('LOGIN');
          setStatus(null);
        }, 1500);
      } else {
        setStatus({ type: 'error', message: res.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: "Erreur lors de l'activation du compte." });
    } finally {
      setIsLoading(false);
    }
  };

  // SOUMISSION CONNEXION ADMIN
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!adminPin) {
      setStatus({ type: 'error', message: 'Veuillez entrer le code PIN Administrateur.' });
      return;
    }

    const res = loginAdmin(adminRole || 'RESPONSABLE', adminPin);
    if (res.success) {
      setStatus({ type: 'success', message: 'Connexion Admin réussie !' });
    } else {
      setStatus({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EEDC] flex flex-col justify-between items-center p-4 font-sans text-slate-800">
      
      {/* EN-TÊTE LOGO */}
      <div className="w-full max-w-md text-center mt-4 mb-2">
        <div className="w-20 h-20 mx-auto rounded-full bg-white p-1 shadow-lg border-2 border-[#E67E22] overflow-hidden mb-3">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" className="w-full h-full object-cover rounded-full" />
        </div>
        <h1 className="text-3xl font-black text-[#E67E22] tracking-tight">E-ROUAMA</h1>
        <p className="text-xs text-[#355E3B] font-bold italic mt-1">
          « DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »
        </p>

        {/* Compteur membres */}
        <div className="mt-3 inline-block bg-[#355E3B] text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm border border-emerald-300/30">
          Portail Fraternel Sécurisé • MEMBRES INSCRITS SUR L'APP : {registeredCount} / {totalMembers}
        </div>
      </div>

      {/* CARTE FORMULAIRE PRINCIPAL */}
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl border border-amber-200/60 p-6 sm:p-8 my-auto">
        
        {/* ONGLET DE NAVIGATION (INSCRIPTION / CONNEXION / ADMIN) */}
        <div className="grid grid-cols-3 gap-1 bg-[#F5EEDC] p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => { setActiveTab('REGISTER'); setStatus(null); }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs transition-all ${
              activeTab === 'REGISTER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>INSCRIPTION</span>
          </button>

          <button
            onClick={() => { setActiveTab('LOGIN'); setStatus(null); }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs transition-all ${
              activeTab === 'LOGIN'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>CONNEXION</span>
          </button>

          <button
            onClick={() => { setActiveTab('ADMIN'); setStatus(null); }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs transition-all ${
              activeTab === 'ADMIN'
                ? 'bg-[#355E3B] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>ADMIN</span>
          </button>
        </div>

        {/* AFFICHAGE DES MESSAGES D'ALLERTE/STATUT */}
        {status && (
          <div
            className={`p-4 rounded-2xl mb-6 flex items-start gap-3 border ${
              status.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-bold leading-relaxed">{status.message}</div>
          </div>
        )}

        {/* FORMULAIRE 1 : ACTIVATION / INSCRIPTION */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-[#E67E22] uppercase tracking-wider mb-1">
                PRÉNOM OU SURMOM
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Wilfried ou Capelo"
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-amber-300 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-[#E67E22] uppercase tracking-wider mb-1">
                CRÉER UN CODE PIN (4 CHIFFRES)
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-amber-300 rounded-2xl text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 rounded-2xl shadow-lg transition-all text-sm active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Activation en cours...' : 'Activer mon Compte Membre →'}
            </button>
          </form>
        )}

        {/* FORMULAIRE 2 : CONNEXION MEMBRE */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-[#E67E22] uppercase tracking-wider mb-1">
                PRÉNOM OU SURMOM
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Wilfried ou Capelo"
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-amber-300 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-[#E67E22] uppercase tracking-wider mb-1">
                CODE PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-amber-300 rounded-2xl text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 rounded-2xl shadow-lg transition-all text-sm active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Vérification...' : 'Se Connecter à E-ROUAMA →'}
            </button>
          </form>
        )}

        {/* FORMULAIRE 3 : ACCÈS ADMIN */}
        {activeTab === 'ADMIN' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-[#355E3B] uppercase tracking-wider mb-1">
                RÔLE ADMINISTRATEUR
              </label>
              <select
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-emerald-300 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#355E3B]"
              >
                <option value="RESPONSABLE">Responsable Général</option>
                <option value="TRESORIER">Trésorier</option>
                <option value="SECRETAIRE">Secrétaire</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-[#355E3B] uppercase tracking-wider mb-1">
                CODE PIN ADMIN
              </label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Code confidentiel"
                className="w-full px-4 py-3 bg-[#F5EEDC]/40 border border-emerald-300 rounded-2xl text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#355E3B]"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-[#355E3B] hover:bg-[#2A4B2F] text-white font-black py-3.5 rounded-2xl shadow-lg transition-all text-sm active:scale-95"
            >
              Accéder à la Console Admin →
            </button>
          </form>
        )}

      </div>

      {/* PIED DE PAGE */}
      <div className="mt-4 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
        E-ROUAMA 2026 • Plateforme Fraternelle Sécurisée
      </div>

    </div>
  );
};
