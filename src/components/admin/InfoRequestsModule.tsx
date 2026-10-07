import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Inbox,
  SendHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Plus,
  RefreshCw,
  X,
  User,
  Shield,
  FileQuestion,
  CornerDownRight,
  MessageCircle,
  HelpCircle,
  Sparkles,
  Trash2,
  Check,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminRole, InfoRequest } from '../../types';

// =========================================================================
// CONFIGURATION STRICTE DES DÉPARTEMENTS ÉLIGIBLES (RBAC STRICT)
// CERVEAU et SUPER_ADMIN sont STRICTEMENT EXCLUS de cette liste et du module.
// =========================================================================
export interface EligibleDeptConfig {
  key: string;
  name: string;
  shortName: string;
  icon: string;
  roleAliases: string[];
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  description: string;
}

export const ELIGIBLE_ADMIN_DEPARTMENTS: EligibleDeptConfig[] = [
  {
    key: 'SECRETARIAT',
    name: 'Secrétariat Général',
    shortName: 'Secrétariat',
    icon: '📝',
    roleAliases: ['SECRETARIAT', 'SECRETAIRE', 'SECRETAIRE_GENERAL', 'SECRETARIAT_GENERAL'],
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'Procès-verbaux de réunions, convocations et archivage administratif officiel.',
  },
  {
    key: 'TRESORIER',
    name: 'Trésorerie Générale',
    shortName: 'Trésorier',
    icon: '💰',
    roleAliases: ['TRESORIER', 'TRESOR', 'TRESORERIE', 'TRESORIER_GENERAL'],
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    description: 'Gestion des caisses, validation des paiements, décaissements et bilans comptables.',
  },
  {
    key: 'ORGANISATION',
    name: 'Commission Organisation',
    shortName: 'Organisation',
    icon: '🎪',
    roleAliases: ['ORGANISATION', 'ORGANISATEUR', 'COMMISSION_ORGANISATION', 'COMITE_ORGANISATION'],
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    description: 'Planification logistique, événements, sorties communautaires et budgets opérationnels.',
  },
  {
    key: 'PROJET',
    name: 'Commission Projets (AGR)',
    shortName: 'Respo Projet',
    icon: '🚀',
    roleAliases: ['PROJET', 'PROJETS', 'RESP_PROJET', 'RESPO_PROJET', 'COMMISSION_PROJET', 'COMMISSION_PROJETS'],
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    description: 'Études de rentabilité des Activités Génératrices de Revenus (AGR) et investissements.',
  },
  {
    key: 'SDP',
    name: 'Chargé du Suivi du Programme',
    shortName: 'Suivi Programme',
    icon: '🕵️',
    roleAliases: ['SDP', 'RESP_PROGRAMME', 'SUIVI_PROGRAMME', 'SUIVI_DU_PROGRAMME', 'CHARGE_DU_SUIVI'],
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    description: 'Auditeur interne, contrôle du respect des résolutions de PV et assiduité des commissions.',
  },
  {
    key: 'SPIRITUALITE',
    name: 'Département Spiritualité',
    shortName: 'Spiritualité',
    icon: '🕊️',
    roleAliases: ['SPIRITUALITE', 'SPIRITUEL', 'DEPARTEMENT_SPIRITUALITE'],
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    description: 'Liturgie, intentions de prière, verset quotidien et coordination spirituelle.',
  },
  {
    key: 'PAYOR',
    name: 'Espace Payor',
    shortName: 'Payor',
    icon: '⚖️',
    roleAliases: ['PAYOR', 'ESPACE_PAYOR', 'CONTROLE_PAYOR'],
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    description: 'Visa de conformité et validation administrative avant publication par la BIC.',
  },
  {
    key: 'COM',
    name: "Base d'Information et Communication (BIC)",
    shortName: 'Communication',
    icon: '📢',
    roleAliases: ['COM', 'BIC', 'COMMUNICATION', 'RESP_COM', 'RESPONSABLE_COM'],
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    description: 'Diffusion officielle, accusés de réception (ACK) et annonces aux membres.',
  },
];

