import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { ADMIN_USERS, INITIAL_ROUAMA_MEMBERS, getRegisteredMembersCount, isMemberActive } from '../data/membersData';
import { getDefaultRolesForMember } from '../data/departmentMapping';
import { AdminRole } from '../types';
import { Shield, KeyRound, UserCheck, AlertCircle, Lock, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { requestPushPermissionAndSaveToken, dispatchPushNotification, refreshFcmTokenOnStartup } from '../utils/pushNotificationService';

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
    // Reconstitution et rafraîchissement automatique du token FCM dès l'ouverture de l'écran de Login
    refreshFcmTokenOnStartup();

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

  const [mode, setMode] = useState<'LOGIN_MEMBER' | 'REGISTER_MEMBER'>('LOGIN_MEMBER');

  // Member Form State
  const [memberLoginName, setMemberLoginName] = useState('');
  const [memberLoginPin, setMemberLoginPin] = useState('');

  // Member Registration State
  const [regMemberName, setRegMemberName] = useState('');
  const [regMemberPin, setRegMemberPin] = useState('');

  // Admin Form State (conservé pour rétrocompatibilité interne)
  const [adminRoleInput, setAdminRoleInput] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');

  // Loading States
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState<boolean>(false);

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

  const handleTabSwitch = (newMode: 'LOGIN_MEMBER' | 'REGISTER_MEMBER') => {
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

    setIsSubmittingRegister(true);
    try {
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

      // Sécurité : Empêcher l'écrasement du code PIN d'un compte déjà activé
      const existingPin = String(member.pinCode || member.pin || '').trim();
      if (member.isRegistered && existingPin && existingPin !== String(codePin).trim()) {
        setErrorMsg(`Le compte de ${member.nickname} est déjà activé. Connectez-vous avec votre code PIN personnel dans l'onglet Connexion.`);
        return;
      }

      const memberId = member.id;
      const inputPin = String(codePin).trim();
      const nowIso = new Date().toISOString();

      // Mettre à jour le statut local et attacher les rôles / départements
      const defaultMeta = getDefaultRolesForMember(memberId, member.firstName, member.nickname);
      const userRoles = (member as any).roles || defaultMeta.roles;
      const userDepts = (member as any).departments || defaultMeta.departments;
      const userAdminRole = (member as any).adminRole || (member as any).assignedRole || defaultMeta.adminRole;

      const updatedMember = {
        ...member,
        roles: userRoles,
        departments: userDepts,
        adminRole: userAdminRole,
        assignedRole: userAdminRole,
        isRegistered: true,
        statut: 'Activé',
        pin: inputPin,
        pinCode: inputPin,
        updatedAt: nowIso,
        lastLogin: nowIso
      };

      const sessionData = {
        type: 'MEMBER' as const,
        activeView: 'MEMBER' as const,
        member: updatedMember,
        id: memberId,
        roles: userRoles,
        departments: userDepts,
        adminRole: userAdminRole,
      };

      // 1. Redirection et connexion instantanée sans attente de Firebase
      setCurrentUser(sessionData);
      localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
      localStorage.setItem('erouama_active_session', JSON.stringify(sessionData));
      setSuccessMsg(`Compte activé avec succès ! Bienvenue chez vous, ${member.nickname} !`);
      clearAllFields();

      // 2. Synchronisation Firestore et notifications Push non-bloquante en arrière-plan
      (async () => {
        try {
          await updateDoc(doc(db, "users", memberId), {
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso,
            updatedAt: nowIso
          }).catch(async () => {
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
            }, { merge: true }).catch(() => {});
          });

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
          }, { merge: true }).catch(() => {});

          requestPushPermissionAndSaveToken(member.id, 'MEMBER', member.id).catch(() => {});

          dispatchPushNotification({
            title: 'E-ROUAMA : Nouveau Membre Activé',
            body: `Bienvenue à ${member.nickname || member.firstName} qui vient d'activer son compte !`,
            senderRole: 'SYSTÈME',
            senderName: 'E-ROUAMA',
            targetRole: 'ALL',
            type: 'GENERAL',
            url: '/',
          }).catch(() => {});
        } catch (syncErr) {
          console.warn('Note synchronisation Firestore activation:', syncErr);
        }
      })();
    } catch (error: any) {
      console.error("Erreur lors de l'activation:", error);
      setErrorMsg("Une erreur est survenue lors de l'activation. Veuillez réessayer.");
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const inputName = memberLoginName.trim();
    if (!inputName) {
      setErrorMsg('Veuillez saisir votre prénom ou identifiant.');
      return;
    }

    const pinCodeSaisi = memberLoginPin.trim();
    if (!pinCodeSaisi || pinCodeSaisi.length < 4) {
      setErrorMsg('Veuillez saisir votre code PIN (au moins 4 chiffres).');
      return;
    }

    setIsSubmittingLogin(true);
    try {
      const inputLower = inputName.toLowerCase();

      // 1. RECHERCHE DE MEMBRE INSENSIBLE À LA CASSE
      const member = (liveMembersList || members).find(m =>
        (m.login || m.firstName || m.name || '').toLowerCase() === inputLower ||
        (m.nickname || '').toLowerCase() === inputLower ||
        (m.fullRosterName || '').toLowerCase().includes(inputLower) ||
        normalizeName(m.firstName).toLowerCase() === inputLower ||
        normalizeName(m.nickname).toLowerCase() === inputLower ||
        (m.id === '2' && (inputLower === 'ortiniel' || inputLower === 'esprit'))
      );

      // Si aucun membre n'est trouvé, vérifier s'il s'agit d'un compte Administrateur direct (TRESORIER, CERVEAU, PAYOR, etc.)
      if (!member) {
        const adminRes = loginAdmin(inputName, pinCodeSaisi);
        if (adminRes.success) {
          setSuccessMsg(adminRes.message);
          clearAllFields();
          return;
        }
        setErrorMsg("Prénom ou identifiant non reconnu. Veuillez vérifier l'orthographe.");
        return;
      }

      const memberId = member.id;
      const inputPin = String(pinCodeSaisi).trim();
      const nowIso = new Date().toISOString();
      const expectedPin = String(member.pinCode || member.pin || '').trim();

      // Cas 1 : Première connexion (pas encore de code PIN défini dans la base)
      if (!expectedPin || expectedPin === 'Non défini') {
        const defaultMeta = getDefaultRolesForMember(memberId, member.firstName, member.nickname);
        const userRoles = (member as any).roles || defaultMeta.roles;
        const userDepts = (member as any).departments || defaultMeta.departments;
        const userAdminRole = (member as any).adminRole || (member as any).assignedRole || defaultMeta.adminRole;

        const updatedMember = {
          ...member,
          roles: userRoles,
          departments: userDepts,
          adminRole: userAdminRole,
          assignedRole: userAdminRole,
          isRegistered: true,
          statut: 'Activé',
          pin: inputPin,
          pinCode: inputPin,
          avatar: member.avatar || member.photoUrl,
          photoUrl: member.photoUrl || member.avatar,
          lastLogin: nowIso,
          updatedAt: nowIso
        };

        const sessionData = {
          type: 'MEMBER' as const,
          activeView: 'MEMBER' as const,
          member: updatedMember,
          id: memberId,
          roles: userRoles,
          departments: userDepts,
          adminRole: userAdminRole,
        };

        // Redirection immédiate
        setCurrentUser(sessionData);
        localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
        localStorage.setItem('erouama_active_session', JSON.stringify(sessionData));
        setSuccessMsg(`Bienvenue chez vous, ${member.nickname} ! Votre compte a été activé.`);
        clearAllFields();

        // Synchronisation non-bloquante en arrière-plan
        (async () => {
          try {
            await updateDoc(doc(db, "users", memberId), {
              pinCode: inputPin,
              pin: inputPin,
              isRegistered: true,
              statut: "Activé",
              lastLogin: nowIso,
              updatedAt: nowIso
            }).catch(async () => {
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
              }, { merge: true }).catch(() => {});
            });

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
            }, { merge: true }).catch(() => {});

            requestPushPermissionAndSaveToken(member.id, 'MEMBER', member.id).catch(() => {});
            dispatchPushNotification({
              title: 'E-ROUAMA : Nouveau Membre Activé',
              body: `Bienvenue à ${member.nickname || member.firstName} qui vient d'activer son compte !`,
              senderRole: 'SYSTÈME',
              senderName: 'E-ROUAMA',
              targetRole: 'ALL',
              type: 'GENERAL',
              url: '/',
            }).catch(() => {});
          } catch (syncErr) {
            console.warn('Note sync activation première connexion:', syncErr);
          }
        })();

        return;
      }

      // Cas 2 : Le compte est déjà activé -> Vérification du code PIN
      if (inputPin !== expectedPin) {
        // Possibilité alternative : le membre a saisi son mot de passe de rôle Admin
        const adminRes = loginAdmin(inputName, pinCodeSaisi);
        if (adminRes.success) {
          setSuccessMsg(adminRes.message);
          clearAllFields();
          return;
        }
        setErrorMsg("Code PIN incorrect. Veuillez vérifier votre code.");
        return;
      }

      // Code PIN correct -> Attachement des rôles et départements
      const defaultMeta = getDefaultRolesForMember(memberId, member.firstName, member.nickname);
      const userRoles = (member as any).roles || defaultMeta.roles;
      const userDepts = (member as any).departments || defaultMeta.departments;
      const userAdminRole = (member as any).adminRole || (member as any).role || (member as any).assignedRole || defaultMeta.adminRole;

      const updatedMember = {
        ...member,
        roles: userRoles,
        departments: userDepts,
        adminRole: userAdminRole,
        assignedRole: userAdminRole,
        isRegistered: true,
        statut: 'Activé',
        pin: expectedPin,
        pinCode: expectedPin,
        avatar: member.avatar || member.photoUrl,
        photoUrl: member.photoUrl || member.avatar,
        lastLogin: nowIso
      };

      const sessionData = {
        type: 'MEMBER' as const,
        activeView: 'MEMBER' as const,
        member: updatedMember,
        id: member.id,
        roles: userRoles,
        departments: userDepts,
        adminRole: userAdminRole,
      };

      // Redirection instantanée sans attente réseau
      setCurrentUser(sessionData);
      localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
      localStorage.setItem('erouama_active_session', JSON.stringify(sessionData));
      setSuccessMsg(`Bienvenue chez vous, ${member.nickname} !`);
      clearAllFields();

      // Synchronisation Firestore non bloquante en arrière-plan
      (async () => {
        try {
          await updateDoc(doc(db, "users", memberId), {
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso
          }).catch(async () => {
            await setDoc(doc(db, "users", memberId), {
              id: memberId,
              pinCode: inputPin,
              pin: inputPin,
              isRegistered: true,
              statut: "Activé",
              lastLogin: nowIso
            }, { merge: true }).catch(() => {});
          });

          await setDoc(doc(db, "members", memberId), {
            pinCode: inputPin,
            pin: inputPin,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso
          }, { merge: true }).catch(() => {});

          if (userAdminRole) {
            await addDoc(collection(db, 'admin_logs'), {
              userId: member.id,
              memberName: `${member.firstName} (${member.nickname || member.name})`,
              role: userAdminRole,
              loginTimestamp: nowIso,
              dateString: nowIso.split('T')[0],
            }).catch(() => {});
          }

          requestPushPermissionAndSaveToken(member.id, 'MEMBER', member.id).catch(() => {});
        } catch (syncErr) {
          console.warn('Note sync Firestore login:', syncErr);
        }
      })();
    } catch (err: any) {
      console.error('Erreur connexion membre:', err);
      setErrorMsg("Une erreur est survenue lors de la connexion. Veuillez réessayer.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
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
      // Enregistrement direct supplémentaire dans Firestore (admin_logs) pour synchronisation temps réel instantanée
      try {
        const cleanInput = adminRoleInput.trim().toUpperCase().replace(/[\s-]/g, '_');
        const now = new Date();
        await addDoc(collection(db, 'admin_logs'), {
          userId: cleanInput,
          memberName: cleanInput,
          role: cleanInput,
          loginTimestamp: now.toISOString(),
          dateString: now.toISOString().split('T')[0],
        });

        // Demande de permission et enregistrement du token Push FCM dans Firestore (users/{adminId}/fcmToken)
        requestPushPermissionAndSaveToken(cleanInput, 'ADMIN').catch((err) => {
          console.warn('Note enregistrement FCM token admin:', err);
        });
      } catch (err) {
        console.warn('Erreur admin_logs dans handleAdminLogin:', err);
      }
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

        {/* Barre d'onglets unifiée (2 boutons d'accès généraux : [ 🔑 CONNEXION ] [ 👤 INSCRIPTION ]) */}
        <div className="notranslate grid grid-cols-2 gap-2 bg-[#F5EEDC]/90 p-1.5 rounded-2xl mb-8 border border-[#E67E22]/20 shadow-inner" translate="no">
          <button
            type="button"
            onClick={() => handleTabSwitch('LOGIN_MEMBER')}
            translate="no"
            className={`notranslate py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-xs sm:text-sm cursor-pointer active:scale-95 ${
              mode === 'LOGIN_MEMBER'
                ? 'bg-[#E67E22] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5 font-bold'
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span className="notranslate truncate" translate="no">🔑 CONNEXION</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('REGISTER_MEMBER')}
            translate="no"
            className={`notranslate py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-xs sm:text-sm cursor-pointer active:scale-95 ${
              mode === 'REGISTER_MEMBER'
                ? 'bg-[#355E3B] text-white shadow-md'
                : 'text-slate-700 hover:bg-black/5 font-bold'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="notranslate truncate" translate="no">👤 INSCRIPTION</span>
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
                  maxLength={8}
                  placeholder="••••"
                  disabled={isSubmittingLogin}
                  value={memberLoginPin}
                  onChange={e => setMemberLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#F5EEDC]/50 border-2 border-[#E67E22]/30 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#E67E22] focus:outline-none focus:border-[#E67E22] transition-all placeholder:text-slate-400 placeholder:text-lg disabled:opacity-50"
                />
                <Lock className="w-5 h-5 text-[#E67E22] absolute right-4 top-4 opacity-50" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {isSubmittingLogin ? (
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

        {/* MEMBER REGISTER FORM */}
        {mode === 'REGISTER_MEMBER' && (
          <form onSubmit={handleMemberRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#355E3B] uppercase tracking-wider mb-2">
                PRÉNOM
              </label>
              <input
                type="text"
                disabled={isSubmittingRegister}
                value={regMemberName}
                onChange={e => setRegMemberName(e.target.value)}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#355E3B] transition-all disabled:opacity-50"
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
                disabled={isSubmittingRegister}
                value={regMemberPin}
                onChange={e => setRegMemberPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F5EEDC]/50 border-2 border-[#355E3B]/20 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#355E3B] focus:outline-none focus:border-[#355E3B] transition-all placeholder:text-slate-400 placeholder:text-lg disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingRegister}
              className="w-full bg-[#E67E22] hover:opacity-90 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {isSubmittingRegister ? (
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

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
          <span>E-ROUAMA © 2026 • Groupe Fraternel</span>
        </div>
      </div>
    </div>
  );
};
