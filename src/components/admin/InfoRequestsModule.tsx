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
  Sparkles,
  Trash2,
  Check,
  CheckCheck,
  Lock,
  Unlock,
  PhoneCall,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminRole, InfoRequest, InfoRequestMessage } from '../../types';
import { getDepartmentContact } from './SuiviProgrammeConsole';

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
    description: 'Médiation, audit de justice interne, discipline communautaire et conformité.',
  },
  {
    key: 'COMMUNICATION',
    name: 'Commission Communication (BIC)',
    shortName: 'Communication',
    icon: '📢',
    roleAliases: ['COMMUNICATION', 'COM', 'BIC', 'COMMISSAIRE_COM'],
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

// Harmonisation robuste pour vérifier si un rôle ou libellé correspond au département cible (ex: Projet, Com, etc.)
export const isDeptMatch = (roleOrLabel: string | undefined, targetDeptKey: string): boolean => {
  if (!roleOrLabel || !targetDeptKey) return false;
  const normalizedTarget = normalizeToEligibleDeptKey(targetDeptKey);
  const targetConfig = getEligibleDeptConfig(normalizedTarget);
  const targetKeysAndAliases = [
    normalizedTarget,
    targetConfig?.key,
    ...(targetConfig?.roleAliases || []),
  ]
    .filter(Boolean)
    .map((s) => s!.toUpperCase().replace(/[\s-]/g, '_'));

  const cleanInput = roleOrLabel.toUpperCase().trim().replace(/[\s-]/g, '_');

  // Correspondance exacte avec la clé ou ses alias
  if (targetKeysAndAliases.includes(cleanInput)) return true;
  if (normalizeToEligibleDeptKey(roleOrLabel) === normalizedTarget) return true;

  // Correspondance sémantique et libellés longs (ex: "Commission Projets (AGR)", "Projets AGR")
  if (targetConfig?.name && cleanInput.includes(targetConfig.name.toUpperCase().replace(/[\s-]/g, '_'))) return true;
  if (targetConfig?.shortName && cleanInput.includes(targetConfig.shortName.toUpperCase().replace(/[\s-]/g, '_'))) return true;
  if (normalizedTarget === 'PROJET' && (cleanInput.includes('PROJET') || cleanInput.includes('AGR'))) return true;
  if (normalizedTarget === 'COMMUNICATION' && (cleanInput.includes('COM') || cleanInput.includes('BIC'))) return true;
  if (normalizedTarget === 'SECRETARIAT' && (cleanInput.includes('SECRETAR') || cleanInput.includes('SECRETAIRE'))) return true;
  if (normalizedTarget === 'TRESORIER' && (cleanInput.includes('TRESOR') || cleanInput.includes('FINANCE'))) return true;
  if (normalizedTarget === 'ORGANISATION' && cleanInput.includes('ORGANIS')) return true;
  if (normalizedTarget === 'SPIRITUALITE' && (cleanInput.includes('SPIRIT') || cleanInput.includes('PRIERE'))) return true;
  if (normalizedTarget === 'SDP' && (cleanInput.includes('SDP') || cleanInput.includes('SUIVI'))) return true;
  if (normalizedTarget === 'PAYOR' && cleanInput.includes('PAYOR')) return true;

  return false;
};

// Helper: Récupère la liste ordonnée des messages du fil d'échange avec rétro-compatibilité
export function getThreadMessages(req: InfoRequest): InfoRequestMessage[] {
  if (req.messages && req.messages.length > 0) {
    return req.messages;
  }

  // Rétrocompatibilité : reconstruction automatique si la requête provient de l'ancienne version
  const msgs: InfoRequestMessage[] = [];
  if (req.message) {
    msgs.push({
      id: `${req.id}-init`,
      senderRole: req.senderRole,
      senderRoleLabel: req.senderRoleLabel || req.senderRole,
      senderName: req.senderName || req.senderRole,
      message: req.message,
      createdAt: req.createdAt,
    });
  }
  if (req.replyMessage) {
    msgs.push({
      id: `${req.id}-rep`,
      senderRole: req.recipientRole,
      senderRoleLabel: req.recipientRoleLabel || req.recipientRole,
      senderName: req.repliedBy || req.recipientRole,
      message: req.replyMessage,
      createdAt: req.repliedAt || req.createdAt,
    });
  }
  return msgs;
}

interface InfoRequestsModuleProps {
  currentRole: AdminRole | string;
  senderNameOverride?: string;
  compactHeader?: boolean;
  onNavigateToPv?: () => void;
}

export const InfoRequestsModule: React.FC<InfoRequestsModuleProps> = ({
  currentRole,
  senderNameOverride,
}) => {
  const {
    currentUser,
    infoRequests = [],
    members = [],
    createInfoRequest,
    replyInfoRequest,
    closeInfoRequest,
    markInfoRequestRead,
    deleteInfoRequest,
    refreshNavette,
    isRefreshingData,
  } = useApp();

  // 1. VÉRIFICATION RBAC STRICTE
  const isEligible = isRoleEligibleForInfoModule(currentRole);
  const normalizedCurrentDeptKey = normalizeToEligibleDeptKey(currentRole);
  const currentDeptConfig = getEligibleDeptConfig(normalizedCurrentDeptKey);

  // Nom de l'émetteur courant
  const senderDisplayName = useMemo(() => {
    if (senderNameOverride) return senderNameOverride;
    if (currentUser?.type === 'MEMBER' && currentUser.member) {
      return `${currentUser.member.firstName} (${currentUser.member.nickname})`.trim();
    }
    return currentDeptConfig?.name || String(currentRole);
  }, [senderNameOverride, currentUser, currentDeptConfig, currentRole]);

  // États locaux du module avec persistance du choix de vue par département
  const [activeView, setActiveView] = useState<'ALL' | 'RECEIVED' | 'SENT' | 'COMPOSE'>(() => {
    try {
      const saved = localStorage.getItem(`erouama_navette_view_${normalizedCurrentDeptKey}`);
      if (saved === 'ALL' || saved === 'RECEIVED' || saved === 'SENT' || saved === 'COMPOSE') {
        return saved;
      }
    } catch {}
    return 'ALL';
  });

  const handleSelectView = (view: 'ALL' | 'RECEIVED' | 'SENT' | 'COMPOSE') => {
    setActiveView(view);
    try {
      localStorage.setItem(`erouama_navette_view_${normalizedCurrentDeptKey}`, view);
    } catch {}
  };
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'PENDING' | 'REPLIED' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Formulaire "Nouvelle Navette d'Échange"
  const [targetDeptKey, setTargetDeptKey] = useState<string>(() => {
    const firstOther = ELIGIBLE_ADMIN_DEPARTMENTS.find(d => d.key !== normalizedCurrentDeptKey);
    return firstOther ? firstOther.key : 'TRESORIER';
  });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zone de réponse active sous les fils de discussion
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [isReplyingId, setIsReplyingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Filtrage harmonisé des demandes pour ce département (Émis ET Reçus sans perte)
  // 1. Demandes Reçues (adressées à ce département ou ses alias)
  const receivedRequests = useMemo(() => {
    return (infoRequests || []).filter(req => {
      return isDeptMatch(req.recipientRole, normalizedCurrentDeptKey) ||
             isDeptMatch(req.recipientRoleLabel, normalizedCurrentDeptKey);
    });
  }, [infoRequests, normalizedCurrentDeptKey]);

  // 2. Demandes Émises (envoyées par ce département ou ses alias)
  const sentRequests = useMemo(() => {
    return (infoRequests || []).filter(req => {
      return isDeptMatch(req.senderRole, normalizedCurrentDeptKey) ||
             isDeptMatch(req.senderRoleLabel, normalizedCurrentDeptKey);
    });
  }, [infoRequests, normalizedCurrentDeptKey]);

  // 3. Tous les échanges du département (Émis ET Reçus consolidés sans perte lors du changement de section)
  const allDeptRequests = useMemo(() => {
    const map = new Map<string, InfoRequest>();
    (infoRequests || []).forEach(req => {
      const isRec = isDeptMatch(req.recipientRole, normalizedCurrentDeptKey) ||
                    isDeptMatch(req.recipientRoleLabel, normalizedCurrentDeptKey);
      const isSent = isDeptMatch(req.senderRole, normalizedCurrentDeptKey) ||
                     isDeptMatch(req.senderRoleLabel, normalizedCurrentDeptKey);
      if (isRec || isSent) {
        map.set(req.id, req);
      }
    });
    const list = Array.from(map.values());
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  }, [infoRequests, normalizedCurrentDeptKey]);

  // Helper pour obtenir le statut dynamique du fil d'échange
  const getDynamicStatus = (req: InfoRequest) => {
    const isClosed = req.isClosed || req.status === 'Clôturé';
    if (isClosed) {
      return {
        key: 'CLOSED' as const,
        label: 'Clôturée / Solvabilisée',
        badgeBg: 'bg-slate-700/60',
        badgeText: 'text-slate-300',
        borderColor: 'border-slate-600',
        icon: '✓',
        isPendingResponse: false,
      };
    }

    const thread = getThreadMessages(req);
    const lastMsg = thread[thread.length - 1];

    // Si le dernier message vient de l'émetteur initial -> "En attente de réponse"
    const isLastFromSender =
      !lastMsg ||
      normalizeToEligibleDeptKey(lastMsg.senderRole) === normalizeToEligibleDeptKey(req.senderRole);

    if (isLastFromSender) {
      return {
        key: 'PENDING' as const,
        label: 'En attente de réponse',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        icon: '⏳',
        isPendingResponse: true,
        pendingForDeptKey: normalizeToEligibleDeptKey(req.recipientRole),
      };
    } else {
      return {
        key: 'REPLIED' as const,
        label: 'Répondu / En cours d’échange',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        icon: '💬',
        isPendingResponse: false,
        pendingForDeptKey: normalizeToEligibleDeptKey(req.senderRole),
      };
    }
  };

  // Compteurs dynamiques
  const currentViewList = useMemo(() => {
    if (activeView === 'RECEIVED') return receivedRequests;
    if (activeView === 'SENT') return sentRequests;
    return allDeptRequests;
  }, [activeView, receivedRequests, sentRequests, allDeptRequests]);

  const unreadCount = useMemo(() => {
    return receivedRequests.filter(r => !r.isRead).length;
  }, [receivedRequests]);

  const pendingCount = useMemo(() => {
    return currentViewList.filter(r => getDynamicStatus(r).key === 'PENDING').length;
  }, [currentViewList]);

  const repliedCount = useMemo(() => {
    return currentViewList.filter(r => getDynamicStatus(r).key === 'REPLIED').length;
  }, [currentViewList]);

  const closedCount = useMemo(() => {
    return currentViewList.filter(r => getDynamicStatus(r).key === 'CLOSED').length;
  }, [currentViewList]);

  // Filtrage par texte et statut pour la vue active
  const displayedRequests = useMemo(() => {
    return currentViewList.filter(req => {
      const statusInfo = getDynamicStatus(req);

      // Filtre statut
      if (statusFilter === 'UNREAD' && req.isRead) return false;
      if (statusFilter === 'PENDING' && statusInfo.key !== 'PENDING') return false;
      if (statusFilter === 'REPLIED' && statusInfo.key !== 'REPLIED') return false;
      if (statusFilter === 'CLOSED' && statusInfo.key !== 'CLOSED') return false;

      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubj = req.subject?.toLowerCase().includes(q);
        const matchSender = req.senderName?.toLowerCase().includes(q);
        const matchThread = getThreadMessages(req).some(m =>
          m.message?.toLowerCase().includes(q) || m.senderName?.toLowerCase().includes(q)
        );
        return matchSubj || matchSender || matchThread;
      }
      return true;
    });
  }, [currentViewList, statusFilter, searchQuery]);

  // Soumission d'une nouvelle demande (création du premier message du fil)
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptKey) {
      setFeedbackToast({ type: 'error', message: 'Veuillez sélectionner un département destinataire.' });
      return;
    }
    if (!subject.trim()) {
      setFeedbackToast({ type: 'error', message: "Veuillez préciser l'objet de votre échange." });
      return;
    }
    if (!message.trim()) {
      setFeedbackToast({ type: 'error', message: 'Veuillez rédiger le premier message de votre échange.' });
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
          message: `Fil d'échange ouvert avec succès vers : ${recipientConfig?.name || targetDeptKey}`,
        });
        handleSelectView('SENT');
      } else {
        setFeedbackToast({ type: 'error', message: res.message || "Échec de l'ouverture du fil d'échange." });
      }
    } catch (err: any) {
      setFeedbackToast({ type: 'error', message: err?.message || 'Erreur inattendue.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Traitement d'une réponse continue dans le fil de discussion
  const handleSendReply = async (requestId: string) => {
    const text = replyInputs[requestId];
    if (!text || !text.trim()) {
      setFeedbackToast({ type: 'error', message: 'Veuillez rédiger votre réponse avant d’envoyer.' });
      return;
    }

    setIsReplyingId(requestId);
    setFeedbackToast(null);

    try {
      const res = await replyInfoRequest(
        requestId,
        text.trim(),
        senderDisplayName,
        normalizedCurrentDeptKey,
        currentDeptConfig?.name || normalizedCurrentDeptKey
      );
      if (res.success) {
        setFeedbackToast({ type: 'success', message: 'Message ajouté au fil de discussion en temps réel !' });
        setReplyInputs(prev => ({ ...prev, [requestId]: '' }));
      } else {
        setFeedbackToast({ type: 'error', message: res.message || "Échec de l'envoi du message." });
      }
    } catch (err: any) {
      setFeedbackToast({ type: 'error', message: err?.message || 'Erreur inattendue.' });
    } finally {
      setIsReplyingId(null);
    }
  };

  // Clôture ou réouverture de la navette d'échange
  const handleToggleClose = async (req: InfoRequest) => {
    const isCurrentlyClosed = req.isClosed || req.status === 'Clôturé';
    setClosingId(req.id);
    setFeedbackToast(null);

    try {
      const res = await closeInfoRequest(req.id, senderDisplayName, isCurrentlyClosed);
      if (res.success) {
        setFeedbackToast({
          type: 'success',
          message: isCurrentlyClosed
            ? 'Le fil d’échange a été réouvert. Les réponses peuvent continuer.'
            : 'La navette a été marquée comme Clôturée / Solvabilisée.',
        });
      } else {
        setFeedbackToast({ type: 'error', message: res.message || "Échec de l'opération." });
      }
    } catch (err: any) {
      setFeedbackToast({ type: 'error', message: err?.message || 'Erreur inattendue.' });
    } finally {
      setClosingId(null);
    }
  };

  // Basculer l'affichage détaillé et marquer comme lu
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
          Conformément aux directives RBAC strictes, la <strong>Navette d'Échange</strong> est réservée
          exclusivement aux commissions opérationnelles (Secrétariat, Trésorerie, Organisation, Projets AGR, Suivi
          Programme, Spiritualité, Payor et Communication). La Présidence (CERVEAU) et le Super Admin sont strictement
          exclus des correspondances bilatérales opérationnelles.
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

      {/* BANNIÈRE D'EN-TÊTE DU MODULE : NAVETTE D'ÉCHANGE */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-black tracking-wide">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>NAVETTE D'ÉCHANGE • FIL DE DISCUSSION CONTINU</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 flex-wrap">
              <span>NAVETTE D'ÉCHANGE</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-xl font-bold border ${currentDeptConfig?.badgeBg} ${currentDeptConfig?.badgeText} ${currentDeptConfig?.borderColor}`}
              >
                {currentDeptConfig?.icon} {currentDeptConfig?.name}
              </span>
            </h2>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Canal officiel d'échanges continus entre départements administratifs. Chaque requête constitue un fil de
              discussion interactif : répondez à la suite sans verrouillage pour coordonner les résolutions et marquez la
              navette comme clôturée une fois résolue.
            </p>
          </div>

          {/* KPI RÉCAPITULATIFS EN TEMPS RÉEL */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[90px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non lues</div>
              <div className="text-xl font-black text-rose-400 font-mono flex items-center justify-center gap-1">
                <span>{unreadCount}</span>
                {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[90px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En attente</div>
              <div className="text-xl font-black text-amber-400 font-mono">{pendingCount}</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[90px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En échange</div>
              <div className="text-xl font-black text-emerald-400 font-mono">{repliedCount}</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl min-w-[90px] text-center shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clôturées</div>
              <div className="text-xl font-black text-slate-400 font-mono">{closedCount}</div>
            </div>
          </div>
        </div>

        {/* BARRE D'ONGLETS / VUES */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectView('ALL')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>TOUS LES ÉCHANGES ({allDeptRequests.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectView('RECEIVED')}
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
              onClick={() => handleSelectView('SENT')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'SENT'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <SendHorizontal className="w-4 h-4" />
              <span>NAVETTES ÉMISES ({sentRequests.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshNavette()}
              disabled={isRefreshingData}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer disabled:opacity-50"
              title="Actualiser ponctuellement les navettes d'échange sans boucle temps réel"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshingData ? 'animate-spin' : ''}`} />
              <span>{isRefreshingData ? 'Actualisation...' : '🔄 Actualiser les données'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectView(activeView === 'COMPOSE' ? 'ALL' : 'COMPOSE')}
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
                  <span>NOUVELLE NAVETTE D'ÉCHANGE</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. FORMULAIRE "NOUVELLE NAVETTE" (OUVERTURE D'UN NOUVEAU FIL) */}
      {/* ========================================================= */}
      {activeView === 'COMPOSE' && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Ouvrir une Navette d'Échange</h3>
                <p className="text-xs text-slate-400">
                  Votre message initial ouvrira un fil de discussion bilatéral continu avec la commission destinataire.
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
                  <span>Commission Destinataire *</span>
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
                  <span>Objet de la navette d'échange *</span>
                </label>
                <span className="text-[10px] text-slate-500">Précisez le contexte du dossier</span>
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

            {/* Corps du message initial */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Message Initial & Détails de la Requête *</span>
              </label>
              <textarea
                rows={5}
                placeholder="Rédigez votre demande d'éclaircissement, les questions précises, les montants à certifier..."
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
                    <span>Création du fil...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>OUVRIR LA NAVETTE D'ÉCHANGE</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. LISTE DES FILS D'ÉCHANGE (RÉCEPTION OU ENVOYÉES) */}
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
                  placeholder="Rechercher par objet, message, auteur..."
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
                Toutes ({currentViewList.length})
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
                🟡 En attente de réponse
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
                🟢 En cours d'échange
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === 'CLOSED'
                    ? 'bg-slate-600 text-white font-black'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                ⚪ Clôturées
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
                  ? 'Aucune navette d’échange reçue dans cette catégorie'
                  : 'Aucune navette émise trouvée'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {activeView === 'RECEIVED'
                  ? "Vous n'avez aucun fil d'échange actif adressé à votre commission pour ces critères."
                  : "Vous n'avez pas encore initié de fil d'échange. Cliquez sur 'Nouvelle Navette d'Échange' pour démarrer une conversation avec une commission."}
              </p>
              {activeView === 'RECEIVED' && (
                <button
                  type="button"
                  onClick={() => setActiveView('COMPOSE')}
                  className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Initier une navette d'échange</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedRequests.map(req => {
                const isReceived = isDeptMatch(req.recipientRole, normalizedCurrentDeptKey) ||
                                   isDeptMatch(req.recipientRoleLabel, normalizedCurrentDeptKey);
                const otherDeptKey = isReceived ? req.senderRole : req.recipientRole;
                const otherDeptConfig = getEligibleDeptConfig(normalizeToEligibleDeptKey(otherDeptKey));
                const isExpanded = expandedRequestId === req.id;
                const threadMessages = getThreadMessages(req);
                const statusInfo = getDynamicStatus(req);
                const isClosed = req.isClosed || req.status === 'Clôturé';

                // Contact WhatsApp pour la relance si nécessaire
                const otherContact = getDepartmentContact(otherDeptKey, members);
                const whatsappText = encodeURIComponent(
                  `Bonjour ${otherContact.name}, concernant la navette d'échange "${req.subject}" (Réf: ${req.id}), nous attendons votre retour pour faire avancer le dossier. Merci d'avance !`
                );
                const whatsappUrl = `https://wa.me/${otherContact.cleanPhone}?text=${whatsappText}`;

                const initialDateStr = req.createdAt
                  ? new Date(req.createdAt).toLocaleDateString('fr-FR', {
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
                        : isClosed
                        ? 'border-slate-800/80 bg-slate-950/40 opacity-90'
                        : statusInfo.key === 'REPLIED'
                        ? 'border-slate-800 hover:border-emerald-500/40'
                        : 'border-slate-800 hover:border-amber-500/30'
                    }`}
                  >
                    {/* EN-TÊTE DE LA CARTE DE NAVETTE */}
                    <div
                      onClick={() => handleToggleExpand(req)}
                      className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-start gap-3">
                        {/* Indicateur de lecture / statut */}
                        <div className="pt-0.5">
                          {!req.isRead && isReceived ? (
                            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm animate-pulse" />
                          ) : isClosed ? (
                            <CheckCheck className="w-4 h-4 text-slate-400" />
                          ) : statusInfo.key === 'REPLIED' ? (
                            <MessageCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400" />
                          )}
                        </div>

                        <div className="space-y-1">
                          {/* Badges départements & statut */}
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
                                {isReceived
                                  ? `De : ${otherDeptConfig?.name || req.senderRoleLabel || req.senderRole}`
                                  : `Pour : ${otherDeptConfig?.name || req.recipientRoleLabel || req.recipientRole}`}
                              </span>
                            </span>

                            {/* Indicateur de sens Reçue / Émise */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                isReceived
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              <span>{isReceived ? '📥 Reçue' : '📤 Émise'}</span>
                            </span>

                            {/* Statut dynamique */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.borderColor}`}
                            >
                              <span>{statusInfo.icon}</span>
                              <span>{statusInfo.label}</span>
                            </span>

                            {/* Badge nombre de messages dans le fil */}
                            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-indigo-400" />
                              <span>{threadMessages.length} message{threadMessages.length > 1 ? 's' : ''}</span>
                            </span>

                            {!req.isRead && isReceived && (
                              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2 py-0.5 rounded-md">
                                🔴 Non lu
                              </span>
                            )}
                          </div>

                          {/* Objet de la navette */}
                          <h4 className="text-sm sm:text-base font-black text-white hover:text-indigo-300 transition-colors">
                            {req.subject}
                          </h4>

                          {/* Auteur initial & Date d'ouverture */}
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                            <span>
                              Initié par : <strong className="text-slate-300">{req.senderName || req.senderRole}</strong>
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{initialDateStr}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-slate-500">{req.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1"
                        >
                          {isExpanded ? <span>Masquer le fil</span> : <span>Consulter / Répondre</span>}
                        </button>
                      </div>
                    </div>

                    {/* ========================================================= */}
                    {/* CONTENU DU FIL DE DISCUSSION DÉPLIÉ (THREAD CHRONOLOGIQUE) */}
                    {/* ========================================================= */}
                    {isExpanded && (
                      <div className="px-5 pb-6 pt-3 border-t border-slate-800/80 space-y-6 animate-fadeIn">
                        {/* 1. FIL DES MESSAGES SUCCESSIFS CHRONOLOGIQUES */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
                            <span className="flex items-center gap-2 text-indigo-300">
                              <MessageSquare className="w-4 h-4" />
                              <span>Fil d'échange continu ({threadMessages.length} intervention{threadMessages.length > 1 ? 's' : ''})</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">ID: {req.id}</span>
                          </div>

                          <div className="space-y-3.5 pt-1">
                            {threadMessages.map((msg, idx) => {
                              const isFromCurrentDept =
                                isDeptMatch(msg.senderRole, normalizedCurrentDeptKey) ||
                                isDeptMatch(msg.senderRoleLabel, normalizedCurrentDeptKey);
                              const msgDeptConfig = getEligibleDeptConfig(normalizeToEligibleDeptKey(msg.senderRole));
                              const msgTimeStr = msg.createdAt
                                ? new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '';

                              return (
                                <div
                                  key={msg.id || idx}
                                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                    isFromCurrentDept
                                      ? 'bg-slate-950 border-indigo-500/30'
                                      : 'bg-slate-950/90 border-slate-800'
                                  }`}
                                >
                                  {/* En-tête du message dans le fil */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                          msgDeptConfig?.badgeBg || 'bg-slate-800'
                                        } ${msgDeptConfig?.badgeText || 'text-white'} ${
                                          msgDeptConfig?.borderColor || 'border-slate-700'
                                        }`}
                                      >
                                        <span>{msgDeptConfig?.icon || '🛡️'}</span>
                                        <span>{msgDeptConfig?.name || msg.senderRoleLabel || msg.senderRole}</span>
                                      </span>

                                      <span className="text-xs font-bold text-white">
                                        {msg.senderName}
                                      </span>

                                      {isFromCurrentDept && (
                                        <span className="text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded">
                                          Votre commission
                                        </span>
                                      )}

                                      {idx === 0 && (
                                        <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">
                                          Demande initiale
                                        </span>
                                      )}
                                    </div>

                                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-600" />
                                      <span>{msgTimeStr}</span>
                                    </span>
                                  </div>

                                  {/* Corps du message */}
                                  <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                                    {msg.message}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. ÉTAT CLÔTURÉ OU CHAMP DE RÉPONSE ACTIVE */}
                        {isClosed ? (
                          <div className="bg-slate-950 border border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-white flex items-center gap-2">
                                  <span>Navette Clôturée / Solvabilisée</span>
                                  <span className="text-[10px] text-emerald-400 font-normal">Dossier résolu</span>
                                </h5>
                                <p className="text-[11px] text-slate-400">
                                  {req.closedBy ? `Clôturé par ${req.closedBy}` : 'Échange terminé'}
                                  {req.closedAt
                                    ? ` le ${new Date(req.closedAt).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`
                                    : ''}
                                  . Ce fil ne reçoit plus de messages sauf en cas de réouverture explicite.
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={closingId === req.id}
                              onClick={() => handleToggleClose(req)}
                              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {closingId === req.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>Réouvrir le fil d'échange</span>
                            </button>
                          </div>
                        ) : (
                          /* ZONE ACTIVE DE RÉPONSE CONTINUE : ACCESSIBLE AUX DEUX PARTIES */
                          <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-indigo-500/30 space-y-3 shadow-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <label className="text-xs font-black text-white flex items-center gap-2">
                                <Send className="w-3.5 h-3.5 text-amber-400" />
                                <span>Répondre à la suite...</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  (au nom de {currentDeptConfig?.shortName})
                                </span>
                              </label>

                              {/* Bouton de relance WhatsApp si en attente */}
                              {statusInfo.key === 'PENDING' && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-[11px] font-bold transition-all"
                                  title={`Envoyer un rappel WhatsApp à ${otherContact.name} (${otherDeptConfig?.shortName})`}
                                >
                                  <PhoneCall className="w-3 h-3 text-emerald-400" />
                                  <span>Relancer {otherContact.name} sur WhatsApp</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-emerald-500/60" />
                                </a>
                              )}
                            </div>

                            <textarea
                              rows={3}
                              placeholder="Apportez une précision, confirmez un montant, répondez à la question ou fournissez les motifs..."
                              value={replyInputs[req.id] || ''}
                              onChange={e =>
                                setReplyInputs(prev => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 resize-y leading-relaxed"
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                              {/* Option de clôture définitive */}
                              <button
                                type="button"
                                disabled={closingId === req.id}
                                onClick={() => handleToggleClose(req)}
                                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-800 cursor-pointer disabled:opacity-50"
                                title="Marquer cette navette comme terminée lorsque l'information recherchée a été entièrement fournie"
                              >
                                {closingId === req.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                                <span>Marquer comme Clôturée / Solvabilisée</span>
                              </button>

                              {/* Bouton d'envoi de la réponse dans le fil */}
                              <button
                                type="button"
                                disabled={isReplyingId === req.id || !replyInputs[req.id]?.trim()}
                                onClick={() => handleSendReply(req.id)}
                                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                              >
                                {isReplyingId === req.id ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Transmission...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Envoyer dans le fil d'échange</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Actions secondaires et suppression */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/60">
                          <span className="font-mono text-[10px]">Identifiant Unique : {req.id}</span>
                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => deleteInfoRequest(req.id)}
                              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1 hover:underline"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Supprimer cette navette</span>
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
