import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { INITIAL_ROUAMA_MEMBERS, getRegisteredMembersCount, isMemberActive } from '../../data/membersData';
import { AdminRole, RouamaMember } from '../../types';
import { EditMemberModal } from '../common/EditMemberModal';
import {
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Search,
  Copy,
  Check,
  Lock,
  Phone,
  AlertCircle,
  Clock,
  ShieldCheck,
  Edit3,
  X,
  Loader2,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

interface CerveauMembersCredentialsViewerProps {
  activeRole: AdminRole;
}

const normalizeRoster = (str?: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

export const CerveauMembersCredentialsViewer: React.FC<CerveauMembersCredentialsViewerProps> = ({ activeRole }) => {
  // 1. RESTRICTION D'ACCÈS STRICTE : Accessible UNIQUEMENT pour le rôle 'CERVEAU'
  if (activeRole !== 'CERVEAU') {
    return null;
  }

  const { members } = useApp();

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
        console.warn('Erreur écoute collection users dans CERVEAU:', error);
      }
    );

    return () => unsub();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllPins, setShowAllPins] = useState(false);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  // État pour la modal de modification / définition du PIN par CERVEAU
  const [editingMember, setEditingMember] = useState<{
    id: string;
    docId: string;
    firstName: string;
    nickname: string;
    currentPin: string;
  } | null>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinActionSuccess, setPinActionSuccess] = useState<string | null>(null);
  const [pinActionError, setPinActionError] = useState<string | null>(null);

  // 2. SYNCHRONISATION EN TEMPS RÉEL DEPUIS FIRESTORE ('users')
  // RÈGLE : Un membre est considéré comme ACTIF si et seulement si :
  // m.isRegistered === true OU m.statut === 'Activé' OU (m.pinCode !== null && m.pinCode !== '')
  const registeredMembers = useMemo(() => {
    return INITIAL_ROUAMA_MEMBERS.map((official) => {
      // Priorité au document en temps réel dans firestoreUsers
      const uDoc = (firestoreUsers || []).find((u) => {
        if (u.id === official.id || u._docId === official.id) return true;
        const uFirst = normalizeRoster(u.firstName);
        const oFirst = normalizeRoster(official.firstName);
        if (uFirst && oFirst && uFirst === oFirst) return true;
        const uNick = normalizeRoster(u.nickname);
        const oNick = normalizeRoster(official.nickname);
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
      const realPin = isActif && cleanPin ? cleanPin : '';

      const userAvatar =
        (typeof uDoc.photoUrl === 'string' && uDoc.photoUrl.trim() ? uDoc.photoUrl.trim() : '') ||
        (typeof uDoc.avatar === 'string' && uDoc.avatar.trim() ? uDoc.avatar.trim() : '') ||
        (typeof uDoc.photoURL === 'string' && uDoc.photoURL.trim() ? uDoc.photoURL.trim() : '') ||
        official.avatar ||
        official.photoUrl ||
        '';

      return {
        id: official.id,
        docId: official.id,
        firstName: official.firstName,
        nickname: official.nickname,
        fullRosterName: official.fullRosterName || official.firstName,
        loginId: official.firstName,
        pin: realPin,
        pinCode: realPin,
        phone: uDoc.phone || official.phone || '',
        email: uDoc.email || official.email || '',
        avatar: userAvatar,
        photoUrl: userAvatar,
        assignedRole: uDoc.assignedRole || official.assignedRole,
        isRegistered: isActif,
        statut: isActif ? 'Activé' : "En attente d'activation",
      };
    });
  }, [firestoreUsers, members]);

  // Filtrage par recherche
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return registeredMembers;
    const q = searchQuery.toLowerCase().trim();
    return registeredMembers.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        m.loginId.toLowerCase().includes(q) ||
        m.fullRosterName.toLowerCase().includes(q)
    );
  }, [registeredMembers, searchQuery]);

  // Basculer l'affichage individuel d'un PIN
  const togglePin = (memberId: string) => {
    setRevealedPins((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  // Copier les identifiants pour transmission sécurisée au membre
  const handleCopyCredentials = (member: { firstName: string; nickname: string; loginId: string; pin: string }) => {
    const pinText = member.pin === 'Non défini' ? '(Non encore défini - à créer lors de la 1ère connexion)' : member.pin;
    const textToCopy = `🔐 E-ROUAMA - Identifiants Membre :\n👤 Prénom / Identifiant : ${member.loginId}\n✨ Surnom : ${member.nickname}\n🔑 Code PIN (MDP) : ${pinText}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedMemberId(member.loginId);
      setTimeout(() => setCopiedMemberId(null), 3000);
    }).catch(() => {});
  };

  // Modal de modification complète du membre (informations & photo avec préservation stricte)
  const [memberToEdit, setMemberToEdit] = useState<RouamaMember | null>(null);

  const openEditMemberModal = (m: any) => {
    setMemberToEdit({
      id: m.id,
      firstName: m.firstName,
      nickname: m.nickname,
      fullRosterName: m.fullRosterName || m.firstName,
      phone: m.phone || '',
      email: m.email || '',
      pin: m.pin && m.pin !== 'Non défini' ? m.pin : '',
      avatar: m.avatar || m.photoUrl || '',
      photoUrl: m.photoUrl || m.avatar || '',
      isRegistered: m.isRegistered,
      assignedRole: m.assignedRole,
    });
  };

  // Ouverture de la modal pour définir / changer le PIN d'un membre
  const openEditPinModal = (member: { id: string; docId: string; firstName: string; nickname: string; pin: string }) => {
    setEditingMember({
      id: member.id,
      docId: member.docId,
      firstName: member.firstName,
      nickname: member.nickname,
      currentPin: member.pin,
    });
    setNewPinInput('');
    setPinActionError(null);
    setPinActionSuccess(null);
  };

  // 1. CORRECTION DE LA FONCTION DE MODIFICATION DU PIN (updateMemberPin)
  // Exécute immédiatement updateDoc dans 'users' et affiche l'alerte de confirmation
  const updateMemberPin = async (memberId: string, newPin: string): Promise<boolean> => {
    const pinStr = String(newPin).trim();
    if (!pinStr || pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
      setPinActionError('Le code PIN doit comporter exactement 4 chiffres.');
      return false;
    }

    setIsSavingPin(true);
    setPinActionError(null);

    try {
      // 1. Exécute immédiatement la requête d'écriture Firestore sur la collection 'users'
      try {
        await updateDoc(doc(db, "users", memberId), {
          pinCode: pinStr,
          pin: pinStr,
          isRegistered: true,
          statut: "Activé",
          updatedAt: new Date().toISOString()
        });
      } catch {
        await setDoc(doc(db, "users", memberId), {
          id: memberId,
          pinCode: pinStr,
          pin: pinStr,
          isRegistered: true,
          statut: "Activé",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Synchronisation miroir dans 'members'
      try {
        await setDoc(doc(db, "members", memberId), {
          pinCode: pinStr,
          pin: pinStr,
          isRegistered: true,
          statut: "Activé",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Miroir members:', e);
      }

      // 2. Notification de succès (Alert + Toast)
      alert("Code PIN mis à jour avec succès dans la base de données");
      setPinActionSuccess("Code PIN mis à jour avec succès dans la base de données");

      setTimeout(() => {
        setEditingMember(null);
        setPinActionSuccess(null);
      }, 1500);

      return true;
    } catch (err) {
      console.error('Erreur sauvegarde PIN membre dans Firestore:', err);
      setPinActionError("Une erreur est survenue lors de l'enregistrement dans Firestore.");
      alert("Erreur lors de la mise à jour du code PIN dans Firestore.");
      return false;
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSaveMemberPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    await updateMemberPin(editingMember.id, newPinInput);
  };

  // 2. ACTION RÉINITIALISER LE COMPTE
  // Met à jour Firestore avec { pinCode: "", isRegistered: false, statut: "En attente d'activation" }
  const handleResetMemberAccount = async (member: { id: string; firstName: string; nickname: string }) => {
    const confirmReset = window.confirm(
      `Voulez-vous vraiment réinitialiser le compte de ${member.firstName} (« ${member.nickname} ») ?\n\nSon code PIN sera effacé et son statut passera à "En attente d'activation".\nLe membre pourra recréer lui-même son code PIN sur la page d'accueil via l'onglet "INSCRIPTION / ACTIVATION".`
    );
    if (!confirmReset) return;

    try {
      const resetPayload = {
        pinCode: "",
        pin: "",
        isRegistered: false,
        statut: "En attente d'activation",
        updatedAt: new Date().toISOString()
      };

      try {
        await updateDoc(doc(db, "users", member.id), resetPayload);
      } catch {
        await setDoc(doc(db, "users", member.id), { id: member.id, ...resetPayload }, { merge: true });
      }

      try {
        await setDoc(doc(db, "members", member.id), resetPayload, { merge: true });
      } catch (e) {
        console.warn('Miroir members reset:', e);
      }

      alert(`Le compte de ${member.firstName} a été réinitialisé avec succès dans la base de données.`);
    } catch (err) {
      console.error("Erreur réinitialisation compte membre:", err);
      alert("Erreur lors de la réinitialisation du compte.");
    }
  };

  // Statistiques d'activation unifiées avec l'accueil via getRegisteredMembersCount
  const totalMembersCount = registeredMembers.length || 12;
  const activatedMembersCount = getRegisteredMembersCount(registeredMembers);
  const pendingMembersCount = totalMembersCount - activatedMembersCount;

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
      {/* En-tête de la section CERVEAU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white tracking-tight">
              Registre & Mots de Passe (PIN) des Membres
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Accès réservé au <strong className="text-amber-400">CERVEAU</strong> • Données réelles Firestore en temps réel • Aucun code temporaire par défaut.
            </span>
          </p>
        </div>

        {/* Badges de statut statistiques */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
            <UserCheck className="w-4 h-4" />
            <span>{activatedMembersCount} Activés</span>
          </div>
          {pendingMembersCount > 0 && (
            <div className="text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{pendingMembersCount} En attente d'activation</span>
            </div>
          )}
          <div className="text-xs font-bold text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            {totalMembersCount} Membres Officiels
          </div>
        </div>
      </div>

      {/* Barre d'outils : Recherche et bouton Masquer/Afficher tous les codes */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un membre (ex: OTINEL, CAPELO, ESTHER)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
            >
              Effacer
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAllPins(!showAllPins)}
          className="bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer shrink-0"
        >
          {showAllPins ? (
            <>
              <EyeOff className="w-4 h-4 text-amber-400" />
              <span>Masquer tous les PIN</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Afficher tous les PIN</span>
            </>
          )}
        </button>
      </div>

      {/* Affichage des Membres */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
          <p className="text-slate-400 font-bold text-sm">Aucun membre ne correspond à votre recherche.</p>
          <p className="text-slate-600 text-xs">Vérifiez l'orthographe ou effacez le filtre.</p>
        </div>
      ) : (
        <>
          {/* Tableau Desktop */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-black tracking-wider text-slate-400 uppercase">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Membre & Photo</th>
                  <th className="py-3 px-4">Identifiant (Login)</th>
                  <th className="py-3 px-4">Code PIN (MDP)</th>
                  <th className="py-3 px-4">Statut Compte</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Actions (PIN & Compte)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredMembers.map((member, idx) => {
                  const isVisible = showAllPins || Boolean(revealedPins[member.id]);
                  const isCopied = copiedMemberId === member.loginId;
                  const isActivated = member.isRegistered && Boolean(member.pin);

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Numéro séquentiel officiel */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-bold">
                        {member.id || idx + 1}
                      </td>

                      {/* Membre & Surnom avec VRAIE Photo ou Initiales */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm">
                            {member.photoUrl || member.avatar ? (
                              <img
                                src={member.photoUrl || member.avatar}
                                alt={member.firstName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-amber-400 font-black">{member.firstName.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-black text-white text-sm flex items-center gap-1.5">
                              <span>{member.firstName}</span>
                            </div>
                            <div className="text-xs text-amber-300 font-bold">
                              « {member.nickname} »
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Identifiant de Connexion */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono font-bold text-white shadow-inner">
                          <span className="text-slate-500 text-[10px] uppercase font-sans">Login :</span>
                          <span className="text-emerald-400 font-extrabold">{member.loginId}</span>
                        </div>
                      </td>

                      {/* Code d'accès (PIN) Réel sans fallback ni PIN fictif */}
                      <td className="py-3.5 px-4">
                        {isActivated ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black px-3 py-1.5 rounded-xl border tracking-widest min-w-[85px] text-center shadow-inner select-all bg-slate-950 border-slate-800 text-amber-300">
                              {isVisible ? member.pin : '••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePin(member.id)}
                              title={isVisible ? "Masquer le code PIN" : "Afficher le code PIN"}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-inner">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>En attente d'activation</span>
                          </span>
                        )}
                      </td>

                      {/* Statut du compte */}
                      <td className="py-3.5 px-4">
                        {isActivated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Activé</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>En attente d'activation</span>
                          </span>
                        )}
                      </td>

                      {/* Téléphone / Contact */}
                      <td className="py-3.5 px-4">
                        {member.phone ? (
                          <div className="text-xs font-mono text-slate-300 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{member.phone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Non renseigné</span>
                        )}
                      </td>

                      {/* Actions : Modifier PIN, Réinitialiser, Modifier Profil, Copier */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => openEditPinModal(member)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 cursor-pointer shadow-sm"
                            title="Modifier le code PIN dans Firestore"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetMemberAccount(member)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 cursor-pointer shadow-sm"
                            title="Réinitialiser le compte (effacer PIN pour nouvelle inscription)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Réinitialiser</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditMemberModal(member)}
                            className="p-1.5 rounded-xl text-xs font-bold inline-flex items-center transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer shadow-sm"
                            title="Modifier les informations et la photo"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(member)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all shadow-sm cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                            }`}
                            title="Copier les identifiants pour transmettre au membre"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vue Cartes pour Écrans Mobiles */}
          <div className="grid grid-cols-1 gap-3.5 md:hidden">
            {filteredMembers.map((member) => {
              const isVisible = showAllPins || Boolean(revealedPins[member.id]);
              const isCopied = copiedMemberId === member.loginId;
              const isActivated = member.isRegistered && Boolean(member.pin);

              return (
                <div
                  key={member.id}
                  className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center shrink-0 text-white font-bold text-xs">
                        {member.photoUrl || member.avatar ? (
                          <img
                            src={member.photoUrl || member.avatar}
                            alt={member.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-amber-400 font-black">{member.firstName.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-black text-white text-sm leading-tight flex items-center gap-1.5">
                          <span>{member.firstName}</span>
                          {isActivated ? (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                              Activé
                            </span>
                          ) : (
                            <span className="text-[9px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 font-bold">
                              En attente d'activation
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-amber-300 font-bold">
                          « {member.nickname} »
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => openEditPinModal(member)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold transition-all bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                        title="Modifier le PIN"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Modifier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetMemberAccount(member)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold transition-all bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1 cursor-pointer"
                        title="Réinitialiser"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditMemberModal(member)}
                        className="p-1.5 rounded-lg text-xs font-bold transition-all bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                        title="Modifier le membre et sa photo"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyCredentials(member)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                          isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                        }`}
                        title="Copier les identifiants"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identifiant (Login)</div>
                      <div className="text-xs font-mono font-black text-emerald-400 mt-0.5 truncate">
                        {member.loginId}
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Code PIN (MDP)</div>
                        {isActivated ? (
                          <div className="text-xs font-mono font-black mt-0.5 text-amber-300 tracking-widest">
                            {isVisible ? member.pin : '••••'}
                          </div>
                        ) : (
                          <div className="text-[11px] font-semibold mt-0.5 text-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>En attente d'activation</span>
                          </div>
                        )}
                      </div>
                      {isActivated && (
                        <button
                          type="button"
                          onClick={() => togglePin(member.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL DE DÉFINITION / MODIFICATION DU PIN PAR CERVEAU */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  Gestion PIN : {editingMember.firstName}
                </h3>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p>Membre : <strong className="text-white">{editingMember.firstName}</strong> (« {editingMember.nickname} »)</p>
              <p>PIN Actuel : <strong className={editingMember.currentPin === 'Non défini' ? 'text-rose-400' : 'text-amber-300'}>{editingMember.currentPin}</strong></p>
            </div>

            <form onSubmit={handleSaveMemberPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nouveau Code PIN (4 chiffres) :
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Ex: 2609"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg font-mono font-black text-amber-300 tracking-widest focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  Ce code sera directement enregistré dans le document Firestore du membre.
                </p>
              </div>

              {pinActionError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium">
                  {pinActionError}
                </div>
              )}

              {pinActionSuccess && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pinActionSuccess}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={isSavingPin}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || newPinInput.length !== 4}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isSavingPin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Valider le PIN</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRINCIPALE : MODIFIER LE MEMBRE AVEC FEEDBACK VISUEL DE LA PHOTO */}
      <EditMemberModal
        isOpen={Boolean(memberToEdit)}
        onClose={() => setMemberToEdit(null)}
        member={memberToEdit}
        isAdminMode={true}
      />

      {/* Note d'éthique et de sécurité fraternelle */}
      <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-200 font-bold">Clause de confidentialité CERVEAU : </span>
          Ces identifiants sont strictement confidentiels et réservés au CERVEAU pour assister un membre en cas d'oubli de son mot de passe ou de son identifiant d'accès. La lecture récupère en temps réel les données authentiques saisies par les membres dans Firestore sans aucune valeur par défaut.
        </div>
      </div>
    </div>
  );
};