// Vérifie si un rôle est éligible au module (et exclut formellement CERVEAU et SUPER_ADMIN)
export const isRoleEligibleForInfoModule = (role?: string): boolean => {
  if (!role) return false;
  const clean = role.trim().toUpperCase().replace(/[\s-]/g, '_');
  if (
    clean === 'CERVEAU' ||
    clean.includes('CERVEAU') ||
    clean.includes('PRESIDENT') ||
    clean === 'SUPER_ADMIN' ||
    clean === 'SUPERADMIN' ||
    clean === 'ADMIN_GENERAL'
  ) {
    return false;
  }
  return ELIGIBLE_ADMIN_DEPARTMENTS.some(d => d.key === clean || d.roleAliases.includes(clean));
};

// Normalise un rôle vers la clé standard d'un département éligible
export const normalizeToEligibleDeptKey = (role?: string): string => {
  if (!role) return 'SECRETARIAT';
  const clean = role.trim().toUpperCase().replace(/[\s-]/g, '_');
  const found = ELIGIBLE_ADMIN_DEPARTMENTS.find(d => d.key === clean || d.roleAliases.includes(clean));
  return found ? found.key : clean;
};

// Trouve la configuration d'un département
export const getEligibleDeptConfig = (roleKeyOrName?: string): EligibleDeptConfig | undefined => {
  if (!roleKeyOrName) return undefined;
  const clean = roleKeyOrName.trim().toUpperCase().replace(/[\s-]/g, '_');
  return ELIGIBLE_ADMIN_DEPARTMENTS.find(
    d => d.key === clean || d.name.toUpperCase() === clean || d.roleAliases.includes(clean)
  );
};

interface InfoRequestsModuleProps {
  currentRole: AdminRole | string;
  senderNameOverride?: string;
  compactHeader?: boolean;
  onNavigateToPv?: () => void;
}

