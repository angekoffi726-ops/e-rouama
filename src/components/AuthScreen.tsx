import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { ADMIN_USERS, INITIAL_ROUAMA_MEMBERS, getRegisteredMembersCount, isMemberActive } from '../data/membersData';
import { AdminRole } from '../types';
import { Shield, KeyRound, UserCheck, AlertCircle, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

const normalizeName = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

export const AuthScreen: React.FC = () => {
  const { registerMember, loginMember, loginAdmin, members, adminUsers, setCurrentUser } = useApp();

  // Écoute directe en temps réel de tous les documents de la collection 'users' dans Firestore
  const [firestoreUsers, setFirestoreUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          _docId: d.id,
          id: d.id,
          ...d.data(),
        }));
        setFirestoreUsers(list);
      },
      (error) => {
        console.warn('Erreur écoute collection users dans AuthScreen:', error);
      }
    );

    return () => unsub();
  }, []);

  // 1. DÉFINITION UNIQUE ET SYNCHRONISATION EN TEMPS RÉEL DU COMPTEUR DE MEMBRES
  // Réconciliation directe avec les 12 membres officiels pour un affichage instantané et 100% fiable
  const liveMembersList = useMemo(() => {
    return INITIAL_ROUAMA_MEMBERS.map((official) => {
      const uDoc = (firestoreUsers || []).find((u) => {
        if (u.id === official.id || u._docId === official.id) return true;
        const uFirst = normalizeName(u.firstName);
        const oFirst = normalizeName(official.firstName);
        if (uFirst && oFirst && uFirst === oFirst) return true;
        const uNick = normalizeName(u.nickname);
        const oNick = normalizeName(official.nickname);
        if (uNick && oNick && uNick === oNick) return true;
        return false;
      }) || (members || []).find((m) => m.id === official.id) || {};

      const rawPin = uDoc.pinCode !== undefined ? uDoc.pinCode : (uDoc.pin !== undefined ? uDoc.pin : '');
      const cleanPin = rawPin && String(rawPin).trim() !== '' && String(rawPin).trim() !== 'Non défini' ? String(rawPin).trim() : '';

      const isActif = Boolean(
        (cleanPin !== '') ||
        uDoc.isRegistered === true ||
        uDoc.statut === 'Activé'
      );

      return {
        ...official,
        ...uDoc,
        id: official.id,
        firstName: official.firstName,
        nickname: official.nickname,
        fullRosterName: official.fullRosterName,
        pin: cleanPin,
        pinCode: cleanPin,
        isRegistered: isActif,
        statut: isActif ? 'Activé' : "En attente d'activation",
      };
    });
  }, [firestoreUsers, members]);

  // 2. UNIFICATION DU COMPTEUR SUR LA PAGE DE CONNEXION ET DANS LE CERVEAU
  const activeCount = getRegisteredMembersCount(liveMembersList);
  const totalMembersCount = liveMembersList.length || 12;

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

  // Status Message
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    const inputName = regMemberName.trim().toLowerCase();
    if (!inputName) {
      setErrorMsg('Veuillez saisir votre prénom.');
      return;
    }

    const codePin = regMemberPin.trim();
    if (!codePin || codePin.length !== 4 || !/^\d{4}$/.test(codePin)) {
      setErrorMsg('Veuillez définir votre code PIN à 4 chiffres.');
      return;
    }

    // 1. RECHERCHE DE MEMBRE INSENSIBLE À LA CASSE DANS LES DONNÉES EN TEMPS RÉEL
    const member = (liveMembersList || members).find(m =>
      (m.login || m.firstName || m.name || '').toLowerCase() === inputName ||
      (m.nickname || '').toLowerCase() === inputName ||
      (m.fullRosterName || '').toLowerCase().includes(inputName) ||
      normalizeName(m.firstName).toLowerCase() === inputName ||
      normalizeName(m.nickname).toLowerCase() === inputName ||
      (m.id === '2' && (inputName === 'ortiniel' || inputName === 'esprit'))
    );

    // Si aucun membre n'est trouvé, simple message d'erreur rouge sur le formulaire
    if (!member) {
      setErrorMsg("Prénom non reconnu dans la liste des membres.");
      return;
    }

    // Sécurité : Empêcher l'écrasement du code PIN d'un compte déjà activé
    const existingPin = String(member.pinCode || member.pin || '').trim();
    if (member.isRegistered && existingPin && existingPin !== String(codePin).trim()) {
      alert(`Le compte de ${member.nickname} est déjà activé. Veuillez vous connecter avec votre code PIN dans l'onglet Connexion.`);
      setErrorMsg(`Le compte de ${member.nickname} est déjà activé. Connectez-vous avec votre code PIN personnel.`);
      return;
    }

    // 2. SÉCURISATION DU PROCESSUS D'ACTIVATION (ASYNC/AWAIT & FIRESTORE)
    const memberId = member.id;
    const inputPin = String(codePin).trim();
    const nowIso = new Date().toISOString();

    try {
      // 1. Mise à jour Firestore immédiate requise par la consigne
      try {
        await updateDoc(doc(db, "users", memberId), {
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso,
          updatedAt: nowIso
        });
      } catch {
        await setDoc(doc(db, "users", memberId), {
          id: memberId,
          firstName: member.firstName,
          nickname: member.nickname,
          fullRosterName: member.fullRosterName,
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso,
          updatedAt: nowIso
        }, { merge: true });
      }

      // Synchronisation miroir dans members
      try {
        await setDoc(doc(db, "members", memberId), {
          id: memberId,
          firstName: member.firstName,
          nickname: member.nickname,
          fullRosterName: member.fullRosterName,
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso,
          updatedAt: nowIso
        }, { merge: true });
      } catch (errM) {
        console.warn('Miroir members activation:', errM);
      }

      // 2. Mettre à jour le statut local
      const updatedMember = {
        ...member,
        isRegistered: true,
        statut: 'Activé',
        pin: inputPin,
        pinCode: inputPin,
        updatedAt: nowIso,
        lastLogin: nowIso
      };

      // 3. Connecter l'utilisateur en toute sécurité
      setCurrentUser(updatedMember);
      localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
      localStorage.setItem('erouama_active_session', JSON.stringify({ type: 'MEMBER', member: updatedMember }));

      // 4. Rediriger vers l'Accueil
      setSuccessMsg(`Compte activé avec succès ! Bienvenue chez vous, ${member.nickname} !`);
      clearAllFields();
    } catch (error) {
      console.error("Erreur lors de l'activation:", error);
      alert("Une erreur est survenue lors de l'activation. Veuillez réessayer.");
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const inputName = memberLoginName.trim().toLowerCase();
    if (!inputName) {
      setErrorMsg('Veuillez saisir votre prénom ou surnom fraternel.');
      return;
    }

    const pinCodeSaisi = memberLoginPin.trim();
    if (!pinCodeSaisi || pinCodeSaisi.length !== 4 || !/^\d{4}$/.test(pinCodeSaisi)) {
      setErrorMsg('Veuillez saisir votre code PIN à 4 chiffres.');
      return;
    }

    // 1. RECHERCHE DE MEMBRE INSENSIBLE À LA CASSE DANS LES DONNÉES EN TEMPS RÉEL
    const member = (liveMembersList || members).find(m =>
      (m.login || m.firstName || m.name || '').toLowerCase() === inputName ||
      (m.nickname || '').toLowerCase() === inputName ||
      (m.fullRosterName || '').toLowerCase().includes(inputName) ||
      normalizeName(m.firstName).toLowerCase() === inputName ||
      normalizeName(m.nickname).toLowerCase() === inputName ||
      (m.id === '2' && (inputName === 'ortiniel' || inputName === 'esprit'))
    );

    if (!member) {
      setErrorMsg("Prénom non reconnu dans la liste des membres.");
      return;
    }

    const memberId = member.id;
    const inputPin = String(pinCodeSaisi).trim();
    const nowIso = new Date().toISOString();

    // 2. FLUX PREMIÈRE CONNEXION OU VÉRIFICATION STRICTE DU CODE PIN
    const expectedPin = String(member.pinCode || member.pin || '').trim();

    // Cas 1 : Le membre se connecte pour la première fois (pas encore de code PIN défini dans la base)
    // Enregistrement immédiat dans Firestore et activation instantanée
    if (!expectedPin || expectedPin === 'Non défini') {
      try {
        try {
          await updateDoc(doc(db, "users", memberId), {
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso,
            updatedAt: nowIso
          });
        } catch {
          await setDoc(doc(db, "users", memberId), {
            id: memberId,
            firstName: member.firstName,
            nickname: member.nickname,
            fullRosterName: member.fullRosterName,
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso,
            updatedAt: nowIso
          }, { merge: true });
        }

        try {
          await setDoc(doc(db, "members", memberId), {
            id: memberId,
            firstName: member.firstName,
            nickname: member.nickname,
            fullRosterName: member.fullRosterName,
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso,
            updatedAt: nowIso
          }, { merge: true });
        } catch (e) {
          console.warn(e);
        }

        const updatedMember = {
          ...member,
          isRegistered: true,
          statut: 'Activé',
          pin: inputPin,
          pinCode: inputPin,
          avatar: member.avatar || member.photoUrl,
          photoUrl: member.photoUrl || member.avatar,
          lastLogin: nowIso,
          updatedAt: nowIso
        };

        setCurrentUser(updatedMember);
        localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
        localStorage.setItem('erouama_active_session', JSON.stringify({ type: 'MEMBER', member: updatedMember }));

        setSuccessMsg(`Bienvenue chez vous, ${member.nickname} ! Votre compte a été activé.`);
        clearAllFields();
        return;
      } catch (err) {
        console.error('Erreur activation première connexion:', err);
        setErrorMsg("Une erreur est survenue lors de l'enregistrement de votre code PIN.");
        return;
      }
    }

    // Cas 2 : Le compte est déjà activé -> VÉRIFICATION STRICTE DU CODE PIN
    // L'accès doit TOUJOURS être refusé avec une alerte ("Code PIN incorrect") si String(inputPin).trim() !== String(member.pinCode).trim()
    if (inputPin !== expectedPin) {
      alert("Code PIN incorrect");
      setErrorMsg("Code PIN incorrect.");
      return;
    }

    try {
      try {
        await updateDoc(doc(db, "users", memberId), {
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso
        });
      } catch {
        await setDoc(doc(db, "users", memberId), {
          id: memberId,
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso
        }, { merge: true });
      }

      try {
        await setDoc(doc(db, "members", memberId), {
          pinCode: inputPin,
          pin: inputPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso
        }, { merge: true });
      } catch (e) {
        console.warn(e);
      }

      const updatedMember = {
        ...member,
        isRegistered: true,
        statut: 'Activé',
        pin: expectedPin,
        pinCode: expectedPin,
        avatar: member.avatar || member.photoUrl,
        photoUrl: member.photoUrl || member.avatar,
        lastLogin: nowIso
      };

      setCurrentUser(updatedMember);
      localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
      localStorage.setItem('erouama_active_session', JSON.stringify({ type: 'MEMBER', member: updatedMember }));

      setSuccessMsg(`Bienvenue chez vous, ${member.nickname} !`);
      clearAllFields();
    } catch (err) {
      console.error('Erreur connexion membre:', err);
      setErrorMsg("Une erreur est survenue lors de la connexion. Veuillez réessayer.");
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
      {/* Background Decorative Blur circles */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#355E3B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#E67E22]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-[#355E3B]/10 p-5 sm:p-10 relative z-10 transition-all">
        {/* Header Branding */}
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
            Portail Fraternel Sécurisé • MEMBRES INSCRITS SUR L'APP : {activeCount} / {totalMembersCount}
          </div>
        </div>

        {/* Barre d'onglets compacte & responsive (3 colonnes strictes : [ 👤 INSCRIPTION ] [ 🔑 CONNEXION ] [ 🛡️ ADMIN ]) */}
        <div className="notranslate grid grid-cols-3 gap-1 bg-[#F5EEDC]/80 p-1.5 rounded-2xl mb-8 border border-[#E67E22]/10" translate="no">
          <button
            type="button"
            onClick={() => handleTabSwitch('REGISTER_MEMBER')}
            translate="no"
            className={`notranslate py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'REGISTER_MEMBER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="notranslate truncate" translate="no">👤 INSCRIPTION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('LOGIN_MEMBER')}
            translate="no"
            className={`notranslate py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'LOGIN_MEMBER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="notranslate truncate" translate="no">🔑 CONNEXION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('LOGIN_ADMIN')}
            translate="no"
            className={`notranslate py-2.5 px-1 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-extrabold text-[10px] sm:text-xs ${
              mode === 'LOGIN_ADMIN'
                ? 'bg-[#355E3B] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="notranslate truncate" translate="no">🛡️ ADMIN</span>
          </button>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-2xl text-sm font-medium flex items-start gap-3 shadow-sm animate-shake">
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

        {/* MEMBER LOGIN FORM */}
        {mode === 'LOGIN_MEMBER' && (
          <form onSubmit={handleMemberLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#E67E22] uppercase tracking-wider mb-2">
                PRÉNOM
              </label>
              <input
                type="text"
                value={memberLoginName}
                onChange={e => setMemberLoginName(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/30 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#E67E22] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#E67E22] uppercase tracking-wider mb-2">
                CODE
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={memberLoginPin}
                  onChange={e => setMemberLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/30 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#E67E22] focus:outline-none focus:border-[#E67E22] transition-all placeholder:text-slate-400 placeholder:text-lg"
                />
                <Lock className="w-5 h-5 text-[#E67E22] absolute right-4 top-4 opacity-50" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98"
            >
              <span>Se Connecter à E-ROUAMA</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        )}

        {/* MEMBER REGISTER FORM */}
        {mode === 'REGISTER_MEMBER' && (
          <form onSubmit={handleMemberRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#355E3B] uppercase tracking-wider mb-2">
                PRÉNOM
              </label>
              <input
                type="text"
                value={regMemberName}
                onChange={e => setRegMemberName(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#355E3B] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#355E3B] uppercase tracking-wider mb-2">
                CODE
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={regMemberPin}
                onChange={e => setRegMemberPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#355E3B] focus:outline-none focus:border-[#355E3B] transition-all placeholder:text-slate-400 placeholder:text-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#E67E22] hover:opacity-90 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98"
            >
              <span>Créer mon Code PIN & Activer mon Compte</span>
              <UserCheck className="w-5 h-5" />
            </button>
          </form>
        )}

        {/* ADMIN LOGIN FORM */}
        {mode === 'LOGIN_ADMIN' && (
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                ID (Rôle ou Identifiant)
              </label>
              <input
                type="text"
                placeholder="ex: SDP, TRESORIER, CERVEAU..."
                value={adminRoleInput}
                onChange={e => setAdminRoleInput(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/40 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#E67E22] transition-all uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                MDP (Mot de Passe / PIN)
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

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
          <span>E-ROUAMA © 2026 • Groupe Fraternel</span>
        </div>
      </div>
    </div>
  );
};
