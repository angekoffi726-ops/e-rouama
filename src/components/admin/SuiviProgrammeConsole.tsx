import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import {
  AdminRole,
  EventActivity,
  ReligiousEvent,
  AgrProject,
  InfoRequest,
  RouamaMember,
  NewsItem,
} from '../../types';
import {
  Shield,
  Calendar,
  Search,
  Filter,
  Eye,
  RefreshCw,
  BarChart3,
  MessageSquare,
  CheckCircle,
  XCircle,
  MessageCircle,
  ExternalLink,
  Sparkles,
  MapPin,
  Bell,
  Clock,
  PhoneCall,
  Check,
  Building2,
  Send,
  AlertCircle,
  TrendingUp,
  Newspaper,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  X,
  Trash2,
  Lock,
  CheckCheck,
} from 'lucide-react';
import { InfoRequestsModule } from './InfoRequestsModule';
import { OFFICIAL_DEPARTMENTS } from '../../data/departmentMapping';


// Helper: Calcul de la date de relance à 1 mois avant la date de l'événement
export function calculateReminderDate(dateStr?: string): {
  reminderDateStr: string;
  isPast: boolean;
  isDueForReminder: boolean;
} {
  if (!dateStr || !dateStr.trim()) {
    return {
      reminderDateStr: 'Date non définie',
      isPast: false,
      isDueForReminder: false,
    };
  }

  const clean = dateStr.trim();
  const monthsFr: Record<string, number> = {
    janvier: 0,
    fevrier: 1,
    'février': 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    aout: 7,
    'août': 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    decembre: 11,
    'décembre': 11,
  };

  const monthNamesFr = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Pattern 1 : Jour Mois Année (ex: "21 Mars 2027", "10 septembre 2027", "19 Décembre 2026")
  const dayMonthNameYearRegex = /^(\d{1,2})\s+([a-zA-Z\u00C0-\u00FF]+)\s+(\d{4})/i;
  const match1 = clean.match(dayMonthNameYearRegex);
  if (match1) {
    const day = parseInt(match1[1], 10);
    const mName = match1[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const year = parseInt(match1[3], 10);

    const mIdx = Object.keys(monthsFr).find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === mName);
    if (mIdx !== undefined) {
      const monthNumber = monthsFr[mIdx];
      let prevMonth = monthNumber - 1;
      let prevYear = year;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      const maxDaysInPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
      const actualDay = Math.min(day, maxDaysInPrev);
      const reminderDateStr = `${actualDay} ${monthNamesFr[prevMonth]} ${prevYear}`;

      const targetEventDate = new Date(year, monthNumber, day, 23, 59, 59);
      const reminderDateObj = new Date(prevYear, prevMonth, actualDay, 0, 0, 0);
      const now = new Date();
      const isPast = targetEventDate.getTime() < now.getTime();
      const isDueForReminder = !isPast && now.getTime() >= reminderDateObj.getTime();

      return {
        reminderDateStr,
        isPast,
        isDueForReminder,
      };
    }
  }

  // Pattern 2 : Mois Année uniquement (ex: "Décembre 2026", "Septembre 2027")
  const monthNameYearRegex = /^([a-zA-Z\u00C0-\u00FF]+)\s+(\d{4})/i;
  const match2 = clean.match(monthNameYearRegex);
  if (match2) {
    const mName = match2[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const year = parseInt(match2[2], 10);
    const mIdx = Object.keys(monthsFr).find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === mName);
    if (mIdx !== undefined) {
      const monthNumber = monthsFr[mIdx];
      let prevMonth = monthNumber - 1;
      let prevYear = year;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      const reminderDateStr = `${monthNamesFr[prevMonth]} ${prevYear}`;
      const reminderDateObj = new Date(prevYear, prevMonth, 1, 0, 0, 0);
      const targetEventDate = new Date(year, monthNumber + 1, 0, 23, 59, 59);
      const now = new Date();
      const isPast = targetEventDate.getTime() < now.getTime();
      const isDueForReminder = !isPast && now.getTime() >= reminderDateObj.getTime();

      return {
        reminderDateStr,
        isPast,
        isDueForReminder,
      };
    }
  }

  // Pattern 3 : Format standard DD/MM/YYYY ou YYYY-MM-DD
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    const maxDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    const actualDay = Math.min(day, maxDays);
    const reminderDateStr = `${actualDay} ${monthNamesFr[prevMonth]} ${prevYear}`;
    const targetEventDate = new Date(year, month, day, 23, 59, 59);
    const reminderDateObj = new Date(prevYear, prevMonth, actualDay, 0, 0, 0);
    const now = new Date();
    const isPast = targetEventDate.getTime() < now.getTime();
    const isDueForReminder = !isPast && now.getTime() >= reminderDateObj.getTime();
    return {
      reminderDateStr,
      isPast,
      isDueForReminder,
    };
  }

  return {
    reminderDateStr: `1 mois avant (${clean})`,
    isPast: false,
    isDueForReminder: false,
  };
}

// Helper: Nettoyage et nom affiché des départements
export function getDepartmentDisplayName(role?: string): string {
  if (!role) return 'Département';
  const clean = role.toUpperCase().trim();
  if (clean.includes('ORGANIS')) return 'Commission Organisation';
  if (clean.includes('TRESOR')) return 'Trésorerie Générale';
  if (clean.includes('PROJET') || clean.includes('AGR')) return 'Commission Projets (AGR)';
  if (clean.includes('SPIRIT')) return 'Département Spiritualité';
  if (clean.includes('SECRETAR') || clean === 'SG') return 'Secrétariat Général';
  if (clean.includes('COM') || clean.includes('BIC')) return "Communication (BIC)";
  if (clean.includes('CERVEAU') || clean.includes('PRESID')) return 'Le Cerveau (Présidence)';
  if (clean.includes('PAYOR')) return 'Espace Payor';
  if (clean.includes('SDP') || clean.includes('PROGRAMME')) return 'Suivi du Programme (SDP)';
  return role;
}

// Helper: Recherche du contact WhatsApp du département
export function getDepartmentContact(
  deptRole: string,
  membersList: RouamaMember[]
): { name: string; phone: string; cleanPhone: string } {
  const cleanRole = (deptRole || '').toUpperCase().trim();
  const dept = OFFICIAL_DEPARTMENTS.find(d => {
    const dRole = (d.adminRole || '').toUpperCase();
    return cleanRole === dRole || cleanRole.includes(dRole) || dRole.includes(cleanRole);
  });

  if (dept && dept.managerMemberIds && dept.managerMemberIds.length > 0) {
    const member = membersList.find(m => dept.managerMemberIds.includes(String(m.id)));
    if (member && member.phone) {
      return {
        name: member.nickname || member.firstName,
        phone: member.phone,
        cleanPhone: member.phone.replace(/[^0-9]/g, ''),
      };
    }
  }

  // Fallbacks officiels vérifiés
  if (cleanRole.includes('TRESOR')) return { name: 'Léger', phone: '2250757537785', cleanPhone: '2250757537785' };
  if (cleanRole.includes('SECRETAR')) return { name: 'Josiane', phone: '2250747195076', cleanPhone: '2250747195076' };
  if (cleanRole.includes('ORGANIS')) return { name: 'Emile / Otinel', phone: '2250544996236', cleanPhone: '2250544996236' };
  if (cleanRole.includes('PROJET')) return { name: 'Ulrich / Gilbert', phone: '2250701137891', cleanPhone: '2250701137891' };
  if (cleanRole.includes('SPIRIT')) return { name: 'Marie / Cyprien', phone: '2250564281013', cleanPhone: '2250564281013' };
  if (cleanRole.includes('COM')) return { name: 'Désiré / Esther', phone: '2250584346071', cleanPhone: '2250584346071' };
  if (cleanRole.includes('PAYOR')) return { name: 'Woya Sylas', phone: '2250703567992', cleanPhone: '2250703567992' };
  if (cleanRole.includes('CERVEAU')) return { name: 'Wilfried', phone: '2250501948962', cleanPhone: '2250501948962' };

  return { name: 'Responsable', phone: '2250501948962', cleanPhone: '2250501948962' };
}

// Modèle unifié pour les activités des départements (Organisation, Spiritualité, Projets)
interface DepartmentActivityViewItem {
  id: string;
  departmentKey: 'ORGANISATION' | 'SPIRITUALITE' | 'PROJET';
  departmentName: string;
  departmentIcon: string;
  departmentBadgeColor: string;
  title: string;
  date: string;
  location: string;
  reminderDate: string;
  isPast: boolean;
  isDueForReminder: boolean;
  statusLabel?: string;
  description?: string;
}

interface SuiviProgrammeConsoleProps {
  activeRole?: AdminRole;
  onPreviewOfficialDoc?: (kind: 'ORGANISATION' | 'PROJET' | 'SPIRITUALITE', id: string, batchId?: string) => void;
}