export const InfoRequestsModule: React.FC<InfoRequestsModuleProps> = ({
  currentRole,
  senderNameOverride,
  compactHeader = false,
}) => {
  const {
    currentUser,
    infoRequests = [],
    createInfoRequest,
    replyInfoRequest,
    markInfoRequestRead,
    deleteInfoRequest,
  } = useApp();

  // 1. VÉRIFICATION RBAC STRICTE
  const isEligible = isRoleEligibleForInfoModule(currentRole);
  const normalizedCurrentDeptKey = normalizeToEligibleDeptKey(currentRole);
  const currentDeptConfig = getEligibleDeptConfig(normalizedCurrentDeptKey);

  // Nom de l'émetteur
  const senderDisplayName = useMemo(() => {
    if (senderNameOverride) return senderNameOverride;
    if (currentUser?.type === 'MEMBER' && currentUser.member) {
      return `${currentUser.member.firstName} (${currentUser.member.nickname})`.trim();
    }
    return currentDeptConfig?.name || String(currentRole);
  }, [senderNameOverride, currentUser, currentDeptConfig, currentRole]);

  // États locaux du module
  const [activeView, setActiveView] = useState<'RECEIVED' | 'SENT' | 'COMPOSE'>('RECEIVED');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'PENDING' | 'REPLIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Formulaire "Nouvelle Demande"
  const [targetDeptKey, setTargetDeptKey] = useState<string>(() => {
    // Premier département éligible différent du département courant
    const firstOther = ELIGIBLE_ADMIN_DEPARTMENTS.find(d => d.key !== normalizedCurrentDeptKey);
    return firstOther ? firstOther.key : 'TRESORIER';
  });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zone de réponse active
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [isReplyingId, setIsReplyingId] = useState<string | null>(null);

  // Filtrage des demandes pour ce département
  // 1. Demandes Reçues (adressées à ce département)
  const receivedRequests = useMemo(() => {
    return (infoRequests || []).filter(req => {
      const recipientKey = normalizeToEligibleDeptKey(req.recipientRole);
      return recipientKey === normalizedCurrentDeptKey;
    });
  }, [infoRequests, normalizedCurrentDeptKey]);

  // 2. Demandes Émises (envoyées par ce département)
  const sentRequests = useMemo(() => {
    return (infoRequests || []).filter(req => {
      const senderKey = normalizeToEligibleDeptKey(req.senderRole);
      return senderKey === normalizedCurrentDeptKey;
    });
  }, [infoRequests, normalizedCurrentDeptKey]);

  // Compteurs
  const unreadCount = useMemo(() => {
    return receivedRequests.filter(r => !r.isRead).length;
  }, [receivedRequests]);

  const pendingCount = useMemo(() => {
    return receivedRequests.filter(r => r.status === 'En attente').length;
  }, [receivedRequests]);

  const repliedReceivedCount = useMemo(() => {
    return receivedRequests.filter(r => r.status === 'Répondu').length;
  }, [receivedRequests]);

  // Filtrage par texte et statut pour la vue active
  const displayedRequests = useMemo(() => {
    const list = activeView === 'RECEIVED' ? receivedRequests : sentRequests;
    return list.filter(req => {
      // Filtre statut
      if (statusFilter === 'UNREAD' && req.isRead) return false;
      if (statusFilter === 'PENDING' && req.status !== 'En attente') return false;
      if (statusFilter === 'REPLIED' && req.status !== 'Répondu') return false;

      // Filtre recherche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubj = req.subject?.toLowerCase().includes(q);
        const matchMsg = req.message?.toLowerCase().includes(q);
        const matchSender = req.senderName?.toLowerCase().includes(q);
        const matchReply = req.replyMessage?.toLowerCase().includes(q);
        return matchSubj || matchMsg || matchSender || matchReply;
      }
      return true;
    });
  }, [activeView, receivedRequests, sentRequests, statusFilter, searchQuery]);

  // Soumission d'une nouvelle demande
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptKey) {
      setFeedbackToast({ type: 'error', message: 'Veuillez sélectionner un département destinataire.' });
      return;
    }
    if (!subject.trim()) {
      setFeedbackToast({ type: 'error', message: "Veuillez préciser l'objet de votre demande." });
      return;
    }
    if (!message.trim()) {
      setFeedbackToast({ type: 'error', message: 'Veuillez rédiger le corps de votre demande.' });
      return;
    }

    const recipientConfig = getEligibleDeptConfig(targetDeptKey);
    setIsSubmitting(true);
    setFeedbackToast(null);

    try {
      const res = await createInfoRequest({
        senderRole: normalizedCurrentDeptKey,
        senderRoleLabel: currentDeptConfig?.name || normalizedCurrentDeptKey,
        senderName: senderDisplayName,
        recipientRole: targetDeptKey,
        recipientRoleLabel: recipientConfig?.name || targetDeptKey,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (res.success) {
        setSubject('');
        setMessage('');
        setFeedbackToast({
          type: 'success',
          message: `Demande envoyée avec succès à la commission : ${recipientConfig?.name || targetDeptKey}`,
        });
        setActiveView('SENT');
      } else {
        setFeedbackToast({ type: 'error', message: res.message || "Échec de l'envoi de la demande." });
      }
    } catch (err: any) {
      setFeedbackToast({ type: 'error', message: err?.message || 'Erreur inattendue.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Traitement de la réponse à une demande reçue
  const handleSendReply = async (requestId: string) => {
    const text = replyInputs[requestId];
    if (!text || !text.trim()) {
      setFeedbackToast({ type: 'error', message: 'Veuillez saisir votre réponse avant de valider.' });
      return;
    }

    setIsReplyingId(requestId);
    setFeedbackToast(null);

    try {
      const res = await replyInfoRequest(requestId, text.trim(), senderDisplayName);
      if (res.success) {
        setFeedbackToast({ type: 'success', message: 'Votre réponse a été transmise en temps réel !' });
        setReplyInputs(prev => ({ ...prev, [requestId]: '' }));
      } else {
        setFeedbackToast({ type: 'error', message: res.message || "Échec de l'envoi de la réponse." });
      }
    } catch (err: any) {
      setFeedbackToast({ type: 'error', message: err?.message || 'Erreur inattendue.' });
    } finally {
      setIsReplyingId(null);
    }
  };

  // Marquer comme lu
  const handleToggleExpand = async (req: InfoRequest) => {
    if (expandedRequestId === req.id) {
      setExpandedRequestId(null);
    } else {
      setExpandedRequestId(req.id);
      if (activeView === 'RECEIVED' && !req.isRead) {
        await markInfoRequestRead(req.id);
      }
    }
  };

  // Suggestions rapides pour l'objet
  const quickSubjectSuggestions = [
    'Précision montant dépense PV du 12 Octobre',
    'Justificatif devis et budget prévisionnel sortie',
    'Vérification cotisations et solvabilité d’un membre',
    'Rapport d’étape et avancement projet AGR',
    'Mise à jour du calendrier et des résolutions',
    'Transmission de pièce justificative officielle',
  ];

  // Si le rôle n'est pas éligible (ex: CERVEAU ou SUPER_ADMIN)
  if (!isEligible) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Shield className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-black text-white">Module Réservé aux Administrations Opérationnelles</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          Conformément aux directives RBAC strictes, la Navette de Demandes d'Information Inter-Admins est réservée
          exclusivement aux commissions opérationnelles (Secrétariat, Trésorerie, Organisation, Projets AGR, Suivi
          Programme, Spiritualité, Payor et Communication). La Présidence (CERVEAU) et le Super Admin sont strictement
          exclus des correspondances de travail bilatérales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border text-xs font-bold animate-fadeIn ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BANNIÈRE D'EN-TÊTE DU MODULE */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-black tracking-wide">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>NAVETTE ADMINISTRATIVE • MESSAGERIE B2B INTER-ADMINS</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 flex-wrap">
              <span>Demandes d'Information & Échanges Opérationnels</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-xl font-bold border ${currentDeptConfig?.badgeBg} ${currentDeptConfig?.badgeText} ${currentDeptConfig?.borderColor}`}
              >
                {currentDeptConfig?.icon} {currentDeptConfig?.name}
              </span>
            </h2>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Outil officiel de navette directe entre départements pour éclaircir une dépense de trésorerie, obtenir une
              précision pour un PV du Secrétariat, coordonner un événement ou auditer une échéance.
            </p>
          </div>

          {/* KPI RÉCAPITULATIFS EN TEMPS RÉEL */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[100px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non lues</div>
              <div className="text-xl font-black text-rose-400 font-mono flex items-center justify-center gap-1">
                <span>{unreadCount}</span>
                {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[100px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En attente</div>
              <div className="text-xl font-black text-amber-400 font-mono">{pendingCount}</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[100px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Répondues</div>
              <div className="text-xl font-black text-emerald-400 font-mono">{repliedReceivedCount}</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[100px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Envoyées</div>
              <div className="text-xl font-black text-cyan-400 font-mono">{sentRequests.length}</div>
            </div>
          </div>
        </div>

        {/* BARRE D'ONGLETS / VUES */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('RECEIVED')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'RECEIVED'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>BOÎTE DE RÉCEPTION ({receivedRequests.length})</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('SENT')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'SENT'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <SendHorizontal className="w-4 h-4" />
              <span>DEMANDES ENVOYÉES ({sentRequests.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveView(activeView === 'COMPOSE' ? 'RECEIVED' : 'COMPOSE')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg ${
              activeView === 'COMPOSE'
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
            }`}
          >
            {activeView === 'COMPOSE' ? (
              <>
                <X className="w-4 h-4" />
                <span>FERMER LE FORMULAIRE</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>NOUVELLE DEMANDE D'INFORMATION</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. FORMULAIRE "NOUVELLE DEMANDE" (RÉDACTION) */}
      {/* ========================================================= */}
      {activeView === 'COMPOSE' && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Émettre une Demande d'Information</h3>
                <p className="text-xs text-slate-400">
                  La requête sera notifiée instantanément au département destinataire avec accusé de lecture et champ de
                  réponse formelle.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('RECEIVED')}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSendRequest} className="space-y-5">
            {/* Destinataire & Expéditeur */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Département Destinataire *</span>
                </label>
                <select
                  value={targetDeptKey}
                  onChange={e => setTargetDeptKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  {ELIGIBLE_ADMIN_DEPARTMENTS.filter(d => d.key !== normalizedCurrentDeptKey).map(dept => (
                    <option key={dept.key} value={dept.key}>
                      {dept.icon} {dept.name} ({dept.shortName})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Seules les commissions administratives autorisées sont sélectionnables (CERVEAU et Super Admin exclus).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Émetteur (Votre Entité)</span>
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>{currentDeptConfig?.icon}</span>
                    <span>{currentDeptConfig?.name}</span>
                  </span>
                  <span className="text-xs text-emerald-400 font-mono">Signé : {senderDisplayName}</span>
                </div>
              </div>
            </div>

            {/* Objet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileQuestion className="w-3.5 h-3.5 text-amber-400" />
                  <span>Objet de la demande *</span>
                </label>
                <span className="text-[10px] text-slate-500">Soyez précis pour faciliter le traitement</span>
              </div>
              <input
                type="text"
                placeholder="Ex: Précision montant dépense PV du 12 Octobre / Devis logistique sonorisation"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
              />

              {/* Suggestions rapides */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Modèles rapides :</span>
                </span>
                {quickSubjectSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSubject(sug)}
                    className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Corps du message */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Message & Détail des Précisions Demandées *</span>
              </label>
              <textarea
                rows={5}
                placeholder="Indiquez ici les détails de votre requête, les pièces demandées, le contexte du PV ou de la dépense concernée..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-amber-500 resize-y leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('RECEIVED')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Transmission en cours...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ENVOYER LA DEMANDE D'INFORMATION</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. LISTE DES DEMANDES (BOÎTE DE RÉCEPTION OU ENVOYÉES) */}
      {/* ========================================================= */}
      {activeView !== 'COMPOSE' && (
        <div className="space-y-4">
          {/* Barre de filtres et recherche */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par objet, message, émetteur..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" />
                <span>Statut :</span>
              </span>

              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Toutes ({activeView === 'RECEIVED' ? receivedRequests.length : sentRequests.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('UNREAD')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === 'UNREAD'
                    ? 'bg-rose-500 text-white'
                    : 'text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                🔴 Non lues
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                🟡 En attente
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('REPLIED')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === 'REPLIED'
                    ? 'bg-emerald-500 text-white font-black'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                🟢 Répondues
              </button>
            </div>
          </div>

          {/* Aucun élément */}
          {displayedRequests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">
                {activeView === 'RECEIVED'
                  ? 'Aucune demande reçue dans cette catégorie'
                  : 'Aucune demande émise trouvée'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {activeView === 'RECEIVED'
                  ? "Vous n'avez pas de demande d'information en attente provenant d'autres départements."
                  : "Vous n'avez pas encore envoyé de demande d'information. Cliquez sur 'Nouvelle Demande' pour solliciter un département."}
              </p>
              {activeView === 'RECEIVED' && (
                <button
                  type="button"
                  onClick={() => setActiveView('COMPOSE')}
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Rédiger une demande maintenant</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedRequests.map(req => {
                const isReceived = activeView === 'RECEIVED';
                const otherDeptKey = isReceived ? req.senderRole : req.recipientRole;
                const otherDeptConfig = getEligibleDeptConfig(otherDeptKey);
                const isExpanded = expandedRequestId === req.id;
                const timeAgoStr = req.createdAt
                  ? new Date(req.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                const replyTimeStr = req.repliedAt
                  ? new Date(req.repliedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={req.id}
                    className={`bg-slate-900 border rounded-3xl transition-all shadow-md overflow-hidden ${
                      !req.isRead && isReceived
                        ? 'border-indigo-500/70 bg-indigo-950/20'
                        : req.status === 'Répondu'
                        ? 'border-slate-800 hover:border-emerald-500/30'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* En-tête de la carte */}
                    <div
                      onClick={() => handleToggleExpand(req)}
                      className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-start gap-3">
                        {/* Indicateur de lecture */}
                        <div className="pt-0.5">
                          {!req.isRead && isReceived ? (
                            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm animate-pulse" />
                          ) : req.status === 'Répondu' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400" />
                          )}
                        </div>

                        <div className="space-y-1">
                          {/* Badges départements */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg border ${
                                otherDeptConfig?.badgeBg || 'bg-slate-800'
                              } ${otherDeptConfig?.badgeText || 'text-white'} ${
                                otherDeptConfig?.borderColor || 'border-slate-700'
                              }`}
                            >
                              <span>{otherDeptConfig?.icon || '🛡️'}</span>
                              <span>
                                {isReceived ? `De : ${otherDeptConfig?.name || req.senderRole}` : `Pour : ${otherDeptConfig?.name || req.recipientRole}`}
                              </span>
                            </span>

                            {/* Statut badge */}
                            {req.status === 'Répondu' ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>🟢 Répondu</span>
                              </span>
                            ) : (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>🟡 En attente de réponse</span>
                              </span>
                            )}

                            {!req.isRead && isReceived && (
                              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2 py-0.5 rounded-md">
                                🔴 Non lu
                              </span>
                            )}
                          </div>

                          {/* Objet de la demande */}
                          <h4 className="text-sm sm:text-base font-black text-white hover:text-indigo-300 transition-colors">
                            {req.subject}
                          </h4>

                          {/* Auteur & Date */}
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                            <span>Émis par : <strong className="text-slate-300">{req.senderName || req.senderRole}</strong></span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{timeAgoStr}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1"
                        >
                          {isExpanded ? <span>Masquer</span> : <span>Consulter / Répondre</span>}
                        </button>
                      </div>
                    </div>

                    {/* Contenu détaillé déplié */}
                    {isExpanded && (
                      <div className="px-5 pb-6 pt-2 border-t border-slate-800/80 space-y-5 animate-fadeIn">
                        {/* Message original */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Contenu de la demande :</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                            {req.message}
                          </p>
                        </div>

                        {/* Réponse déjà apportée */}
                        {req.replyMessage && (
                          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-black text-emerald-400 flex items-center gap-2">
                                <CornerDownRight className="w-4 h-4" />
                                <span>Réponse officielle transmise :</span>
                              </span>
                              <span className="text-[11px] font-mono text-emerald-500/80">
                                {replyTimeStr} {req.repliedBy ? `• par ${req.repliedBy}` : ''}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-emerald-200 whitespace-pre-wrap leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-emerald-500/20 font-sans">
                              {req.replyMessage}
                            </p>
                          </div>
                        )}

                        {/* Zone de formulaire pour répondre (pour le département destinataire) */}
                        {isReceived && (
                          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-white flex items-center gap-2">
                                <Send className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  {req.replyMessage
                                    ? 'Modifier / Compléter votre réponse :'
                                    : 'Formuler la réponse de votre commission :'}
                                </span>
                              </label>
                              <span className="text-[10px] text-slate-500">
                                Transmis instantanément en temps réel via Firestore
                              </span>
                            </div>

                            <textarea
                              rows={3}
                              placeholder="Rédigez la précision, le montant certifié, les motifs ou la référence PV..."
                              value={replyInputs[req.id] !== undefined ? replyInputs[req.id] : req.replyMessage || ''}
                              onChange={e =>
                                setReplyInputs(prev => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 resize-y"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isReplyingId === req.id}
                                onClick={() => handleSendReply(req.id)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                              >
                                {isReplyingId === req.id ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Enregistrement...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{req.replyMessage ? 'Mettre à jour la réponse' : 'Transmettre la réponse'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Actions secondaires */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/60">
                          <span className="font-mono text-[10px]">Identifiant : {req.id}</span>
                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => deleteInfoRequest(req.id)}
                              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1 hover:underline"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Supprimer cette demande</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