export const SuiviProgrammeConsole: React.FC<SuiviProgrammeConsoleProps> = ({ onPreviewOfficialDoc }) => {
  const {
    members = [],
    activities = [],
    projects = [],
    religiousEvents = [],
    infoRequests = [],
    newsItems = [],
    getMemberDuesStatus,
    markNewsAsRead,
    markAllGbairaiAsRead,
    sendActivityFromSecretariatToPayor,
    sendActivitiesBatchFromSecretariatToPayor,
    sendProjectFromSecretariatToPayor,
    sendProjectsBatchFromSecretariatToPayor,
    sendReligiousEventFromSecretariatToPayor,
    sendReligiousEventsBatchFromSecretariatToPayor,
    deleteInfoRequest,
    closeInfoRequest,
    dismissedDemoRequestIds = [],
    demosDisabled = false,
    dismissDemoInfoRequests,
  } = useApp();

  // Navigation par onglets clairs et structurés
  const [activeTab, setActiveTab] = useState<'ACTIVITES' | 'DEMANDES_INFO' | 'GBAIRAI_READS' | 'NAVETTE'>('ACTIVITES');

  // Filtres pour le suivi des lectures Gbairai
  const [gbairaiFilter, setGbairaiFilter] = useState<'ALL' | 'UNREAD' | 'ALL_READ'>('ALL');
  const [gbairaiSearchQuery, setGbairaiSearchQuery] = useState<string>('');
  const [expandedMemberGbairaiId, setExpandedMemberGbairaiId] = useState<string | null>(null);
  const [gbairaiFeedbackToast, setGbairaiFeedbackToast] = useState<string | null>(null);

  // Filtres pour la rubrique Activités
  const [activityDeptFilter, setActivityDeptFilter] = useState<'ALL' | 'ORGANISATION' | 'SPIRITUALITE' | 'PROJET'>('ALL');
  const [activitySearchQuery, setActivitySearchQuery] = useState<string>('');

  // Filtres & suppression pour la rubrique Demandes d'Information
  const [infoFilter, setInfoFilter] = useState<'ALL' | 'PENDING' | 'REPLIED'>('ALL');
  const [infoSearchQuery, setInfoSearchQuery] = useState<string>('');
  const [cadrageToast, setCadrageToast] = useState<string | null>(null);
  const [confirmDeleteInfoId, setConfirmDeleteInfoId] = useState<string | null>(null);
  const [deletingInfoId, setDeletingInfoId] = useState<string | null>(null);
  const [confirmPurgeInfo, setConfirmPurgeInfo] = useState(false);
  const [isPurgingInfo, setIsPurgingInfo] = useState(false);
  const [infoActionToast, setInfoActionToast] = useState<string | null>(null);

  const sdpUnreadNavetteCount = useMemo(() => {
    return (infoRequests || []).filter(
      r =>
        !r.isRead &&
        (String(r.recipientRole || '').toUpperCase().includes('SDP') ||
          String(r.recipientRoleLabel || '').toLowerCase().includes('suivi'))
    ).length;
  }, [infoRequests]);

  const orgDeptCount = useMemo(
    () => allDepartmentActivitiesCountByDept(activities, projects, religiousEvents, 'ORGANISATION'),
    [activities, projects, religiousEvents]
  );

  const workflowTransitItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'ORGANISATION' | 'PROJET' | 'SPIRITUALITE';
      deptLabel: string;
      icon: string;
      title: string;
      dateLabel: string;
      status: string;
      payorFeedback?: string;
      sentToSuivi?: boolean;
      suiviReviewed?: boolean;
      isPostMeetingRevision?: boolean;
      isConsolidated?: boolean;
      batchId?: string;
      batchIds?: string[];
      batchTitles?: string[];
      batchCount?: number;
    }> = [];

    const resolveBatchStatus = (statuses: string[]): string => {
      if (statuses.includes('SENT_TO_SUIVI')) return 'SENT_TO_SUIVI';
      if (statuses.includes('SENT_TO_SECRETARIAT')) return 'SENT_TO_SECRETARIAT';
      if (statuses.includes('returned_for_correction')) return 'returned_for_correction';
      if (statuses.includes('PENDING_PAYOR') || statuses.includes('pending_payor_approval')) return 'PENDING_PAYOR';
      return statuses[0] || 'APPROVED';
    };

    const isTransitStatus = (s: string) =>
      s === 'SENT_TO_SUIVI' ||
      s === 'SENT_TO_SECRETARIAT' ||
      s === 'PENDING_PAYOR' ||
      s === 'pending_payor_approval' ||
      s === 'APPROVED' ||
      s === 'approved_by_payor' ||
      s === 'APPROVED_PAYOR' ||
      s === 'returned_for_correction';

    // 1. ORGANISATION : Regrouper les lots consolidés par batchId
    const orgBatchMap = new Map<string, EventActivity[]>();
    (activities || []).forEach(a => {
      const s = String(a.status || 'DRAFT').trim();
      if (s === 'ARCHIVED' || s === 'PUBLISHED' || s === 'DRAFT') return;
      const isPostRevision = Boolean(a.isPostMeetingRevision || a.suiviReviewed);
      if (isPostRevision && (s === 'SENT_TO_SECRETARIAT' || s === 'returned_for_correction')) return;
      if (!isTransitStatus(s)) return;

      if (a.isConsolidated && a.batchId) {
        const list = orgBatchMap.get(a.batchId) || [];
        list.push(a);
        orgBatchMap.set(a.batchId, list);
      } else {
        items.push({
          id: a.id,
          kind: 'ORGANISATION',
          deptLabel: 'Organisation (SHOW)',
          icon: '🎪',
          title: a.title,
          dateLabel: a.eventDate || 'Date à définir',
          status: s,
          payorFeedback: a.payorFeedback,
          sentToSuivi: a.sentToSuivi,
          suiviReviewed: a.suiviReviewed,
          isPostMeetingRevision: a.isPostMeetingRevision,
        });
      }
    });
    orgBatchMap.forEach((batchActs, batchId) => {
      const first = batchActs[0];
      const fullBatch = (activities || []).filter(item => item.batchId === batchId);
      const statuses = batchActs.map(x => String(x.status || 'DRAFT').trim());
      items.push({
        id: first.id,
        kind: 'ORGANISATION',
        deptLabel: 'Organisation (SHOW)',
        icon: '🎪',
        title: first.batchTitle || `Programme Global d'Activités (${fullBatch.length} activités)`,
        dateLabel: fullBatch.map(x => x.eventDate || 'À définir').join(' • '),
        status: resolveBatchStatus(statuses),
        payorFeedback: batchActs.find(x => x.payorFeedback)?.payorFeedback,
        sentToSuivi: batchActs.some(x => x.sentToSuivi),
        suiviReviewed: batchActs.some(x => x.suiviReviewed),
        isPostMeetingRevision: batchActs.some(x => x.isPostMeetingRevision),
        isConsolidated: true,
        batchId,
        batchIds: fullBatch.map(x => x.id),
        batchTitles: fullBatch.map(x => x.title),
        batchCount: fullBatch.length,
      });
    });

    // 2. PROJETS (AGR) : Regrouper les lots consolidés par batchId
    const projBatchMap = new Map<string, AgrProject[]>();
    (projects || []).forEach(p => {
      const s = String(p.status || 'DRAFT').trim();
      if (s === 'ARCHIVED' || s === 'PUBLISHED' || s === 'active' || s === 'DRAFT') return;
      const isPostRevision = Boolean(p.isPostMeetingRevision || p.suiviReviewed);
      if (isPostRevision && (s === 'SENT_TO_SECRETARIAT' || s === 'returned_for_correction')) return;
      if (!isTransitStatus(s)) return;

      if (p.isConsolidated && p.batchId) {
        const list = projBatchMap.get(p.batchId) || [];
        list.push(p);
        projBatchMap.set(p.batchId, list);
      } else {
        items.push({
          id: p.id,
          kind: 'PROJET',
          deptLabel: 'Projets (Gagne-Pain)',
          icon: '🚀',
          title: p.title,
          dateLabel: p.dateRealisation || p.eventDate || 'Date à définir',
          status: s,
          payorFeedback: p.payorFeedback,
          sentToSuivi: p.sentToSuivi,
          suiviReviewed: p.suiviReviewed,
          isPostMeetingRevision: p.isPostMeetingRevision,
        });
      }
    });
    projBatchMap.forEach((batchProjs, batchId) => {
      const first = batchProjs[0];
      const fullBatch = (projects || []).filter(item => item.batchId === batchId);
      const statuses = batchProjs.map(x => String(x.status || 'DRAFT').trim());
      items.push({
        id: first.id,
        kind: 'PROJET',
        deptLabel: 'Projets (Gagne-Pain)',
        icon: '🚀',
        title: first.batchTitle || `Dossier Global de Projets AGR (${fullBatch.length} projets)`,
        dateLabel: fullBatch.map(x => x.dateRealisation || x.eventDate || 'À définir').join(' • '),
        status: resolveBatchStatus(statuses),
        payorFeedback: batchProjs.find(x => x.payorFeedback)?.payorFeedback,
        sentToSuivi: batchProjs.some(x => x.sentToSuivi),
        suiviReviewed: batchProjs.some(x => x.suiviReviewed),
        isPostMeetingRevision: batchProjs.some(x => x.isPostMeetingRevision),
        isConsolidated: true,
        batchId,
        batchIds: fullBatch.map(x => x.id),
        batchTitles: fullBatch.map(x => x.title),
        batchCount: fullBatch.length,
      });
    });

    // 3. SPIRITUALITÉ : Regrouper les lots consolidés par batchId
    const relBatchMap = new Map<string, ReligiousEvent[]>();
    (religiousEvents || []).forEach(r => {
      const s = String(r.status || 'DRAFT').trim();
      if (s === 'ARCHIVED' || s === 'PUBLISHED' || s === 'DRAFT') return;
      const normTitle = (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normTitle.includes('saint augustin') || r.id === 'PRIERE-SAINT-AUGUSTIN-PERMANENT') return;
      const isPostRevision = Boolean(r.isPostMeetingRevision || r.suiviReviewed);
      if (isPostRevision && (s === 'SENT_TO_SECRETARIAT' || s === 'returned_for_correction')) return;
      if (!isTransitStatus(s)) return;

      if (r.isConsolidated && r.batchId) {
        const list = relBatchMap.get(r.batchId) || [];
        list.push(r);
        relBatchMap.set(r.batchId, list);
      } else {
        items.push({
          id: r.id,
          kind: 'SPIRITUALITE',
          deptLabel: 'Spiritualité (Prière)',
          icon: '🕊️',
          title: r.title,
          dateLabel: r.eventDate || 'Date à définir',
          status: s,
          payorFeedback: r.payorFeedback,
          sentToSuivi: r.sentToSuivi,
          suiviReviewed: r.suiviReviewed,
          isPostMeetingRevision: r.isPostMeetingRevision,
        });
      }
    });
    relBatchMap.forEach((batchEvts, batchId) => {
      const first = batchEvts[0];
      const fullBatch = (religiousEvents || []).filter(item => item.batchId === batchId);
      const statuses = batchEvts.map(x => String(x.status || 'DRAFT').trim());
      items.push({
        id: first.id,
        kind: 'SPIRITUALITE',
        deptLabel: 'Spiritualité (Prière)',
        icon: '🕊️',
        title: first.batchTitle || `Programme Global des Événements Religieux (${fullBatch.length} événements)`,
        dateLabel: fullBatch.map(x => x.eventDate || 'À définir').join(' • '),
        status: resolveBatchStatus(statuses),
        payorFeedback: batchEvts.find(x => x.payorFeedback)?.payorFeedback,
        sentToSuivi: batchEvts.some(x => x.sentToSuivi),
        suiviReviewed: batchEvts.some(x => x.suiviReviewed),
        isPostMeetingRevision: batchEvts.some(x => x.isPostMeetingRevision),
        isConsolidated: true,
        batchId,
        batchIds: fullBatch.map(x => x.id),
        batchTitles: fullBatch.map(x => x.title),
        batchCount: fullBatch.length,
      });
    });

    return items;
  }, [activities, projects, religiousEvents]);

  // =========================================================
  // ÉCOUTE FIRESTORE EN TEMPS RÉEL DES LECTURES GBAÏRAÏ
  // =========================================================
  const [realtimeNewsItems, setRealtimeNewsItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    // Abonnement en temps réel sur la collection news pour actualisation automatique des lectures Gbairai
    const unsubNews = onSnapshot(
      collection(db, 'news'),
      (snapshot) => {
        if (!isMounted) return;
        const loaded: NewsItem[] = [];
        snapshot.forEach((d) => {
          const item = { id: d.id, ...(d.data() as any) };
          if (
            item.deleted === true ||
            item.isDeleted === true ||
            item.status === 'deleted' ||
            item.status === 'supprime' ||
            item.status === 'hidden' ||
            item.isHidden === true ||
            item.dispatchChannel === 'MAIL'
          ) {
            return;
          }
          loaded.push(item);
        });
        if (loaded.length > 0) {
          loaded.sort((a, b) => b.id.localeCompare(a.id));
          setRealtimeNewsItems(loaded);
        }
      },
      (err) => {
        console.warn('Erreur abonnement temps réel news Gbairai:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubNews();
    };
  }, []);

  const effectiveNewsItems = useMemo(() => {
    if (realtimeNewsItems.length > 0) return realtimeNewsItems;
    return newsItems || [];
  }, [realtimeNewsItems, newsItems]);

  // =========================================================
  // 0. SUIVI DES LECTURES GBAIRAI EN TEMPS RÉEL PAR MEMBRE
  // =========================================================
  interface MemberGbairaiReadStatus {
    member: RouamaMember;
    totalEligible: number;
    readCount: number;
    unreadCount: number;
    unreadMessages: NewsItem[];
    allRead: boolean;
    readPercentage: number;
  }

  const memberGbairaiStatuses = useMemo<MemberGbairaiReadStatus[]>(() => {
    const activeNews = (effectiveNewsItems || []).filter((msg) => {
      if (!msg) return false;
      if (msg.dispatchChannel === 'MAIL') return false;
      if (
        msg.isDeleted === true ||
        msg.deleted === true ||
        msg.status === 'deleted' ||
        msg.status === 'supprime' ||
        msg.status === 'hidden' ||
        msg.isHidden === true
      ) {
        return false;
      }
      return true;
    });

    return members.map((m) => {
      const memberId = String(m.id).trim();
      const memberNick = (m.nickname || '').trim().toUpperCase();
      const memberFirst = (m.firstName || '').trim().toUpperCase();
      const memberDues = getMemberDuesStatus ? getMemberDuesStatus(m.id) : 'RETARD';

      // Messages auxquels ce membre est éligible / ciblé
      const eligibleMessages = activeNews.filter((msg) => {
        const targetIds: string[] = [];
        if (msg.recipientId) targetIds.push(String(msg.recipientId));
        if (msg.targetMemberId) targetIds.push(String(msg.targetMemberId));
        if (Array.isArray(msg.targetMembers)) msg.targetMembers.forEach((id: any) => targetIds.push(String(id)));
        if (Array.isArray(msg.targetMemberIds)) msg.targetMemberIds.forEach((id: any) => targetIds.push(String(id)));

        const hasSpecificTargeting =
          targetIds.length > 0 &&
          !targetIds.includes('ALL') &&
          !targetIds.includes('TOUS') &&
          !targetIds.includes('PUBLIC');

        if (hasSpecificTargeting) {
          const isTargeted =
            targetIds.includes(memberId) ||
            (memberNick && targetIds.some((t) => t.toUpperCase() === memberNick));
          if (!isTargeted) return false;
        }

        // Exclusion stricte
        if (msg.excludedMemberIds && msg.excludedMemberIds.length > 0) {
          const isExcluded =
            msg.excludedMemberIds.map(String).includes(memberId) ||
            (memberNick && msg.excludedMemberIds.some((e) => e.toUpperCase() === memberNick));
          if (isExcluded) return false;
        }

        // Masquage si le membre est l'auteur du paiement pour une alerte de versement
        if (!hasSpecificTargeting && msg.payerId && String(msg.payerId) === memberId) {
          return false;
        }

        // Audience ciblée
        if (msg.targetAudience && msg.targetAudience !== 'TOUS') {
          if (msg.targetAudience !== memberDues) return false;
        }

        return true;
      });

      // Messages non lus par ce membre
      const unreadMessages = eligibleMessages.filter((msg) => {
        const readList = (msg.readBy || []).map((r) => String(r).trim().toUpperCase());
        const isRead =
          readList.includes(memberId.toUpperCase()) ||
          (memberNick && readList.includes(memberNick)) ||
          (memberFirst && readList.includes(memberFirst));
        return !isRead;
      });

      const totalEligible = eligibleMessages.length;
      const unreadCount = unreadMessages.length;
      const readCount = Math.max(0, totalEligible - unreadCount);
      const allRead = unreadCount === 0;
      const readPercentage = totalEligible > 0 ? Math.round((readCount / totalEligible) * 100) : 100;

      return {
        member: m,
        totalEligible,
        readCount,
        unreadCount,
        unreadMessages,
        allRead,
        readPercentage,
      };
    });
  }, [members, effectiveNewsItems, getMemberDuesStatus]);

  // Compteurs dérivés pour le suivi Gbairai
  const membersWithUnreadCount = useMemo(
    () => memberGbairaiStatuses.filter((s) => s.unreadCount > 0).length,
    [memberGbairaiStatuses]
  );
  const membersAllReadCount = useMemo(
    () => memberGbairaiStatuses.filter((s) => s.allRead).length,
    [memberGbairaiStatuses]
  );
  const totalGbairaiUnreadCount = useMemo(
    () => memberGbairaiStatuses.reduce((acc, s) => acc + s.unreadCount, 0),
    [memberGbairaiStatuses]
  );

  // Filtrage pour la vue du tableau Gbairai
  const filteredMemberGbairaiStatuses = useMemo(() => {
    return memberGbairaiStatuses.filter((s) => {
      if (gbairaiFilter === 'UNREAD' && s.unreadCount === 0) return false;
      if (gbairaiFilter === 'ALL_READ' && !s.allRead) return false;

      if (gbairaiSearchQuery.trim()) {
        const q = gbairaiSearchQuery.toLowerCase();
        const m = s.member;
        const matchesName = (m.firstName || '').toLowerCase().includes(q);
        const matchesNick = (m.nickname || '').toLowerCase().includes(q);
        const matchesRoster = (m.fullRosterName || '').toLowerCase().includes(q);
        const matchesPhone = (m.phone || '').includes(q);
        if (!matchesName && !matchesNick && !matchesRoster && !matchesPhone) return false;
      }
      return true;
    });
  }, [memberGbairaiStatuses, gbairaiFilter, gbairaiSearchQuery]);

  // Action pour marquer tous les messages comme lus pour un membre (validation directe par le SDP)
  const handleMarkAllReadForMember = async (member: RouamaMember) => {
    try {
      if (markAllGbairaiAsRead) {
        markAllGbairaiAsRead(member.id);
        setGbairaiFeedbackToast(
          `Tous les messages Gbairai ont été confirmés comme lus pour ${member.nickname || member.firstName}. Le compteur s'est actualisé.`
        );
        setTimeout(() => setGbairaiFeedbackToast(null), 4000);
      }
    } catch (err: any) {
      console.warn('Erreur validation lecture:', err);
    }
  };

  // =========================================================
  // 1. COMPILATION CENTRALISÉE DES ACTIVITÉS DES DÉPARTEMENTS
  // (ORGANISATION : 2 ACTIVITÉS RÉELLES • SPIRITUALITÉ & PROJETS : 0 ACTIVITÉ)
  // =========================================================
  const allDepartmentActivities = useMemo<DepartmentActivityViewItem[]>(() => {
    const list: DepartmentActivityViewItem[] = [];

    // Helper de nettoyage des lieux : aucun lieu fictif autorisé, remplacement par "À définir"
    const sanitizeLocation = (raw?: string): string => {
      if (!raw || !raw.trim()) return 'À définir';
      const clean = raw.trim();
      const lower = clean.toLowerCase();
      if (
        lower === 'abidjan' ||
        lower.includes('espace festif') ||
        lower.includes('salle des fêtes') ||
        lower.includes('espace dédié') ||
        lower.includes('songon') ||
        lower.includes('paroisse')
      ) {
        return 'À définir';
      }
      return clean;
    };

    const getWorkflowStatusLabel = (status?: string): string => {
      const s = (status || 'DRAFT').trim();
      if (s === 'PUBLISHED' || s === 'active') return 'Publié Officiellement';
      if (s === 'APPROVED' || s === 'approved_by_payor' || s === 'APPROVED_PAYOR') return 'Visé Payor (Prêt à publier)';
      if (s === 'PENDING_PAYOR' || s === 'pending_payor_approval') return 'En attente Payor';
      if (s === 'SENT_TO_SUIVI') return 'En instruction Suivi';
      if (s === 'SENT_TO_SECRETARIAT') return 'Transmis au Secrétariat';
      if (s === 'returned_for_correction') return 'Retourné pour correction';
      return 'Brouillon';
    };

    const isPublishedForTracking = (status?: string): boolean => {
      const up = String(status || '').trim().toUpperCase();
      return up === 'PUBLISHED' || up === 'ACTIVE';
    };

    // --- 1. COMMISSION ORGANISATION (SUIVI POST-PUBLICATION J-30) ---
    activities
      .filter(a => isPublishedForTracking(a.status))
      .forEach(act => {
        const reminder = calculateReminderDate(act.eventDate || '');
        list.push({
          id: act.id,
          departmentKey: 'ORGANISATION',
          departmentName: 'Commission Organisation',
          departmentIcon: '🎪',
          departmentBadgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          title: act.title,
          date: act.eventDate || 'Date à définir',
          location: sanitizeLocation(act.location),
          reminderDate: reminder.reminderDateStr,
          isPast: reminder.isPast,
          isDueForReminder: reminder.isDueForReminder,
          statusLabel: getWorkflowStatusLabel(act.status),
          description: act.description || "Programme d'activité de la Commission Organisation",
        });
      });

    // --- 2. DÉPARTEMENT SPIRITUALITÉ (SUIVI POST-PUBLICATION J-30) ---
    religiousEvents
      .filter(r => isPublishedForTracking(r.status))
      .filter(r => {
        const normTitle = (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return !normTitle.includes('saint augustin') && r.id !== 'PRIERE-SAINT-AUGUSTIN-PERMANENT';
      })
      .forEach(relEvt => {
        const relReminder = calculateReminderDate(relEvt.eventDate || '');
        list.push({
          id: relEvt.id,
          departmentKey: 'SPIRITUALITE',
          departmentName: 'Commission Spiritualité',
          departmentIcon: '✨',
          departmentBadgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          title: relEvt.title,
          date: relEvt.eventTime ? `${relEvt.eventDate} à ${relEvt.eventTime}` : (relEvt.eventDate || 'Date à définir'),
          location: sanitizeLocation(relEvt.location),
          reminderDate: relReminder.reminderDateStr,
          isPast: relReminder.isPast,
          isDueForReminder: relReminder.isDueForReminder,
          statusLabel: getWorkflowStatusLabel(relEvt.status),
          description: relEvt.theme ? `Thème : ${relEvt.theme}` : 'Événement et célébration spirituelle',
        });
      });

    // --- 3. COMMISSION PROJETS (AGR) (SUIVI POST-PUBLICATION J-30) ---
    projects
      .filter(p => isPublishedForTracking(p.status))
      .forEach(proj => {
        const projDate = proj.dateRealisation || proj.eventDate || proj.paymentDeadline || '';
        const projReminder = calculateReminderDate(projDate);
        list.push({
          id: proj.id,
          departmentKey: 'PROJET',
          departmentName: 'Commission Projets (AGR)',
          departmentIcon: '🚀',
          departmentBadgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          title: proj.title,
          date: projDate || 'Date à définir',
          location: 'À définir',
          reminderDate: projReminder.reminderDateStr,
          isPast: projReminder.isPast,
          isDueForReminder: projReminder.isDueForReminder,
          statusLabel: getWorkflowStatusLabel(proj.status),
          description: proj.description || `Projet AGR (${proj.category || 'Investissement'})`,
        });
      });

    return list;
  }, [activities, projects, religiousEvents]);

  const filteredActivities = useMemo(() => {
    return allDepartmentActivities.filter(act => {
      if (activityDeptFilter !== 'ALL' && act.departmentKey !== activityDeptFilter) return false;
      if (activitySearchQuery.trim()) {
        const q = activitySearchQuery.toLowerCase();
        const matchesTitle = act.title.toLowerCase().includes(q);
        const matchesLocation = act.location.toLowerCase().includes(q);
        const matchesDate = act.date.toLowerCase().includes(q);
        const matchesDept = act.departmentName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocation && !matchesDate && !matchesDept) return false;
      }
      return true;
    });
  }, [allDepartmentActivities, activityDeptFilter, activitySearchQuery]);

  // =========================================================
  // 2. SUIVI DISCRET DES DEMANDES D'INFORMATION INTER-DÉPARTEMENTS
  // (MÉTADONNÉES ET STATUTS SANS CORPS DE MESSAGE + ALERTE WHATSAPP 1H)
  // =========================================================
  // Données de démonstration intégrées si la collection est encore vide
  const sampleDemonstrationRequests: InfoRequest[] = useMemo(() => [
    {
      id: 'DEMO-REQ-01',
      senderRole: 'ORGANISATION',
      senderRoleLabel: 'Commission Organisation',
      senderName: 'Emile (Organisation)',
      recipientRole: 'TRESORIER',
      recipientRoleLabel: 'Trésorerie Générale',
      subject: '[Confidentiel]',
      message: '[Confidentiel]',
      status: 'En attente',
      isRead: false,
      createdAt: new Date(Date.now() - 80 * 60 * 1000).toISOString(), // Il y a 1h20 (> 1h -> Relance WhatsApp active)
    },
    {
      id: 'DEMO-REQ-02',
      senderRole: 'PROJET',
      senderRoleLabel: 'Commission Projets (AGR)',
      senderName: 'Ulrich (Projets)',
      recipientRole: 'SECRETARIAT',
      recipientRoleLabel: 'Secrétariat Général',
      subject: '[Confidentiel]',
      message: '[Confidentiel]',
      replyMessage: '[Réponse transmise]',
      status: 'Répondu',
      isRead: true,
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      repliedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      repliedBy: 'Josiane (Secrétariat)',
    },
    {
      id: 'DEMO-REQ-03',
      senderRole: 'SPIRITUALITE',
      senderRoleLabel: 'Département Spiritualité',
      senderName: 'Marie (Spiritualité)',
      recipientRole: 'COM',
      recipientRoleLabel: 'Communication (BIC)',
      subject: '[Confidentiel]',
      message: '[Confidentiel]',
      status: 'En attente',
      isRead: false,
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // Il y a 25 min (< 1h -> En cours)
    },
  ], []);

  const effectiveInfoRequests = useMemo(() => {
    if (infoRequests && infoRequests.length > 0) return infoRequests;
    if (demosDisabled) return [];
    return sampleDemonstrationRequests.filter(r => !dismissedDemoRequestIds.includes(r.id));
  }, [infoRequests, sampleDemonstrationRequests, dismissedDemoRequestIds, demosDisabled]);

  const isInfoRequestHandled = (req: InfoRequest) => {
    const isReplied = Boolean((req.replyMessage && req.replyMessage.trim().length > 0) || req.status === 'Répondu' || req.repliedAt);
    const isClosed = Boolean(req.isClosed || req.status === 'Clôturé');
    return { isReplied, isClosed, isHandled: isReplied || isClosed };
  };

  const filteredInfoRequests = useMemo(() => {
    return effectiveInfoRequests.filter(req => {
      const { isHandled } = isInfoRequestHandled(req);
      if (infoFilter === 'PENDING' && isHandled) return false;
      if (infoFilter === 'REPLIED' && !isHandled) return false;

      if (infoSearchQuery.trim()) {
        const q = infoSearchQuery.toLowerCase();
        const sDept = getDepartmentDisplayName(req.senderRole).toLowerCase();
        const rDept = getDepartmentDisplayName(req.recipientRole).toLowerCase();
        if (!sDept.includes(q) && !rDept.includes(q)) return false;
      }
      return true;
    });
  }, [effectiveInfoRequests, infoFilter, infoSearchQuery]);

  // Indicateur du nombre de demandes en attente depuis plus d'une heure
  const pendingOverOneHourCount = useMemo(() => {
    return effectiveInfoRequests.filter(req => {
      const { isHandled } = isInfoRequestHandled(req);
      if (isHandled) return false;
      const createdTimestamp = req.createdAt ? new Date(req.createdAt).getTime() : 0;
      return createdTimestamp > 0 && (Date.now() - createdTimestamp) >= (60 * 60 * 1000);
    }).length;
  }, [effectiveInfoRequests]);

  // Activités nécessitant une relance (date de relance atteinte)
  const activitiesDueForReminderCount = useMemo(() => {
    return allDepartmentActivities.filter(a => a.isDueForReminder).length;
  }, [allDepartmentActivities]);

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn pb-12">
      {/* ========================================================= */}
      {/* 1. BANNIÈRE OFFICIELLE CHARGÉ DU SUIVI DU PROGRAMME */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-amber-500/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3.5 py-1 rounded-full text-xs font-black tracking-wide shadow">
                <Shield className="w-4 h-4" />
                <span>SUIVI DU PROGRAMME & CONTRÔLE STATUTAIRE</span>
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold font-mono">
                SDP • Wilfried (Capelo)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Console Centrale de Suivi des Départements
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              Supervision automatisée des <strong>Activités des Départements</strong> (Organisation, Spiritualité, Projets) avec calcul des dates de relance, et <strong>Suivi discret des Demandes d'Information</strong> inter-départements avec alerte WhatsApp après 1 heure.
            </p>
          </div>

          {/* KPI CARDS EN EN-TÊTE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto">
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Activités</span>
              <span className="text-xl font-black text-white font-mono">{allDepartmentActivities.length}</span>
              <span className="text-[9px] text-slate-500 block">
                Org ({orgDeptCount.org}) • Spir ({orgDeptCount.spir}) • Proj ({orgDeptCount.proj})
              </span>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-amber-500/30 text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase block">Relances J-30</span>
              <span className="text-xl font-black text-amber-400 font-mono">{activitiesDueForReminderCount}</span>
              <span className="text-[9px] text-amber-500/80 block">À relancer</span>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-rose-500/30 text-center">
              <span className="text-[10px] font-bold text-rose-400 uppercase block">Attente &gt; 1h</span>
              <span className="text-xl font-black text-rose-400 font-mono">{pendingOverOneHourCount}</span>
              <span className="text-[9px] text-rose-500/80 block">WhatsApp requise</span>
            </div>

            <div
              onClick={() => setActiveTab('GBAIRAI_READS')}
              className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                membersWithUnreadCount > 0
                  ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                  : 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-300 uppercase block">Lectures Gbairai</span>
              <span className={`text-xl font-black font-mono ${membersWithUnreadCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {membersAllReadCount}/{members.length}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {membersWithUnreadCount > 0 ? `${membersWithUnreadCount} avec non lus` : '100% à jour'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ONGLETS DE NAVIGATION PRINCIPAUX */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVITES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'ACTIVITES'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ACTIVITÉS DES DÉPARTEMENTS ({allDepartmentActivities.length})</span>
          {activitiesDueForReminderCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow animate-pulse">
              {activitiesDueForReminderCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEMANDES_INFO')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'DEMANDES_INFO'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>DEMANDES D'INFO INTER-DÉPARTEMENTS</span>
          {pendingOverOneHourCount > 0 && (
            <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow animate-pulse">
              {pendingOverOneHourCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GBAIRAI_READS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'GBAIRAI_READS'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Newspaper className="w-4 h-4 text-amber-400" />
          <span>SUIVI DES LECTURES GBAÏRAÏ</span>
          {membersWithUnreadCount > 0 ? (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow animate-pulse">
              {membersWithUnreadCount}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('NAVETTE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'NAVETTE'
              ? 'bg-indigo-600 text-white shadow-md scale-102 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Send className="w-4 h-4 text-indigo-300" />
          <span>CANAL DE NAVETTE &amp; ÉCHANGES</span>
          {sdpUnreadNavetteCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow animate-pulse">
              {sdpUnreadNavetteCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. SECTION 1 : ACTIVITÉS DES DÉPARTEMENTS */}
      {/* (ORGANISATION, SPIRITUALITÉ, PROJETS) AVEC DATE DE RELANCE J-30 */}
      {/* ========================================================= */}
      {activeTab === 'ACTIVITES' && (
        <div className="space-y-6 animate-fadeIn">
          {cadrageToast && (
            <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-lg">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cadrageToast}</span>
              </span>
              <button
                type="button"
                onClick={() => setCadrageToast(null)}
                className="text-emerald-300 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Circuit Hiérarchique & Réunion de Cadrage (Secrétariat / Suivi -> Payor) */}
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 bg-indigo-500/15 text-indigo-300 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider mb-1.5 border border-indigo-500/30">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Circuit Hiérarchique &amp; Réunion de Cadrage</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Instruction Pré-Réunion de Cadrage (Secrétariat ➔ Suivi ➔ Payor)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Les programmes soumis pour la première fois sont transmis par le Secrétariat au Chargé de Suivi pour instruction avant la réunion de cadrage avec le Payor. Les révisions post-réunion passent ensuite directement du Secrétariat au Payor, puis reviennent ici après publication pour le suivi J-30.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 shrink-0 self-start sm:self-center">
                {workflowTransitItems.length} dossier(s) en circuit
              </span>
            </div>

            {workflowTransitItems.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400">
                Aucun programme n'est actuellement en attente d'instruction pré-réunion ou de visa Payor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {workflowTransitItems.map(item => {
                  const isSentToSuivi = item.status === 'SENT_TO_SUIVI';
                  const isSentToSecretariat = item.status === 'SENT_TO_SECRETARIAT';
                  const isPendingPayor = item.status === 'PENDING_PAYOR' || item.status === 'pending_payor_approval';
                  const isApproved = item.status === 'APPROVED' || item.status === 'approved_by_payor' || item.status === 'APPROVED_PAYOR';
                  const isReturned = item.status === 'returned_for_correction';

                  return (
                    <div
                      key={item.batchId ? `${item.kind}-${item.batchId}` : `${item.kind}-${item.id}`}
                      className={`bg-slate-950/80 border rounded-2xl p-4 flex flex-col justify-between gap-3 ${
                        isSentToSuivi ? 'border-amber-500/50 shadow-lg shadow-amber-950/10' : 'border-slate-800'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-black text-amber-300">
                              {item.icon} {item.deptLabel}
                            </span>
                            {item.isConsolidated && (
                              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-[10px] font-black">
                                📦 Lot Consolidé ({item.batchCount})
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              isApproved
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isPendingPayor
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : isReturned
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : isSentToSuivi
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {isApproved
                              ? '✅ Visé Payor (En attente de publication)'
                              : isPendingPayor
                              ? '⏳ En attente Visa Payor'
                              : isReturned
                              ? '↩️ Retourné pour correction'
                              : isSentToSuivi
                              ? '🕵️ À instruire (Pré-réunion)'
                              : '📥 Reçu au Secrétariat'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white">{item.title}</p>
                        {item.batchId && (
                          <p className="text-[10px] font-mono text-purple-300/90">Réf. Lot : {item.batchId}</p>
                        )}
                        {item.isConsolidated && item.batchTitles && item.batchTitles.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {item.batchTitles.map((t, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold bg-slate-900 text-slate-200 border border-slate-700 px-2 py-0.5 rounded-md"
                              >
                                • {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400">📅 {item.dateLabel}</p>
                        {isReturned && item.payorFeedback && (
                          <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/20 rounded-xl px-2.5 py-1.5">
                            Motif Payor : {item.payorFeedback}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {onPreviewOfficialDoc && (
                          <button
                            type="button"
                            onClick={() => onPreviewOfficialDoc(item.kind, item.id, item.batchId)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {item.isConsolidated
                                ? `Visualiser le Dossier Global (${item.batchCount})`
                                : 'Visualiser le Dossier complet'}
                            </span>
                          </button>
                        )}

                        {isSentToSuivi && (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.isConsolidated && item.batchIds && item.batchIds.length > 0) {
                                if (item.kind === 'ORGANISATION') {
                                  sendActivitiesBatchFromSecretariatToPayor(item.batchIds);
                                } else if (item.kind === 'PROJET') {
                                  sendProjectsBatchFromSecretariatToPayor(item.batchIds);
                                } else {
                                  sendReligiousEventsBatchFromSecretariatToPayor(item.batchIds);
                                }
                              } else {
                                if (item.kind === 'ORGANISATION') {
                                  sendActivityFromSecretariatToPayor(item.id);
                                } else if (item.kind === 'PROJET') {
                                  sendProjectFromSecretariatToPayor(item.id);
                                } else {
                                  sendReligiousEventFromSecretariatToPayor(item.id);
                                }
                              }
                              setCadrageToast(
                                `Instruction validée : « ${item.title} » a été transmis au Payor pour la réunion de cadrage.`
                              );
                              setTimeout(() => setCadrageToast(null), 4000);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Valider l'instruction &amp; Soumettre au Payor</span>
                          </button>
                        )}

                        {isSentToSecretariat && (
                          <div className="text-[11px] text-sky-300/90 bg-sky-950/30 border border-sky-500/20 rounded-xl px-3 py-1.5 font-medium">
                            En attente d'acheminement par le Secrétariat vers votre console d'instruction.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Header & Filtres */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-1.5 border border-amber-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Centralisation Statutaire • Organisation ({orgDeptCount.org}) • Spiritualité ({orgDeptCount.spir}) • Projets ({orgDeptCount.proj})
                  </span>
                </div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>Programmes &amp; Activités des Départements</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                  Suivi unifié des programmes d'activités (Organisation, Spiritualité, Projets) dans le circuit officiel. Pour chaque activité, la <strong>Date de relance</strong> est calculée automatiquement un mois avant l'événement.
                </p>
              </div>

              {/* Badges départements */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActivityDeptFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                    activityDeptFilter === 'ALL'
                      ? 'bg-white text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Tous ({allDepartmentActivities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityDeptFilter('ORGANISATION')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 ${
                    activityDeptFilter === 'ORGANISATION'
                      ? 'bg-rose-500 text-white shadow'
                      : 'bg-slate-950 text-rose-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>🎪 Organisation</span>
                  <span className="bg-rose-950/60 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {allDepartmentActivities.filter(a => a.departmentKey === 'ORGANISATION').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivityDeptFilter('SPIRITUALITE')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 ${
                    activityDeptFilter === 'SPIRITUALITE'
                      ? 'bg-violet-600 text-white shadow'
                      : 'bg-slate-950 text-violet-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>🕊️ Spiritualité</span>
                  <span className="bg-violet-950/60 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {allDepartmentActivities.filter(a => a.departmentKey === 'SPIRITUALITE').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivityDeptFilter('PROJET')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 ${
                    activityDeptFilter === 'PROJET'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 text-indigo-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>🚀 Projets (AGR)</span>
                  <span className="bg-indigo-950/60 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {allDepartmentActivities.filter(a => a.departmentKey === 'PROJET').length}
                  </span>
                </button>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Rechercher une activité par titre, lieu, date ou département..."
                value={activitySearchQuery}
                onChange={e => setActivitySearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-medium focus:border-amber-500/50 outline-none"
              />
            </div>
          </div>

          {/* Grille des Activités */}
          {filteredActivities.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">
                {activitySearchQuery.trim()
                  ? 'Aucune activité trouvée.'
                  : activityDeptFilter === 'ORGANISATION'
                  ? 'Aucune activité publiée par la Commission Organisation pour le moment.'
                  : activityDeptFilter === 'SPIRITUALITE'
                  ? 'Aucune activité publiée par le Département Spiritualité pour le moment.'
                  : activityDeptFilter === 'PROJET'
                  ? 'Aucune activité publiée par la Commission Projets (AGR) pour le moment.'
                  : 'Aucune activité publiée pour le moment.'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {activitySearchQuery.trim()
                  ? 'Modifiez votre filtre ou effectuez une autre recherche.'
                  : 'Les programmes officiellement publiés par les départements apparaîtront ici avec leur date de relance automatique (J-30).'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Badge Département & Statut */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${act.departmentBadgeColor}`}>
                        <span>{act.departmentIcon}</span>
                        <span>{act.departmentName}</span>
                      </span>

                      {act.isDueForReminder ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                          <Bell className="w-3 h-3 text-rose-400" />
                          <span>Relance Requise</span>
                        </span>
                      ) : act.isPast ? (
                        <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Événement passé
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Dans les temps</span>
                        </span>
                      )}
                    </div>

                    {/* Titre */}
                    <div>
                      <h3 className="text-base font-black text-white leading-snug">
                        {act.title}
                      </h3>
                      {act.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {act.description}
                        </p>
                      )}
                    </div>

                    {/* Informations Clés (Date, Lieu, Relance) */}
                    <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 text-xs">
                      {/* Date de l'événement */}
                      <div className="flex items-start gap-2 text-slate-300">
                        <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Date de l'événement</span>
                          <span className="font-bold text-white font-mono">{act.date}</span>
                        </div>
                      </div>

                      {/* Lieu */}
                      <div className="flex items-start gap-2 text-slate-300">
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Lieu de réalisation</span>
                          <span className={`font-bold ${act.location === 'À définir' || !act.location ? 'text-amber-400/90 italic' : 'text-slate-200'}`}>
                            {act.location || 'À définir'}
                          </span>
                        </div>
                      </div>

                      {/* Date de Relance Automatique (1 mois avant) */}
                      <div className="flex items-start gap-2 pt-2 border-t border-slate-900">
                        <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-amber-400">Date de Relance (J-30)</span>
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">Auto</span>
                          </div>
                          <span className="font-black text-amber-300 font-mono text-sm block mt-0.5">
                            ⏰ {act.reminderDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bas de carte */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="font-medium">Statut : <strong className="text-slate-200">{act.statusLabel || 'En cours'}</strong></span>
                    {onPreviewOfficialDoc ? (
                      <button
                        type="button"
                        onClick={() => onPreviewOfficialDoc(act.departmentKey, act.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-black transition-all cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Aperçu</span>
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-500">ID: {act.id.substring(0, 14)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SECTION 2 : DEMANDES D'INFORMATION INTER-DÉPARTEMENTS */}
      {/* (SUIVI DISCRET SANS CORPS DE MESSAGE + ALERTE WHATSAPP APRÈS 1H) */}
      {/* ========================================================= */}
      {activeTab === 'DEMANDES_INFO' && (
        <div className="space-y-6 animate-fadeIn">
          {infoActionToast && (
            <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-lg">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{infoActionToast}</span>
              </span>
              <button
                type="button"
                onClick={() => setInfoActionToast(null)}
                className="text-emerald-300 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header & Consignes de confidentialité */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-1.5 border border-emerald-500/30">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Confidentialité Stricte • Métadonnées et Statuts Uniquement</span>
                </div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>Suivi Discret des Demandes d'Information Inter-Départements</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                  Seuls les départements émetteurs et destinataires ainsi que le statut sont visibles. Si une demande reste <strong>en attente depuis plus d'une heure</strong>, le bouton <strong>Notifier via WhatsApp</strong> permet d'interpeller directement le destinataire. Vous pouvez également <strong>clôturer ou supprimer</strong> les échanges traités pour garder le tableau propre.
                </p>
              </div>

              {/* Filtres de statut & Purge */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInfoFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${
                    infoFilter === 'ALL'
                      ? 'bg-white text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Toutes ({effectiveInfoRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInfoFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 ${
                    infoFilter === 'PENDING'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-950 text-amber-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>⏳ En attente</span>
                  <span className="bg-amber-950 text-amber-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {effectiveInfoRequests.filter(r => !isInfoRequestHandled(r).isHandled).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setInfoFilter('REPLIED')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 ${
                    infoFilter === 'REPLIED'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-950 text-emerald-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>🟢 Traitées / Clôturées</span>
                  <span className="bg-emerald-950 text-emerald-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {effectiveInfoRequests.filter(r => isInfoRequestHandled(r).isHandled).length}
                  </span>
                </button>

                {effectiveInfoRequests.some(r => isInfoRequestHandled(r).isHandled) && (
                  !confirmPurgeInfo ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeInfo(true)}
                      className="px-3 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purger traitées ({effectiveInfoRequests.filter(r => isInfoRequestHandled(r).isHandled).length})</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-500/40 rounded-xl px-2.5 py-1">
                      <button
                        type="button"
                        disabled={isPurgingInfo}
                        onClick={async () => {
                          setIsPurgingInfo(true);
                          const toPurge = effectiveInfoRequests.filter(r => isInfoRequestHandled(r).isHandled);
                          const demoIds = toPurge.filter(r => r.id.startsWith('DEMO-')).map(r => r.id);
                          const realItems = toPurge.filter(r => !r.id.startsWith('DEMO-'));
                          let count = 0;
                          if (demoIds.length > 0) {
                            await dismissDemoInfoRequests(demoIds, true);
                            count += demoIds.length;
                          }
                          if (realItems.length > 0) {
                            const results = await Promise.all(realItems.map(r => deleteInfoRequest(r.id)));
                            count += results.filter(res => res.success).length;
                          }
                          setIsPurgingInfo(false);
                          setConfirmPurgeInfo(false);
                          setInfoActionToast(`${count} échange(s) traité(s) ou clôturé(s) purgé(s) définitivement.`);
                          setTimeout(() => setInfoActionToast(null), 4000);
                        }}
                        className="text-rose-200 bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg font-black text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {isPurgingInfo ? 'Purge...' : 'Confirmer la purge'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPurgeInfo(false)}
                        className="text-slate-300 hover:text-white px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Filtrer par nom de département émetteur ou destinataire..."
                value={infoSearchQuery}
                onChange={e => setInfoSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-medium focus:border-amber-500/50 outline-none"
              />
            </div>
          </div>

          {/* Liste des Demandes sous format discret et neutre */}
          {filteredInfoRequests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">Aucun échange d'information sous ce filtre.</p>
              <p className="text-xs text-slate-500">Toutes les demandes inter-départements apparaîtront ici automatiquement.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInfoRequests.map((req) => {
                const senderDept = getDepartmentDisplayName(req.senderRole);
                const recipientDept = getDepartmentDisplayName(req.recipientRole);
                const { isReplied, isClosed, isHandled } = isInfoRequestHandled(req);

                // Calcul du délai d'attente
                const createdTime = req.createdAt ? new Date(req.createdAt).getTime() : 0;
                const diffMs = Date.now() - createdTime;
                const isOverOneHour = !isHandled && createdTime > 0 && diffMs >= (60 * 60 * 1000);
                const hoursWaiting = Math.floor(diffMs / (60 * 60 * 1000));
                const minutesWaiting = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

                // Contact WhatsApp du destinataire
                const contact = getDepartmentContact(req.recipientRole, members);
                const whatsappMessage = `Bonjour fraternel ${contact.name}. En qualité de Chargé du Suivi du Programme E-ROUAMA, je constate qu'une demande d'information adressée au département ${recipientDept} est en attente de réponse depuis plus d'une heure. Merci de bien vouloir te connecter sur la plateforme pour y apporter une réponse fraternelle : https://e-rouama.web.app`;

                const formattedSentDate = req.createdAt
                  ? new Date(req.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Date inconnue';

                const formattedRepliedDate = req.repliedAt
                  ? new Date(req.repliedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : undefined;

                const isConfirmingDelete = confirmDeleteInfoId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`bg-slate-900 border ${
                      isOverOneHour
                        ? 'border-amber-500/60 shadow-amber-950/20 shadow-lg'
                        : isHandled
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-slate-800'
                    } rounded-2xl p-4 sm:p-5 transition-all flex flex-col gap-3`}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Format neutre strict exigé par le cahier des charges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">
                            Demande d'information envoyée par le <span className="text-amber-400 font-extrabold">{senderDept}</span> au <span className="text-cyan-400 font-extrabold">{recipientDept}</span>
                          </span>
                        </div>

                        {/* Métadonnées temporelles et auteur sans dévoiler le message */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Émise le {formattedSentDate}</span>
                          </span>

                          {!isHandled && createdTime > 0 && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isOverOneHour ? 'bg-rose-500/20 text-rose-300 font-mono' : 'bg-slate-800 text-slate-300 font-mono'
                            }`}>
                              Attente : {hoursWaiting > 0 ? `${hoursWaiting}h ` : ''}{minutesWaiting}min
                            </span>
                          )}

                          {isReplied && formattedRepliedDate && (
                            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                              <Check className="w-3.5 h-3.5" />
                              <span>Réponse le {formattedRepliedDate} {req.repliedBy ? `par ${req.repliedBy}` : ''}</span>
                            </span>
                          )}

                          <span className="text-slate-600">•</span>
                          <span className="text-[11px] text-slate-500 font-mono">Réf: {req.id}</span>
                        </div>
                      </div>

                      {/* Statut, Alerte WhatsApp & Suppression/Clôture */}
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                        {/* Statut dynamique */}
                        <div>
                          {isClosed ? (
                            <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-600 px-3 py-1 rounded-full text-xs font-black">
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>Clôturée</span>
                            </span>
                          ) : isReplied ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-black">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Répondu</span>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 ${
                              isOverOneHour
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            } px-3 py-1 rounded-full text-xs font-black`}>
                              <Clock className={`w-3.5 h-3.5 ${isOverOneHour ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                              <span>En attente de réponse</span>
                            </span>
                          )}
                        </div>

                        {/* Bouton Alerte WhatsApp si en attente depuis > 1h */}
                        {isOverOneHour && (
                          <a
                            href={`https://wa.me/${contact.cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3.5 py-2 rounded-xl text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
                            title={`Interpeller ${contact.name} (${recipientDept}) sur WhatsApp`}
                          >
                            <MessageCircle className="w-4 h-4 fill-current" />
                            <span>Notifier via WhatsApp</span>
                          </a>
                        )}

                        {/* Bouton Supprimer / Clôturer */}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteInfoId(isConfirmingDelete ? null : req.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            isConfirmingDelete
                              ? 'bg-rose-600 text-white border-rose-500'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                          title="Supprimer ou clôturer cet échange"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer / Clôturer</span>
                        </button>
                      </div>
                    </div>

                    {isConfirmingDelete && (
                      <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-rose-200 font-semibold">
                          Purger définitivement cette ligne du suivi inter-départements { !isClosed ? 'ou la marquer simplement clôturée ?' : '?' }
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isClosed && !req.id.startsWith('DEMO-') && (
                            <button
                              type="button"
                              disabled={deletingInfoId === req.id}
                              onClick={async () => {
                                setDeletingInfoId(req.id);
                                await closeInfoRequest(req.id, 'Chargé du Suivi (SDP)');
                                setDeletingInfoId(null);
                                setConfirmDeleteInfoId(null);
                                setInfoActionToast(`Demande ${req.id} marquée comme clôturée.`);
                                setTimeout(() => setInfoActionToast(null), 4000);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Clôturer seulement</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={deletingInfoId === req.id}
                            onClick={async () => {
                              setDeletingInfoId(req.id);
                              if (req.id.startsWith('DEMO-')) {
                                await dismissDemoInfoRequests([req.id]);
                                setInfoActionToast('Ligne de démonstration supprimée définitivement.');
                              } else {
                                const res = await deleteInfoRequest(req.id);
                                setInfoActionToast(
                                  res.success
                                    ? `Échange ${req.id} supprimé définitivement.`
                                    : 'Impossible de supprimer cet échange pour le moment.'
                                );
                              }
                              setDeletingInfoId(null);
                              setConfirmDeleteInfoId(null);
                              setTimeout(() => setInfoActionToast(null), 4000);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{deletingInfoId === req.id ? 'Suppression...' : 'Supprimer définitivement'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteInfoId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                          >
                            Annuler
                          </button>
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

      {/* ========================================================= */}
      {/* 5. SECTION GBAÏRAÏ : SUIVI DES LECTURES GBAIRAI (MESSAGES NON LUS) */}
      {/* ========================================================= */}
      {activeTab === 'GBAIRAI_READS' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Toast Feedback */}
          {gbairaiFeedbackToast && (
            <div className="flex items-center justify-between p-4 rounded-2xl border text-xs font-bold bg-emerald-500/15 border-emerald-500/40 text-emerald-300 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{gbairaiFeedbackToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setGbairaiFeedbackToast(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Bandeau d'en-tête du Suivi Gbairai */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-xs font-black tracking-wide">
                  <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                  <span>GBAÏRAÏ • CONTRÔLE D'AUDIT &amp; TRAÇABILITÉ DES LECTURES EN TEMPS RÉEL</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 flex-wrap">
                  <span>Suivi des Lectures Gbairai (Messages Non Lus)</span>
                </h2>

                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  Supervisez en temps réel le nombre de messages et annonces non lus pour chaque membre de l'association.
                  Dès qu'un membre consulte son espace Gbairai ou clique sur « Marquer comme lu », le compteur diminue
                  instantanément. Lorsqu'un membre passe à 0 message non lu, son indicateur passe au vert.
                </p>
              </div>

              {/* KPI Synthétiques en temps réel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Membres Suivis</span>
                  <span className="text-xl font-black text-white font-mono">{members.length}</span>
                  <span className="text-[9px] text-slate-500 block">Effectif total</span>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/30 text-center">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase block">À Jour (0 non lu)</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">{membersAllReadCount}</span>
                  <span className="text-[9px] text-emerald-500/80 block">
                    {members.length > 0 ? Math.round((membersAllReadCount / members.length) * 100) : 100}% des membres
                  </span>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-2xl border border-amber-500/30 text-center">
                  <span className="text-[10px] font-bold text-amber-400 uppercase block">Avec Non Lus</span>
                  <span className="text-xl font-black text-amber-400 font-mono">{membersWithUnreadCount}</span>
                  <span className="text-[9px] text-amber-500/80 block">À relancer</span>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-2xl border border-rose-500/30 text-center">
                  <span className="text-[10px] font-bold text-rose-400 uppercase block">Total Non Lus</span>
                  <span className="text-xl font-black text-rose-400 font-mono">{totalGbairaiUnreadCount}</span>
                  <span className="text-[9px] text-rose-500/80 block">Messages cumulés</span>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de recherche et filtres de lecture */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
            <div className="relative flex-1 w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par membre (ex: KILO CARTUS, LA MADRE, CAPELO)..."
                value={gbairaiSearchQuery}
                onChange={(e) => setGbairaiSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {gbairaiSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGbairaiSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" />
                <span>Statut :</span>
              </span>

              <button
                type="button"
                onClick={() => setGbairaiFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  gbairaiFilter === 'ALL'
                    ? 'bg-slate-700 text-white font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Tous les membres ({members.length})
              </button>

              <button
                type="button"
                onClick={() => setGbairaiFilter('UNREAD')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  gbairaiFilter === 'UNREAD'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                ⚠️ Messages non lus ({membersWithUnreadCount})
              </button>

              <button
                type="button"
                onClick={() => setGbairaiFilter('ALL_READ')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  gbairaiFilter === 'ALL_READ'
                    ? 'bg-emerald-600 text-white font-black'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                🟢 Tous les messages lus ({membersAllReadCount})
              </button>
            </div>
          </div>

          {/* Tableau & Liste des Membres */}
          {filteredMemberGbairaiStatuses.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                <Newspaper className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Aucun membre ne correspond aux critères de recherche</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Modifiez vos filtres ou videz la recherche pour réafficher la liste complète des membres.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMemberGbairaiStatuses.map((item) => {
                const member = item.member;
                const cleanPhone = (member.phone || '').replace(/[^0-9]/g, '');
                const isExpanded = expandedMemberGbairaiId === member.id;
                const whatsappMsg = encodeURIComponent(
                  `Bonjour ${member.nickname || member.firstName}, en tant que Chargé du Suivi du Programme E-ROUAMA, je constate que tu as ${item.unreadCount} message(s) non lu(s) dans ton espace Gbairai. Merci de bien vouloir te connecter sur l'application pour prendre connaissance des annonces officielles !`
                );
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappMsg}`;

                return (
                  <div
                    key={member.id}
                    className={`bg-slate-900 border rounded-2xl transition-all shadow-md overflow-hidden ${
                      item.unreadCount > 0
                        ? 'border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/10'
                        : 'border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Identité du membre */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-white font-black text-sm">
                          {member.photoUrl || member.avatar ? (
                            <img
                              src={member.photoUrl || member.avatar}
                              alt={member.nickname || member.firstName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(member.nickname || member.firstName || 'M').charAt(0)}</span>
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-white truncate">
                              {member.firstName} ({member.nickname})
                            </h4>
                            {item.allRead ? (
                              <span className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Tous les messages lus</span>
                              </span>
                            ) : (
                              <span className="bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                                <span>{item.unreadCount} non lu{item.unreadCount > 1 ? 's' : ''}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span>Tél: <strong className="text-slate-300 font-mono">{member.phone || 'Non renseigné'}</strong></span>
                            <span>•</span>
                            <span className="text-slate-400">
                              Progression: <strong className="text-white">{item.readCount}/{item.totalEligible}</strong> lus ({item.readPercentage}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Statut & Progression de lecture */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-stretch md:self-auto justify-between md:justify-end">
                        {/* Barre de progression miniature */}
                        <div className="w-full sm:w-32 bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <div className="h-2 rounded-lg bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                item.allRead ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                              style={{ width: `${item.readPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions : Relance WhatsApp & Détail */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {item.unreadCount > 0 && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                              title={`Envoyer un rappel WhatsApp à ${member.nickname}`}
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Relancer sur WhatsApp</span>
                            </a>
                          )}

                          {item.unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMarkAllReadForMember(member)}
                              className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                              title="Marquer manuellement comme lu pour ce membre"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Valider lecture</span>
                            </button>
                          )}

                          {item.unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMemberGbairaiId(isExpanded ? null : member.id)
                              }
                              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all text-xs"
                              title={isExpanded ? 'Masquer le détail' : 'Voir les messages non lus'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Liste dépliable des messages non lus par ce membre */}
                    {isExpanded && item.unreadMessages.length > 0 && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-slate-950/60 space-y-2 animate-fadeIn">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pt-1">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Détail des {item.unreadCount} message{item.unreadCount > 1 ? 's' : ''} non lu{item.unreadCount > 1 ? 's' : ''} par {member.nickname || member.firstName} :</span>
                        </div>

                        <div className="space-y-2 pt-1">
                          {item.unreadMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                      msg.category === 'ALERTE'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : msg.category === 'RELANCE'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    }`}
                                  >
                                    {msg.category}
                                  </span>
                                  <span className="font-bold text-white truncate">
                                    {msg.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 font-sans">
                                  {msg.content}
                                </p>
                              </div>

                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                {msg.date}
                              </span>
                            </div>
                          ))}
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

      {/* ========================================================= */}
      {/* 6. SECTION 4 : VOLET "NAVETTE & DEMANDES D'INFORMATION" */}
      {/* (CONSERVÉ INTACT ET 100% OPÉRATIONNEL SELON LA RÈGLE STRICTE) */}
      {/* ========================================================= */}
      {activeTab === 'NAVETTE' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2.5 text-indigo-400 font-black text-sm uppercase tracking-wider mb-2">
              <Send className="w-4 h-4" />
              <span>Canal de Navette &amp; Échanges (Intégré à l'Espace Suivi)</span>
            </div>
            <p className="text-xs text-slate-400">
              Cet espace intégré permet au Chargé du Suivi du Programme d'échanger en continu avec les autres départements, d'émettre des requêtes et d'apporter des précisions en temps réel sans quitter la console.
            </p>
          </div>

          <InfoRequestsModule currentRole="SDP" senderNameOverride="Chargé du Suivi du Programme" />
        </div>
      )}
    </div>
  );
};

function allDepartmentActivitiesCountByDept(
  activities: EventActivity[],
  projects: AgrProject[],
  religiousEvents: ReligiousEvent[],
  _unused?: string
) {
  const isPublished = (status?: string) => {
    const up = String(status || '').trim().toUpperCase();
    return up === 'PUBLISHED' || up === 'ACTIVE';
  };
  const org = (activities || []).filter(a => isPublished(a.status)).length;
  const proj = (projects || []).filter(p => isPublished(p.status)).length;
  const spir = (religiousEvents || [])
    .filter(r => isPublished(r.status))
    .filter(r => {
      const normTitle = (r.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return !normTitle.includes('saint augustin') && r.id !== 'PRIERE-SAINT-AUGUSTIN-PERMANENT';
    }).length;
  return { org, proj, spir };
}
export default SuiviProgrammeConsole;
