import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  RouamaMember,
  AdminRole,
  AdminUser,
  CurrentUser,
  FundType,
  PaymentDeclaration,
  Transaction,
  WithdrawalRequest,
  NewsItem,
  EventActivity,
  DEFAULT_ANNIVERSAIRE_ACTIVITY,
  DEFAULT_SOIREE_ACTIVITY,
  AgrProject,
  FinancialEvent,
  ArchiveDoc,
  SecretaryPV,
  FinancialBilan,
  ProgrammeTask,
  ProgrammeAlert,
  TargetAudience,
  DuesStatus,
  MemberDuesDetail,
  RegisteredUserRecord,
  VerseOfTheDay,
  PrayerIntention,
  ReligiousEvent,
  TabType,
  MemberRubricProgress,
  FUND_LABELS,
  AdminLoginLog,
  InfoRequest,
} from '../types';
import { INITIAL_ROUAMA_MEMBERS, ADMIN_USERS, isMemberActive, getRegisteredMembersCount } from '../data/membersData';
import { getDefaultRolesForMember } from '../data/departmentMapping';
import { sendEmailBroadcastAsync } from '../utils/emailService';
import { computeBilanData, extractBilanPeriodParams } from '../utils/bilanCalculator';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db, testFirestoreConnection, sanitizeFirestore } from '../firebase';
import { compressReceiptImage } from '../utils/imageCompressor';
import { dispatchPushNotification } from '../utils/pushNotificationService';

interface AppContextType {
  currentUser: CurrentUser | null;
  members: RouamaMember[];
  adminUsers: AdminUser[];
  fundBalances: Record<FundType, number>;
  declarations: PaymentDeclaration[];
  transactions: Transaction[];
  withdrawals: WithdrawalRequest[];
  newsItems: NewsItem[];
  gbairaiMessages: NewsItem[];
  activities: EventActivity[];
  projects: AgrProject[];
  financialEvents: FinancialEvent[];
  archiveDocs: ArchiveDoc[];
  pvs: SecretaryPV[];
  bilans: FinancialBilan[];
  isFirebaseConnected: boolean;

  // Suivi du Programme & Alertes Auditeur (SDP)
  programmeTasks: ProgrammeTask[];
  programmeAlerts: ProgrammeAlert[];
  adminLogs: AdminLoginLog[];
  logAdminConnection: (role: string, memberName?: string, userId?: string) => Promise<void>;
  addProgrammeTask: (task: Omit<ProgrammeTask, 'id' | 'createdAt'>) => Promise<{ success: boolean; id: string }>;
  updateProgrammeTask: (taskId: string, updates: Partial<ProgrammeTask>) => Promise<{ success: boolean }>;
  deleteProgrammeTask: (taskId: string) => Promise<{ success: boolean }>;
  createProgrammeAlert: (alert: Omit<ProgrammeAlert, 'id' | 'sentAt' | 'status'>) => Promise<{ success: boolean; id: string }>;
  resolveProgrammeAlert: (alertId: string) => Promise<{ success: boolean }>;

  // Demandes d'Information Inter-Admins (Messagerie B2B - info_requests)
  infoRequests: InfoRequest[];
  createInfoRequest: (
    req: Omit<InfoRequest, 'id' | 'createdAt' | 'status' | 'isRead'>
  ) => Promise<{ success: boolean; id?: string; message: string }>;
  replyInfoRequest: (
    id: string,
    replyMessage: string,
    replierName: string
  ) => Promise<{ success: boolean; message: string }>;
  markInfoRequestRead: (id: string) => Promise<{ success: boolean }>;
  deleteInfoRequest: (id: string) => Promise<{ success: boolean }>;

  // Spiritualité
  verseOfTheDay: VerseOfTheDay | null;
  prayerIntentions: PrayerIntention[];
  religiousEvents: ReligiousEvent[];
  updateVerseOfTheDay: (verse: string, reference?: string) => void;
  addPrayerIntention: (intention: string, memberNickname?: string, isChain?: boolean) => void;
  createReligiousEvent: (event: Omit<ReligiousEvent, 'id' | 'publishedAt'>, dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL') => void;

  // Auth
  setCurrentUser: (userOrUpdater: any) => void;
  switchWorkspace: (view: 'MEMBER' | 'ADMIN', targetRole?: AdminRole) => void;
  registerMember: (firstNameOrRosterName: string, pin: string) => Promise<{ success: boolean; message: string }>;
  loginMember: (firstNameOrRosterName: string, pin: string) => Promise<{ success: boolean; message: string }>;
  loginAdmin: (adminId: string, pin: string) => { success: boolean; message: string };
  updateAdminCredentials: (roleId: AdminRole, newLoginId: string, newPin: string) => { success: boolean; message: string };
  updateAdminPassword: (
    roleId: AdminRole,
    currentPasswordInput: string,
    newPasswordInput: string,
    confirmPasswordInput: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;

  // Helper
  getMemberDuesStatus: (memberId: string) => DuesStatus;
  getMemberDuesDetail: (memberId: string) => MemberDuesDetail;
  getMemberRubricProgress: (
    memberId: string,
    fund: FundType,
    subCategory?: string,
    overrideRequiredAmount?: number,
    overrideTitle?: string
  ) => MemberRubricProgress;
  getActiveFinancialEvent: (fund: 'LOISIRS' | 'CAS_SOCIAUX') => FinancialEvent | undefined;
  getActiveAgrProject: () => AgrProject | undefined;
  getAllMembersRubricSummary: (
    fund: FundType,
    subCategory?: string,
    overrideRequiredAmount?: number,
    overrideTitle?: string
  ) => {
    totalRequired: number;
    totalAdvanced: number;
    totalRemaining: number;
    completionPercentage: number;
    settledCount: number;
    partialCount: number;
    notStartedCount: number;
    membersSummary: {
      member: RouamaMember;
      progress: MemberRubricProgress;
      totalRequired: number;
      totalAdvanced: number;
      remainingDue: number;
      status: 'SOLDE' | 'EN_COURS' | 'NON_ENTAME';
      history: PaymentDeclaration[];
    }[];
  };

  // Actions
  declarePayment: (
    fund: FundType,
    amount: number,
    reference: string,
    month?: string,
    paymentType?: 'TOTAL' | 'TRANCHE',
    subCategory?: string,
    receiptImage?: string
  ) => Promise<{ success: boolean; message: string }>;
  submitReceipt: (receiptData: {
    fund: FundType;
    amount: number;
    reference: string;
    receiptImage?: string;
    month?: string;
    paymentType?: 'TOTAL' | 'TRANCHE';
    subCategory?: string;
  }) => Promise<{ success: boolean; message: string }>;
  approvePayment: (declarationId: string) => Promise<void> | void;
  validateCotisation: (declarationId: string) => Promise<void> | void;
  syncMemberProfileCotisation: (memberId: string) => Promise<void>;
  rejectPayment: (declarationId: string, reason?: string) => Promise<void> | void;
  hideReceipt: (declarationId: string) => Promise<void>;
  deleteReceipt: (declarationId: string) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;

  addExtraCaisseEntry: (data: {
    date: string;
    reason: string;
    amount: number;
    createdByName?: string;
    caisseType?: string;
  }) => Promise<{ success: boolean; message: string; entryId?: string; entry?: any }>;
  addProjectProfitEntry: (data: {
    projectId?: string;
    projectTitle: string;
    date: string;
    reason: string;
    amount: number;
    createdByName?: string;
  }) => Promise<{ success: boolean; message: string; entryId?: string; entry?: any }>;
  updateExtraCaisseEntry: (
    entryId: string,
    data: { amount: number; reason: string; date?: string }
  ) => Promise<{ success: boolean; message: string; diff?: number }>;
  cancelExtraCaisseEntry: (
    entryId: string
  ) => Promise<{ success: boolean; message: string; cancelledAmount?: number }>;
  createWithdrawalRequest: (fund: FundType, amount: number, reason: string) => Promise<void> | void;
  approveWithdrawal: (requestId: string) => Promise<void> | void;
  rejectWithdrawal: (requestId: string) => Promise<void> | void;

  publishNews: (
    title: string,
    content: string,
    category: NewsItem['category'],
    targetAudience: TargetAudience,
    authorRole: string,
    dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL',
    linkTab?: TabType,
    targetDocId?: string
  ) => void;
  markNewsAsRead: (newsId: string) => void;

  createActivity: (activity: Omit<EventActivity, 'id' | 'status' | 'budgetStatus'>) => void;
  updateActivity: (activityId: string, updatedData: Partial<EventActivity>) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  approveActivityPayor: (activityId: string) => void;
  approveActivityBudgetTresorier: (activityId: string) => void;

  // Financial Events (Trésorier : Sorties & Cas Sociaux)
  createFinancialEvent: (event: Omit<FinancialEvent, 'id' | 'createdAt' | 'status'>) => void;
  archiveFinancialEvent: (eventId: string) => void;
  deleteFinancialEvent: (eventId: string) => void;

  // Projects AGR
  createProject: (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'> & { status?: AgrProject['status'] }) => void;
  updateProject: (projectId: string, updates: Partial<AgrProject>) => void;
  deleteProject: (projectId: string) => void;
  approveProjectPayor: (projectId: string) => void;
  returnProjectForCorrectionPayor: (projectId: string, feedback: string) => void;
  assessProjectTresorier: (projectId: string, feasible: boolean) => void;
  publishProject: (projectId: string) => void;
  archiveProject: (projectId: string) => void;

  createSecretaryPV: (pv: Omit<SecretaryPV, 'id' | 'status'>) => void;
  updateSecretaryPV: (pvId: string, updates: Partial<SecretaryPV>) => void;
  returnPVForCorrectionPayor: (pvId: string, feedback: string) => void;
  deleteSecretaryPV: (pvId: string) => void;
  approvePVPayor: (pvId: string) => void;
  publishPVCOM: (pvId: string) => void;

  createFinancialBilan: (
    title: string,
    period: string,
    summary: string,
    options?: {
      periodType?: 'GLOBAL' | 'PERIODIC';
      startDate?: string;
      endDate?: string;
    }
  ) => FinancialBilan;
  updateFinancialBilan: (bilanId: string, updates: Partial<FinancialBilan>) => void;
  returnBilanForCorrectionPayor: (bilanId: string, feedback: string) => void;
  deleteFinancialBilan: (bilanId: string) => void;
  approveBilanPayor: (bilanId: string) => void;
  sendBilanToSecretariat: (bilanId: string) => void;
  sendBilanFromSecretariatToCom: (bilanId: string) => void;
  ackBilanCOM: (bilanId: string) => void;
  publishBilanNewsCOM: (bilanId: string) => void;
  ackAndPublishBilanCOM: (bilanId: string) => void;
  archiveBilanSecretariat: (bilanId: string) => void;

  broadcastCerveauAlert: (
    titleOrMember: string,
    contentOrMonth?: string,
    dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL',
    payerId?: string,
    targetMemberIds?: string[]
  ) => void;
  deleteNewsItem: (newsId: string) => void;
  dismissNewsForMember: (newsId: string) => void;
  markAllGbairaiAsRead: () => void;
  assignMemberRole: (memberId: string, role?: AdminRole) => void;
  resetMemberPin: (memberId: string) => void;
  updateMemberAvatar: (memberId: string, avatarDataUrl: string) => Promise<boolean>;
  updateMember: (
    memberId: string,
    formFields: Partial<RouamaMember> & { newPhotoBase64?: string; [key: string]: any }
  ) => Promise<boolean>;
  saveProfile: (
    memberId: string,
    formFields: Partial<RouamaMember> & { newPhotoBase64?: string; [key: string]: any }
  ) => Promise<boolean>;
  editUser: (
    memberId: string,
    formFields: Partial<RouamaMember> & { newPhotoBase64?: string; [key: string]: any }
  ) => Promise<boolean>;
  updateMemberProfile: (
    memberId: string,
    updates: Partial<RouamaMember> & { newPhotoBase64?: string; [key: string]: any }
  ) => Promise<boolean>;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'erouama_app_state_v2';
const EROUAMA_REGISTERED_USERS_KEY = 'EROUAMA_REGISTERED_USERS';
const EROUAMA_ACTIVE_SESSION_KEY = 'erouama_active_session';
export const ADMIN_CREDENTIALS_KEY = 'erouama_admin_credentials';

export const isRealizationDateReached = (dateStr?: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!trimmed) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    return today.getTime() >= target.getTime();
  }

  // Format DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    const target = new Date(y, m - 1, d);
    return today.getTime() >= target.getTime();
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return today.getTime() >= parsed.getTime();
  }

  return false;
};

export const normalizeRosterString = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

const getStoredRegisteredUsers = (): RegisteredUserRecord[] => {
  try {
    const raw = localStorage.getItem(EROUAMA_REGISTERED_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse EROUAMA_REGISTERED_USERS from localStorage', e);
    return [];
  }
};

const saveRegisteredUserRecord = (record: RegisteredUserRecord) => {
  try {
    const currentList = getStoredRegisteredUsers();
    const existingIndex = currentList.findIndex(
      u => u.id === record.id ||
        normalizeRosterString(u.firstName) === normalizeRosterString(record.firstName) ||
        normalizeRosterString(u.nickname) === normalizeRosterString(record.nickname)
    );
    let updatedList: RegisteredUserRecord[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = record;
    } else {
      updatedList = [...currentList, record];
    }
    localStorage.setItem(EROUAMA_REGISTERED_USERS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error('Failed to save record to EROUAMA_REGISTERED_USERS', e);
  }
};

export function getStoredAdminCredentials(): AdminUser[] {
  try {
    const stored = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    if (stored) {
      const parsed: AdminUser[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = ADMIN_USERS.map(defaultAdmin => {
          const found = parsed.find(p => p.id === defaultAdmin.id);
          if (found) {
            return {
              ...defaultAdmin,
              loginId: found.loginId || defaultAdmin.loginId,
              pin: found.pin || found.password || defaultAdmin.pin,
              password: found.password || found.pin || defaultAdmin.password || defaultAdmin.pin,
            };
          }
          return defaultAdmin;
        });
        return merged;
      }
    }
  } catch (e) {
    console.error('Failed to load admin credentials from localStorage', e);
  }
  return ADMIN_USERS;
}

export function saveStoredAdminCredentials(adminUsers: AdminUser[]): void {
  try {
    localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(adminUsers));
  } catch (e) {
    console.error('Failed to save admin credentials to localStorage', e);
  }
}

let hasRunStartupSync = false;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session utilisateur locale persistée sur ce terminal
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(() => {
    try {
      const savedSession = localStorage.getItem(EROUAMA_ACTIVE_SESSION_KEY) || localStorage.getItem('rouama_user');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && !parsed.type && (parsed.firstName || parsed.nickname || parsed.id)) {
          return { type: 'MEMBER', id: parsed.id, member: parsed };
        }
        if (parsed && parsed.type === 'MEMBER' && parsed.member?.id && !parsed.id) {
          parsed.id = parsed.member.id;
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Session locale non chargée:', e);
    }
    return null;
  });

  const setCurrentUser = (userOrUpdater: any) => {
    setCurrentUserState((prev) => {
      const resolved = typeof userOrUpdater === 'function' ? userOrUpdater(prev) : userOrUpdater;
      if (!resolved) {
        return null;
      }
      let userObj: CurrentUser;
      if (!('type' in resolved)) {
        const mem = resolved as RouamaMember;
        const defaultRoles = getDefaultRolesForMember(mem.id, mem.firstName, mem.nickname);
        userObj = {
          type: 'MEMBER',
          activeView: 'MEMBER',
          id: mem.id,
          member: mem,
          roles: mem.roles || defaultRoles.roles,
          departments: mem.departments || defaultRoles.departments,
          adminRole: mem.assignedRole || defaultRoles.adminRole,
        };
      } else {
        userObj = { ...resolved };
        if (userObj.type === 'MEMBER' && userObj.member?.id && !userObj.id) {
          userObj.id = userObj.member.id;
        }
        const memberId = userObj.member?.id || userObj.id;
        if (memberId) {
          const defaultRoles = getDefaultRolesForMember(
            memberId,
            userObj.member?.firstName || userObj.firstName,
            userObj.member?.nickname || userObj.nickname
          );
          if (!userObj.roles) {
            userObj.roles = userObj.member?.roles || defaultRoles.roles;
          }
          if (!userObj.departments) {
            userObj.departments = userObj.member?.departments || defaultRoles.departments;
          }
          if (!userObj.adminRole) {
            userObj.adminRole = userObj.member?.assignedRole || defaultRoles.adminRole;
          }
        }
      }
      return userObj;
    });
  };

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Normalisateur universel de la caisse d'un décaissement (caisseSource ou fund)
  const normalizeWithdrawalFund = (wOrSource: any): FundType => {
    const src = typeof wOrSource === 'string'
      ? wOrSource
      : String(wOrSource?.caisseSource || wOrSource?.fund || wOrSource?.caisse || wOrSource?.sourceCaisse || '');
    const s = src.toUpperCase().trim();
    if (s.includes('EXTRA')) return 'EXTRA';
    if (s.includes('COTIS')) return 'COTISATION';
    if (s.includes('ANNIV') || s.includes('CÉLÉBRATION') || s.includes('CELEBRATION')) return 'ANNIVERSAIRE';
    if (s.includes('LOISIR') || s.includes('SORTIE')) return 'LOISIRS';
    if (s.includes('AGR') || s.includes('PROJET')) return 'AGR';
    if (s.includes('CAS') || s.includes('SOCIAL') || s.includes('ENTRAIDE')) return 'CAS_SOCIAUX';
    if (s.includes('SOIREE') || s.includes('SOIRÉE')) return 'SOIREE_ROUAMA';
    return (wOrSource?.fund as FundType) || 'EXTRA';
  };

  // Détecteur universel d'approbation d'un décaissement par le CERVEAU
  const isWithdrawalApproved = (w: any): boolean => {
    if (!w) return false;
    if (w.isApproved === true) return true;
    const s = String(w.status || '').toLowerCase().trim();
    return (
      w.status === 'APPROVED' ||
      s === 'approved' ||
      s === 'approuvé' ||
      s === 'approuve' ||
      s === 'validé' ||
      s === 'valide' ||
      s === 'validated' ||
      s.includes('approuv') ||
      s.includes('valid')
    );
  };

  // États applicatifs synchronisés en temps réel via Firestore
  const [members, setMembers] = useState<RouamaMember[]>(INITIAL_ROUAMA_MEMBERS);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => getStoredAdminCredentials());
  const [fundBalances, setFundBalances] = useState<Record<FundType, number>>({
    COTISATION: 0,
    ANNIVERSAIRE: 0,
    SOIREE_ROUAMA: 0,
    LOISIRS: 0,
    AGR: 0,
    CAS_SOCIAUX: 0,
    EXTRA: 0,
  });
  const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const withdrawalsRef = useRef<WithdrawalRequest[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [activities, setActivities] = useState<EventActivity[]>([DEFAULT_ANNIVERSAIRE_ACTIVITY, DEFAULT_SOIREE_ACTIVITY]);
  const [projects, setProjects] = useState<AgrProject[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialEvent[]>([]);
  const [archiveDocs, setArchiveDocs] = useState<ArchiveDoc[]>([]);
  const [pvs, setPvs] = useState<SecretaryPV[]>([]);
  const [bilans, setBilans] = useState<FinancialBilan[]>([]);
  const [verseOfTheDay, setVerseOfTheDay] = useState<VerseOfTheDay | null>({
    verse: "« Car là où deux ou trois sont assemblés en mon nom, je suis au milieu d'eux. »",
    reference: "Matthieu 18:20",
    date: new Date().toLocaleDateString('fr-FR'),
    updatedBy: 'SPIRITUALITÉ',
  });
  const [prayerIntentions, setPrayerIntentions] = useState<PrayerIntention[]>([]);
  const [religiousEvents, setReligiousEvents] = useState<ReligiousEvent[]>([]);
  const [programmeTasks, setProgrammeTasks] = useState<ProgrammeTask[]>([]);
  const [programmeAlerts, setProgrammeAlerts] = useState<ProgrammeAlert[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLoginLog[]>([]);
  const [infoRequests, setInfoRequests] = useState<InfoRequest[]>([]);

  // Sauvegarder la session active locale
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify(currentUser));
        if (currentUser.type === 'MEMBER' && currentUser.member) {
          localStorage.setItem('rouama_user', JSON.stringify(currentUser.member));
        } else {
          localStorage.setItem('rouama_user', JSON.stringify(currentUser));
        }
      } else {
        localStorage.removeItem(EROUAMA_ACTIVE_SESSION_KEY);
        localStorage.removeItem('rouama_user');
      }
    } catch (e) {
      console.warn('Erreur stockage session locale:', e);
    }
  }, [currentUser]);

  // =========================================================================
  // ÉCOUTEURS EN TEMPS RÉEL (onSnapshot) FIREBASE FIRESTORE
  // =========================================================================
  useEffect(() => {
    // 0. Vérification de la connexion
    testFirestoreConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    // 0.bis Initialisation locale fluide sans surcharge de quota Firestore
    const purgeTestDocsAndSyncWilfried = async () => {
      // Les données sont synchronisées de manière optimale en mémoire pour préserver les quotas Firestore
    };
    if (!hasRunStartupSync) {
      hasRunStartupSync = true;
      purgeTestDocsAndSyncWilfried();
    }

    const unsubscribes: (() => void)[] = [];

    // Caches internes pour le recalcul dynamique et automatique des soldes
    let receiptsCache: any[] = [];
    let paymentsCache: any[] = [];

    const syncDynamicBalances = () => {
      const mergedMap = new Map<string, any>();
      receiptsCache.forEach(r => mergedMap.set(r.id, r));
      paymentsCache.forEach(p => {
        const existing = mergedMap.get(p.id) || {};
        mergedMap.set(p.id, { ...existing, ...p });
      });
      const allDecls = Array.from(mergedMap.values());

      // 1. RECALCUL AUTOMATIQUE ET DYNAMIQUE DES SOLDES (FIRESTORE) :
      const validatedPayments = allDecls.filter(p => 
        !p.isHidden && 
        p.status !== 'deleted' && 
        p.status !== 'hidden' &&
        p.status !== 'rejected' &&
        p.status !== 'REJECTED' &&
        (
          p.status === 'validated' || 
          p.status === 'Validé' || 
          p.status === 'approved' || 
          p.status === 'APPROVED' || 
          p.isValidated === true ||
          String(p.status || '').toLowerCase().trim() === 'validated' ||
          String(p.status || '').toLowerCase().trim() === 'approved' ||
          String(p.status || '').toLowerCase().trim() === 'validé' ||
          String(p.status || '').toLowerCase().trim() === 'valide'
        )
      );

      // Calcul par sous-caisse
      const cotisations = validatedPayments
        .filter(p => 
          p.type === 'Cotisation Mensuelle' || 
          p.caisse === 'Cotisation Mensuelle' || 
          p.fund === 'COTISATION' || 
          (!p.type && !p.caisse && (!p.fund || p.fund === 'COTISATION')) ||
          (!p.type && !p.caisse)
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      const anniversaire = validatedPayments
        .filter(p => 
          p.type === 'Anniversaire' || 
          p.caisse === 'Anniversaire' || 
          p.fund === 'ANNIVERSAIRE' ||
          p.type === 'Célébration 21 mars (Anniversaire)' ||
          p.caisse === 'Célébration 21 mars (Anniversaire)'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      const sorties = validatedPayments
        .filter(p => 
          p.type === 'Sorties & Loisirs' || 
          p.caisse === 'Sorties & Loisirs' || 
          p.fund === 'LOISIRS' ||
          p.type === 'Loisirs' ||
          p.caisse === 'Loisirs' ||
          p.type === 'Sorties' ||
          p.caisse === 'Sorties'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      const agr = validatedPayments
        .filter(p => 
          p.type === 'Projets AGR' || 
          p.caisse === 'Projets AGR' || 
          p.fund === 'AGR' ||
          p.type === 'AGR' ||
          p.caisse === 'AGR'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      const casSociaux = validatedPayments
        .filter(p => 
          p.type === 'Cas Sociaux' || 
          p.caisse === 'Cas Sociaux' || 
          p.fund === 'CAS_SOCIAUX' ||
          p.type === 'Cas Sociaux & Entraide' ||
          p.caisse === 'Cas Sociaux & Entraide'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      const extra = validatedPayments
        .filter(p =>
          p.type === 'Caisse Extra' ||
          p.caisse === 'Caisse Extra' ||
          p.fund === 'EXTRA' ||
          p.subCategory === 'Caisse Extra'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      // Calcul des décaissements validés par le CERVEAU par sous-caisse
      const approvedW = (withdrawalsRef.current || []).filter(isWithdrawalApproved);
      const withdrawnPerFund: Record<FundType, number> = {
        COTISATION: 0,
        ANNIVERSAIRE: 0,
        SOIREE_ROUAMA: 0,
        LOISIRS: 0,
        AGR: 0,
        CAS_SOCIAUX: 0,
        EXTRA: 0,
      };
      approvedW.forEach(w => {
        const f = normalizeWithdrawalFund(w);
        const amt = Number(w.amount) || Number((w as any).montant) || 0;
        withdrawnPerFund[f] = (withdrawnPerFund[f] || 0) + amt;
      });

      const computed: Record<FundType, number> = {
        COTISATION: Math.max(0, cotisations - withdrawnPerFund.COTISATION),
        ANNIVERSAIRE: Math.max(0, anniversaire - withdrawnPerFund.ANNIVERSAIRE),
        LOISIRS: Math.max(0, sorties - withdrawnPerFund.LOISIRS),
        AGR: Math.max(0, agr - withdrawnPerFund.AGR),
        CAS_SOCIAUX: Math.max(0, casSociaux - withdrawnPerFund.CAS_SOCIAUX),
        SOIREE_ROUAMA: 0,
        EXTRA: Math.max(0, extra - withdrawnPerFund.EXTRA),
      };

      setFundBalances(prev => ({
        ...prev,
        ...computed,
      }));

      // Synchronisation réactive unifiée : l'état des déclarations reflète la validation en temps réel
      setDeclarations(allDecls);
    };

    // 1. REÇUS DE PAIEMENT (Collection 'receipts' synchronisée EXCLUSIVEMENT en temps réel depuis Firestore)
    const unsubReceipts = onSnapshot(
      collection(db, 'receipts'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        // Conserver l'intégralité de l'historique sans jamais le purger (sauf nettoyage explicite des tests)
        const loaded: PaymentDeclaration[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const docId = docSnap.id;

          // Nettoyage automatique des 2 déclarations de test de Wilfried (CAPELO) des 09/09/2026 et 18/09/2026
          const isWilfried =
            data.memberId === '1' ||
            data.memberName?.toUpperCase()?.includes('WILFRIED') ||
            data.memberNickname?.toUpperCase()?.includes('CAPELO');
          const dateStr = String(data.date || '');
          const isTestDate = dateStr.includes('09/09/2026') || dateStr.includes('18/09/2026');
          const isRejectedTest = isWilfried && isTestDate && (data.status === 'REJECTED' || data.isTest || data.rejectionReason?.includes('test'));

          if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') {
            return;
          }

          if (isRejectedTest) {
            return;
          }

          loaded.push({
            ...data,
            id: docId,
          });
        });

        // Tri chronologique rigoureux : reçus les plus récents en premier
        loaded.sort((a, b) => {
          const timeA = (a as any).createdAt || 0;
          const timeB = (b as any).createdAt || 0;
          if (timeA && timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        });

        // La liste affichée provient EXCLUSIVEMENT de Firestore et conserve tout l'historique
        receiptsCache = loaded;
        setDeclarations(loaded);
        syncDynamicBalances();
      },
      (err) => {
        console.warn('Firestore receipts listener notification:', err);
      }
    );
    unsubscribes.push(unsubReceipts);

    // 1.bis PAIEMENTS DE LA CAISSE (Collection 'payments' synchronisée en temps réel depuis Firestore)
    const unsubPayments = onSnapshot(
      collection(db, 'payments'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        const loadedPayments: any[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') {
            return;
          }
          loadedPayments.push({ id: docSnap.id, ...data });
        });
        paymentsCache = loadedPayments;
        syncDynamicBalances();
      },
      (err) => {
        console.warn('Firestore payments listener notification in AppContext:', err);
      }
    );
    unsubscribes.push(unsubPayments);

    // 2. ÉCOUTEUR UNIQUE EN TEMPS RÉEL DE LA COLLECTION 'users'
    // Harmonisation stricte : un seul et unique écouteur Firestore en temps réel pour tous les membres
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setIsFirebaseConnected(true);

        const usersDocsMap = new Map<string, any>();
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          // Ignorer les identifiants de rôles admin s'ils existent dans users
          if (['TRESORIER', 'CERVEAU', 'PAYOR', 'SDP', 'ORGANISATEUR', 'PROJET', 'COM', 'SECRETARIAT', 'SPIRITUALITE'].includes(docSnap.id)) {
            return;
          }
          usersDocsMap.set(docSnap.id, { ...d, _docId: docSnap.id });
        });

        // Harmonisation stricte avec les 12 membres officiels
        const reconciledList: RouamaMember[] = INITIAL_ROUAMA_MEMBERS.map((official) => {
          let uDoc = usersDocsMap.get(official.id);
          if (!uDoc) {
            for (const docData of usersDocsMap.values()) {
              if (
                normalizeRosterString(docData.firstName) === normalizeRosterString(official.firstName) ||
                normalizeRosterString(docData.nickname) === normalizeRosterString(official.nickname) ||
                (docData.fullRosterName && normalizeRosterString(docData.fullRosterName).includes(normalizeRosterString(official.firstName))) ||
                (official.fullRosterName && normalizeRosterString(official.fullRosterName).includes(normalizeRosterString(docData.firstName))) ||
                (official.id === '2' && (normalizeRosterString(docData.firstName) === 'ORTINIEL' || normalizeRosterString(docData.nickname) === 'ESPRIT')) ||
                (official.id === '11' && (normalizeRosterString(docData.nickname) === 'CLEMSO' || normalizeRosterString(docData.firstName) === 'LEGER'))
              ) {
                uDoc = docData;
                break;
              }
            }
          }

          const rawPin = uDoc
            ? (uDoc.pinCode !== undefined ? uDoc.pinCode : (uDoc.pin !== undefined ? uDoc.pin : (uDoc.password || uDoc.code || '')))
            : (official.pinCode || official.pin || '');
          const cleanPin = rawPin && String(rawPin).trim() !== '' && String(rawPin).trim() !== 'Non défini' ? String(rawPin).trim() : '';

          // RÈGLE : Un membre est considéré comme "INSCRIT ET ACTIVÉ" dans TOUTE l'application si ET SEULEMENT SI :
          // - Son document Firestore possède un code PIN valide (non vide) : m.pinCode && String(m.pinCode).trim() !== ""
          // OU
          // - Son champ d'activation est vrai : m.isRegistered === true OU m.statut === "Activé".
          const isActive = uDoc
            ? Boolean(
                (cleanPin !== '') ||
                uDoc.isRegistered === true ||
                uDoc.statut === 'Activé'
              )
            : Boolean(
                (cleanPin !== '') ||
                official.isRegistered === true ||
                official.statut === 'Activé'
              );

          const photo =
            (typeof uDoc?.photoUrl === 'string' && uDoc.photoUrl.trim() ? uDoc.photoUrl.trim() : '') ||
            (typeof uDoc?.avatar === 'string' && uDoc.avatar.trim() ? uDoc.avatar.trim() : '') ||
            (typeof uDoc?.photoURL === 'string' && uDoc.photoURL.trim() ? uDoc.photoURL.trim() : '') ||
            official.photoUrl ||
            official.avatar ||
            '';

          const effectivePin = cleanPin || (isActive && !uDoc ? (official.pinCode || official.pin || undefined) : undefined);

          const defaultRoles = getDefaultRolesForMember(official.id, official.firstName, official.nickname);
          const memberRoles = uDoc?.roles || (official as any).roles || defaultRoles.roles;
          const memberDepts = uDoc?.departments || (official as any).departments || defaultRoles.departments;
          const memberFcmTokens = Array.isArray(uDoc?.fcmTokens) ? uDoc.fcmTokens : (uDoc?.fcmToken ? [uDoc.fcmToken] : []);

          return {
            id: official.id,
            firstName: official.firstName,
            nickname: official.nickname,
            fullRosterName: official.fullRosterName,
            phone: uDoc?.phone || official.phone,
            email: uDoc?.email || official.email || '',
            pin: effectivePin,
            pinCode: effectivePin,
            statut: isActive ? 'Activé' : 'En attente',
            isRegistered: isActive,
            avatar: photo,
            photoUrl: photo,
            assignedRole: uDoc?.assignedRole || official.assignedRole || defaultRoles.adminRole,
            roles: memberRoles,
            departments: memberDepts,
            fcmTokens: memberFcmTokens,
            fcmToken: uDoc?.fcmToken || memberFcmTokens[0] || undefined,
            resteADevoir: typeof uDoc?.resteADevoir === 'number' ? uDoc.resteADevoir : (official.resteADevoir || 0),
            totalPaid: typeof uDoc?.totalPaid === 'number' ? uDoc.totalPaid : (typeof uDoc?.solde === 'number' ? uDoc.solde : (typeof uDoc?.montantPaye === 'number' ? uDoc.montantPaye : undefined)),
            solde: typeof uDoc?.solde === 'number' ? uDoc.solde : (typeof uDoc?.totalPaid === 'number' ? uDoc.totalPaid : undefined),
            unpaidMonths: typeof uDoc?.unpaidMonths === 'number' ? uDoc.unpaidMonths : (typeof uDoc?.moisRetard === 'number' ? uDoc.moisRetard : undefined),
            moisRetard: typeof uDoc?.moisRetard === 'number' ? uDoc.moisRetard : (typeof uDoc?.unpaidMonths === 'number' ? uDoc.unpaidMonths : undefined),
            duesStatus: uDoc?.duesStatus || uDoc?.statutCotisation || undefined,
            statutCotisation: uDoc?.statutCotisation || uDoc?.duesStatus || undefined,
            statutDemande: uDoc?.statutDemande || undefined,
            updatedAt: uDoc?.updatedAt || official.updatedAt,
            lastLogin: uDoc?.lastLogin || official.lastLogin,
          };
        });

        setMembers(reconciledList);

        // Mettre à jour l'utilisateur actif si c'est un membre et rafraîchir sa photo de profil / infos
        setCurrentUser((prev) => {
          if (prev && prev.type === 'MEMBER' && prev.member) {
            const fresh = reconciledList.find((m) =>
              m.id === prev.member!.id ||
              normalizeRosterString(m.firstName) === normalizeRosterString(prev.member!.firstName) ||
              normalizeRosterString(m.nickname) === normalizeRosterString(prev.member!.nickname)
            );
            if (fresh) {
              const photo = fresh.photoUrl || fresh.avatar || prev.member.photoUrl || prev.member.avatar;
              const updatedMember = {
                ...prev.member,
                ...fresh,
                avatar: photo,
                photoUrl: photo,
              };
              try {
                localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify({ ...prev, member: updatedMember }));
                localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
              } catch (e) {}
              return { ...prev, member: updatedMember };
            }
          }
          return prev;
        });
      },
      (err) => {
        console.warn('Firestore users listener notification:', err);
      }
    );
    unsubscribes.push(unsubUsers);

    // 3. CAISSES & TRÉSORERIE
    const unsubTreasury = onSnapshot(
      doc(db, 'treasury', 'balances'),
      (docSnap) => {
        setIsFirebaseConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<FundType, number>;
          setFundBalances(prev => {
            const hasPositive = Object.values(data || {}).some(v => typeof v === 'number' && v > 0);
            return hasPositive ? { ...prev, ...data } : prev;
          });
        }
      },
      (err) => {
        console.warn('Firestore treasury listener notification:', err);
      }
    );
    unsubscribes.push(unsubTreasury);

    // 4. ACTIVITÉS & SORTIES
    const unsubActivities = onSnapshot(
      collection(db, 'activities'),
      (snapshot) => {
        const loaded: EventActivity[] = [];
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));

        // Garantie de présence des 2 activités statutaires de l'Organisation (Anniversaire & Soirée)
        const hasAnniversaire = loaded.some(
          a => a.fixedType === 'ANNIVERSAIRE' || a.id === 'ACT-ANNIVERSAIRE-2027' || a.title?.toUpperCase().includes('ANNIVERSAIRE')
        );
        if (!hasAnniversaire) {
          loaded.push(DEFAULT_ANNIVERSAIRE_ACTIVITY);
        }

        const hasSoiree = loaded.some(
          a => a.fixedType === 'SOIREE_ROUAMA' || a.id === 'ACT-SOIREE-2026' || a.title?.toUpperCase().includes('SOIRÉE') || a.title?.toUpperCase().includes('SOIREE')
        );
        if (!hasSoiree) {
          loaded.push(DEFAULT_SOIREE_ACTIVITY);
        }

        // Nettoyage systématique des lieux inventés : mention 'À définir' tant que non officialisés
        loaded.forEach(a => {
          if (!a.location || !a.location.trim() || a.location.includes('Espace Festif') || a.location.includes('Salle des Fêtes') || a.location.trim().toLowerCase() === 'abidjan') {
            a.location = 'À définir';
          }
        });

        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setActivities(loaded);
      },
      (err) => console.warn('Activities listener error:', err)
    );
    unsubscribes.push(unsubActivities);

    // 5. PROJETS AGR (Avec synchronisation dateRealisation et archivage automatique au Grenier)
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snapshot) => {
        const loaded: AgrProject[] = [];
        snapshot.forEach(d => {
          const item = { id: d.id, ...(d.data() as any) } as AgrProject;
          if (!item.dateRealisation && item.eventDate) item.dateRealisation = item.eventDate;
          if (!item.eventDate && item.dateRealisation) item.eventDate = item.dateRealisation;

          // Archivage automatique dès que la date de réalisation est atteinte ou dépassée
          const isLive = item.status === 'active' || item.status === 'PUBLISHED';
          const targetDate = item.dateRealisation || item.eventDate;
          if (isLive && targetDate && isRealizationDateReached(targetDate)) {
            item.status = 'archived';
          }

          loaded.push(item);
        });
        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setProjects(loaded);
      },
      (err) => console.warn('Projects listener error:', err)
    );
    unsubscribes.push(unsubProjects);

    // 6. ACTUALITÉS & ANNONCES
    const unsubNews = onSnapshot(
      collection(db, 'news'),
      (snapshot) => {
        const loaded: NewsItem[] = [];
        snapshot.forEach(d => {
          const item = { id: d.id, ...(d.data() as any) };
          // Exclusion stricte des messages supprimés ou masqués
          if (
            item.deleted === true ||
            item.isDeleted === true ||
            item.status === 'deleted' ||
            item.status === 'supprime' ||
            item.status === 'hidden' ||
            item.isHidden === true
          ) {
            return;
          }
          // Séparation stricte : filtrer les messages exclusifs au canal MAIL
          if (item.dispatchChannel !== 'MAIL') {
            loaded.push(item);
          }
        });
        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setNewsItems(loaded);
      },
      (err) => console.warn('News listener error:', err)
    );
    unsubscribes.push(unsubNews);

    // 7. TRANSACTIONS (Conservation intégrale et chronologique de l'historique Firestore)
    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const loaded: Transaction[] = [];
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          const isWilfried =
            data.memberId === '1' ||
            data.memberNickname?.toUpperCase()?.includes('CAPELO') ||
            data.description?.toUpperCase()?.includes('CAPELO') ||
            data.description?.toUpperCase()?.includes('WILFRIED');
          const dateStr = String(data.date || '');
          const isTestDate = dateStr.includes('09/09/2026') || dateStr.includes('18/09/2026');
          const isRejectedTest = isWilfried && isTestDate && (data.status === 'REJECTED' || data.isTest || data.description?.toLowerCase()?.includes('test'));

          if (isRejectedTest) {
            return;
          }

          loaded.push({
            ...data,
            id: docSnap.id,
          });
        });
        loaded.sort((a, b) => {
          const timeA = (a as any).createdAt || 0;
          const timeB = (b as any).createdAt || 0;
          if (timeA && timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        });
        setTransactions(loaded);
      },
      (err) => console.warn('Transactions listener error:', err)
    );
    unsubscribes.push(unsubTransactions);

    // 8. DÉCAISSEMENTS (Conservation intégrale de l'historique Firestore)
    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawals'),
      (snapshot) => {
        const loaded: WithdrawalRequest[] = snapshot.docs.map(d => ({
          ...(d.data() as any),
          id: d.id,
        }));
        withdrawalsRef.current = loaded;
        setWithdrawals(loaded);

        // Déduction dynamique réactive des décaissements approuvés par le CERVEAU
        const approvedW = loaded.filter(isWithdrawalApproved);
        const extraApprovedOut = approvedW
          .filter(w => normalizeWithdrawalFund(w) === 'EXTRA')
          .reduce((sum, w) => sum + (Number(w.amount) || Number((w as any).montant) || 0), 0);

        if (extraApprovedOut > 0) {
          setFundBalances(prev => {
            if (prev.EXTRA >= 36000) {
              return {
                ...prev,
                EXTRA: Math.max(0, 36000 - extraApprovedOut),
              };
            }
            return prev;
          });
        }
      },
      (err) => console.warn('Withdrawals listener error:', err)
    );
    unsubscribes.push(unsubWithdrawals);

    // 9. ÉVÉNEMENTS FINANCIERS
    const unsubFinancialEvents = onSnapshot(
      collection(db, 'financial_events'),
      (snapshot) => {
        const loaded: FinancialEvent[] = [];
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setFinancialEvents(loaded);
      },
      (err) => console.warn('Financial events listener error:', err)
    );
    unsubscribes.push(unsubFinancialEvents);

    // 10. SPIRITUALITÉ (Verset, Intentions, Événements)
    const unsubVerse = onSnapshot(doc(db, 'spiritual', 'verse'), (docSnap) => {
      if (docSnap.exists()) {
        setVerseOfTheDay(docSnap.data() as VerseOfTheDay);
      }
    });
    unsubscribes.push(unsubVerse);

    const unsubIntentions = onSnapshot(collection(db, 'prayer_intentions'), (snapshot) => {
      const loaded: PrayerIntention[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => b.id.localeCompare(a.id));
      setPrayerIntentions(loaded);
    });
    unsubscribes.push(unsubIntentions);

    const unsubRelEvents = onSnapshot(collection(db, 'religious_events'), (snapshot) => {
      const loaded: ReligiousEvent[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => b.id.localeCompare(a.id));
      setReligiousEvents(loaded);
    });
    unsubscribes.push(unsubRelEvents);

    // 11. SECRÉTARIAT, PVS ET BILANS
    const unsubPvs = onSnapshot(collection(db, 'secretary_pvs'), (snapshot) => {
      const loaded: SecretaryPV[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => b.id.localeCompare(a.id));
      setPvs(loaded);
    });
    unsubscribes.push(unsubPvs);

    const unsubBilans = onSnapshot(collection(db, 'secretary_bilans'), (snapshot) => {
      const loaded: FinancialBilan[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => b.id.localeCompare(a.id));
      setBilans(loaded);
    });
    unsubscribes.push(unsubBilans);

    const unsubArchives = onSnapshot(collection(db, 'archive_docs'), (snapshot) => {
      const loaded: ArchiveDoc[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => b.id.localeCompare(a.id));
      setArchiveDocs(loaded);
    });
    unsubscribes.push(unsubArchives);

    // 12. IDENTIFIANTS ADMINISTRATEURS (Écoute doc admin/credentials + collection admins)
    const unsubAdmins = onSnapshot(doc(db, 'admin', 'credentials'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          const firestoreList = data.list.map((item: any) => ({
            ...item,
            pin: item.password || item.pin,
            password: item.password || item.pin,
          }));

          const merged = ADMIN_USERS.map(defaultAdmin => {
            const found = firestoreList.find((p: any) => p.id === defaultAdmin.id);
            if (found) {
              return {
                ...defaultAdmin,
                loginId: found.loginId || defaultAdmin.loginId,
                pin: found.pin || found.password || defaultAdmin.pin,
                password: found.password || found.pin || defaultAdmin.password || defaultAdmin.pin,
              };
            }
            return defaultAdmin;
          });

          setAdminUsers(merged);
        }
      } else {
        setAdminUsers(ADMIN_USERS);
      }
    });
    unsubscribes.push(unsubAdmins);

    const unsubAdminsColl = onSnapshot(collection(db, 'admins'), (snapshot) => {
      if (!snapshot.empty) {
        setAdminUsers(prev => {
          const map = new Map<string, AdminUser>();
          // Toujours initialiser avec les rôles par défaut de ADMIN_USERS
          ADMIN_USERS.forEach(a => map.set(a.id, a));
          prev.forEach(a => map.set(a.id, a));
          snapshot.forEach(d => {
            const data = d.data() as any;
            const existing = map.get(d.id as any);
            const pwd = data.password || data.pin || (existing ? (existing.password || existing.pin) : '');
            if (existing) {
              map.set(d.id as any, {
                ...existing,
                loginId: data.loginId || existing.loginId,
                pin: pwd,
                password: pwd,
              });
            } else {
              map.set(d.id as any, {
                id: d.id as any,
                loginId: data.loginId || d.id,
                roleName: data.roleName || d.id,
                pin: pwd,
                password: pwd,
                description: data.description || '',
              });
            }
          });
          return Array.from(map.values());
        });
      }
    });
    unsubscribes.push(unsubAdminsColl);

    // 13. SUIVI DU PROGRAMME & ALERTES (SDP)
    const unsubProgTasks = onSnapshot(collection(db, 'programme_tasks'), (snapshot) => {
      const loaded: ProgrammeTask[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
      setProgrammeTasks(loaded);
    });
    unsubscribes.push(unsubProgTasks);

    const unsubProgAlerts = onSnapshot(collection(db, 'programme_alerts'), (snapshot) => {
      const loaded: ProgrammeAlert[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
      setProgrammeAlerts(loaded);
    });
    unsubscribes.push(unsubProgAlerts);

    // 14. AUDIT DES CONNEXIONS ADMINISTRATEURS & RESPONSABLES (LOGS FIRESTORE)
    const unsubAdminLogs = onSnapshot(collection(db, 'admin_logs'), (snapshot) => {
      const loaded: AdminLoginLog[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => (b.loginTimestamp || '').localeCompare(a.loginTimestamp || ''));
      setAdminLogs(loaded);
    });
    unsubscribes.push(unsubAdminLogs);

    // 15. DEMANDES D'INFORMATION INTER-ADMINS (MESSAGERIE B2B - info_requests)
    const unsubInfoReqs = onSnapshot(collection(db, 'info_requests'), (snapshot) => {
      const loaded: InfoRequest[] = [];
      snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
      loaded.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setInfoRequests(loaded);
    });
    unsubscribes.push(unsubInfoReqs);

    return () => {
      unsubscribes.forEach(u => u());
    };
  }, []);

  // CHARGEMENT AUTOMATIQUE AU RECHARGEMENT / RECONNEXION DU MEMBRE DEPUIS FIRESTORE
  // ÉCOUTE EN TEMPS RÉEL DU SOLDE, DES STATUTS ET DES COTISATIONS DU MEMBRE ACTIF (FIRESTORE)
  useEffect(() => {
    if (currentUser?.type === 'MEMBER' && currentUser.member?.id) {
      const currentUserId = String(currentUser.member.id).trim();
      const unsubs: (() => void)[] = [];

      // 1. Écouteur en temps réel sur le document utilisateur du membre ('users')
      const userRef = doc(db, 'users', currentUserId);
      const unsubUser = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const photo = data.photoUrl || data.avatar || data.photoURL;

            setCurrentUser((prev) => {
              if (prev && prev.type === 'MEMBER' && prev.member && String(prev.member.id).trim() === currentUserId) {
                const updatedMember = {
                  ...prev.member,
                  ...data,
                  id: currentUserId,
                  photoUrl: photo || prev.member.photoUrl,
                  avatar: photo || prev.member.avatar,
                  resteADevoir: typeof data.resteADevoir === 'number' ? data.resteADevoir : prev.member.resteADevoir,
                  totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : (typeof data.solde === 'number' ? data.solde : prev.member.totalPaid),
                  solde: typeof data.solde === 'number' ? data.solde : (typeof data.totalPaid === 'number' ? data.totalPaid : prev.member.solde),
                  unpaidMonths: typeof data.unpaidMonths === 'number' ? data.unpaidMonths : (typeof data.moisRetard === 'number' ? data.moisRetard : prev.member.unpaidMonths),
                  moisRetard: typeof data.moisRetard === 'number' ? data.moisRetard : (typeof data.unpaidMonths === 'number' ? data.unpaidMonths : prev.member.moisRetard),
                  duesStatus: data.duesStatus || data.statutCotisation || prev.member.duesStatus,
                  statutCotisation: data.statutCotisation || data.duesStatus || prev.member.statutCotisation,
                  statutDemande: data.statutDemande || prev.member.statutDemande,
                };
                try {
                  localStorage.setItem(
                    EROUAMA_ACTIVE_SESSION_KEY,
                    JSON.stringify({ ...prev, member: updatedMember })
                  );
                  localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
                } catch (e) {}
                return {
                  ...prev,
                  member: updatedMember,
                };
              }
              return prev;
            });

            setMembers((prev) =>
              prev.map((m) =>
                String(m.id).trim() === currentUserId
                  ? {
                      ...m,
                      ...data,
                      id: currentUserId,
                      photoUrl: photo || m.photoUrl,
                      avatar: photo || m.avatar,
                      resteADevoir: typeof data.resteADevoir === 'number' ? data.resteADevoir : m.resteADevoir,
                      totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : (typeof data.solde === 'number' ? data.solde : m.totalPaid),
                      solde: typeof data.solde === 'number' ? data.solde : (typeof data.totalPaid === 'number' ? data.totalPaid : m.solde),
                      unpaidMonths: typeof data.unpaidMonths === 'number' ? data.unpaidMonths : (typeof data.moisRetard === 'number' ? data.moisRetard : m.unpaidMonths),
                      moisRetard: typeof data.moisRetard === 'number' ? data.moisRetard : (typeof data.unpaidMonths === 'number' ? data.unpaidMonths : m.moisRetard),
                      duesStatus: data.duesStatus || data.statutCotisation || m.duesStatus,
                      statutCotisation: data.statutCotisation || data.duesStatus || m.statutCotisation,
                      statutDemande: data.statutDemande || m.statutDemande,
                    }
                  : m
              )
            );
          }
        },
        (err) => console.warn('Erreur écouteur temps réel user:', err)
      );
      unsubs.push(unsubUser);

      // 2. Écouteur en temps réel sur le document membre ('members')
      const memberRef = doc(db, 'members', currentUserId);
      const unsubMember = onSnapshot(
        memberRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMembers((prev) =>
              prev.map((m) =>
                String(m.id).trim() === currentUserId
                  ? {
                      ...m,
                      ...data,
                      resteADevoir: typeof data.resteADevoir === 'number' ? data.resteADevoir : m.resteADevoir,
                      totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : (typeof data.solde === 'number' ? data.solde : m.totalPaid),
                      solde: typeof data.solde === 'number' ? data.solde : (typeof data.totalPaid === 'number' ? data.totalPaid : m.solde),
                      unpaidMonths: typeof data.unpaidMonths === 'number' ? data.unpaidMonths : (typeof data.moisRetard === 'number' ? data.moisRetard : m.unpaidMonths),
                      moisRetard: typeof data.moisRetard === 'number' ? data.moisRetard : (typeof data.unpaidMonths === 'number' ? data.unpaidMonths : m.moisRetard),
                      duesStatus: data.duesStatus || data.statutCotisation || m.duesStatus,
                    }
                  : m
              )
            );
          }
        },
        (err) => console.warn('Erreur écouteur temps réel member:', err)
      );
      unsubs.push(unsubMember);

      // 3. Écouteur en temps réel sur la sous-collection 'cotisations' du membre
      const userCotisationsRef = collection(db, 'users', currentUserId, 'cotisations');
      const unsubCotisations = onSnapshot(
        userCotisationsRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const items: any[] = [];
            snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
            const summary = items.find((x) => x.id === 'summary');
            if (summary) {
              setMembers((prev) =>
                prev.map((m) =>
                  String(m.id).trim() === currentUserId
                    ? {
                        ...m,
                        resteADevoir: typeof summary.resteADevoir === 'number' ? summary.resteADevoir : m.resteADevoir,
                        totalPaid: typeof summary.totalPaid === 'number' ? summary.totalPaid : m.totalPaid,
                        solde: typeof summary.solde === 'number' ? summary.solde : m.solde,
                        unpaidMonths: typeof summary.unpaidMonths === 'number' ? summary.unpaidMonths : m.unpaidMonths,
                        duesStatus: summary.duesStatus || m.duesStatus,
                      }
                    : m
                )
              );
            }
          }
        },
        (err) => console.warn('Erreur écouteur sous-collection cotisations:', err)
      );
      unsubs.push(unsubCotisations);

      return () => {
        unsubs.forEach((u) => u());
      };
    }
  }, [currentUser?.type, currentUser?.member?.id]);

  // Protection des données réelles : neutralisation des purges destructrices automatiques
  const resetAllData = async () => {
    console.warn("🛡️ Protection active : les données Firestore existantes (reçus, membres, caisses) sont strictement préservées.");
  };

  // Helper pour trouver un membre (accent-insensible et casse-insensible pour les 12 membres officiels)
  const findRosterMember = (search: string) => {
    const clean = normalizeRosterString(search);
    if (!clean) return undefined;
    return members.find(m =>
      normalizeRosterString(m.firstName) === clean ||
      normalizeRosterString(m.nickname) === clean ||
      normalizeRosterString(m.fullRosterName).includes(clean) ||
      (m.id === '2' && (clean === 'ORTINIEL' || clean === 'ESPRIT')) ||
      (m.id === '11' && (clean === 'CLEMSO' || clean === 'LEGER' || clean === 'STANIS' || clean === 'VENCESLAS' || clean === "L'ELU DE DIEU" || clean === "ELU DE DIEU"))
    );
  };

  // Inscription d'un membre avec activation et synchronisation Firestore
  const registerMember = async (inputName: string, pin: string): Promise<{ success: boolean; message: string }> => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return { success: false, message: 'Le code PIN doit comporter exactement 4 chiffres.' };
    }

    const matched = findRosterMember(inputName);
    if (!matched) {
      return { success: false, message: "Désolé mais ce prénom ne correspond à aucun des 12 membres officiels Rouama." };
    }

    const memberId = matched.id;
    let fsData: any = {};
    try {
      const docSnap = await getDoc(doc(db, "members", memberId));
      if (docSnap.exists()) {
        fsData = docSnap.data();
      }
    } catch (e) {
      console.warn('Erreur lecture Firestore dans registerMember:', e);
    }

    const candidatePin = fsData.pinCode || fsData.pin || matched.pinCode || matched.pin;
    const isAlreadyRegistered = Boolean((fsData.isRegistered === true || fsData.statut === 'Activé' || matched.statut === 'Activé') && candidatePin && candidatePin !== 'Non défini');

    // Si le compte est déjà activé avec un autre PIN, informer le membre
    if (isAlreadyRegistered && String(candidatePin).trim() !== String(pin).trim()) {
      return {
        success: false,
        message: `Le compte de ${matched.nickname} est déjà activé. Connectez-vous avec votre code PIN personnel ou contactez le CERVEAU.`
      };
    }

    const avatarUrl = (typeof fsData.avatar === 'string' && fsData.avatar.trim()) ||
      (typeof fsData.photoUrl === 'string' && fsData.photoUrl.trim()) ||
      (typeof fsData.photoURL === 'string' && fsData.photoURL.trim()) ||
      matched.avatar ||
      matched.photoUrl ||
      "";

    // 1. DANS LE FORMULAIRE DE PREMIÈRE CONNEXION / ACTIVATION :
    // Lorsqu'un membre saisit son prénom et définit son code PIN à 4 chiffres :
    // - Met à jour directement son document dans Firestore (users et members)
    const updatePayload = {
      id: memberId,
      firstName: matched.firstName,
      nickname: matched.nickname,
      fullRosterName: matched.fullRosterName,
      isRegistered: true,
      statut: 'Activé',
      pin: String(pin).trim(),
      pinCode: String(pin).trim(),
      avatar: avatarUrl || "",
      photoUrl: avatarUrl || "",
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await Promise.all([
        setDoc(doc(db, 'users', memberId), updatePayload, { merge: true }),
        setDoc(doc(db, 'members', memberId), updatePayload, { merge: true })
      ]);
    } catch (err) {
      console.warn('Erreur setDoc registerMember Firestore:', err);
    }

    const newRecord: RegisteredUserRecord = {
      id: matched.id,
      firstName: matched.firstName,
      nickname: matched.nickname,
      pin: pin,
      registrationDate: new Date().toISOString(),
    };
    saveRegisteredUserRecord(newRecord);

    const updatedMember: RouamaMember = {
      ...matched,
      isRegistered: true,
      statut: 'Activé',
      pin: String(pin).trim(),
      pinCode: String(pin).trim(),
      avatar: avatarUrl || matched.avatar,
      photoUrl: avatarUrl || matched.photoUrl,
    };

    setMembers(prev => prev.map(m => m.id === matched.id ? updatedMember : m));
    setCurrentUser({ type: 'MEMBER', member: updatedMember });
    return { success: true, message: `Compte activé avec succès ! Bienvenue chez vous, ${updatedMember.nickname} !` };
  };

  // Connexion Membre (par prénom officiel ou surnom fraternel)
  const loginMember = async (inputName: string, pin: string): Promise<{ success: boolean; message: string }> => {
    if (!inputName || !inputName.trim()) {
      return { success: false, message: 'Veuillez saisir votre prénom ou surnom fraternel.' };
    }

    const matched = findRosterMember(inputName);
    if (!matched) {
      return { success: false, message: "Désolé mais ce prénom ne correspond à aucun membre officiel Rouama. Vérifiez l'orthographe de votre prénom officiel." };
    }

    const memberId = matched.id;
    let fsData: any = {};
    try {
      const userSnap = await getDoc(doc(db, "users", memberId));
      if (userSnap.exists()) {
        fsData = userSnap.data();
      } else {
        const memSnap = await getDoc(doc(db, "members", memberId));
        if (memSnap.exists()) {
          fsData = memSnap.data();
        }
      }
    } catch (e) {
      console.warn('Erreur lecture Firestore dans loginMember:', e);
    }

    // VÉRIFICATION DU CODE PIN : Première connexion OU Vérification stricte
    const expectedPin = String(matched.pinCode || matched.pin || fsData.pinCode || fsData.pin || '').trim();
    const inputPinClean = String(pin).trim();
    const nowIso = new Date().toISOString();

    const avatarUrl = (typeof fsData.avatar === 'string' && fsData.avatar.trim()) ||
      (typeof fsData.photoUrl === 'string' && fsData.photoUrl.trim()) ||
      (typeof fsData.photoURL === 'string' && fsData.photoURL.trim()) ||
      matched.avatar ||
      matched.photoUrl ||
      "";

    // Cas 1 : Première connexion (pas encore de PIN dans Firestore)
    if (!expectedPin || expectedPin === 'Non défini') {
      try {
        try {
          await updateDoc(doc(db, "users", memberId), {
            pinCode: inputPinClean,
            pin: inputPinClean,
            isRegistered: true,
            statut: "Activé",
            lastLogin: nowIso,
            updatedAt: nowIso
          });
        } catch {
          await setDoc(doc(db, "users", memberId), {
            id: memberId,
            firstName: matched.firstName,
            nickname: matched.nickname,
            fullRosterName: matched.fullRosterName,
            pinCode: inputPinClean,
            pin: inputPinClean,
            isRegistered: true,
            statut: 'Activé',
            lastLogin: nowIso,
            updatedAt: nowIso
          }, { merge: true });
        }

        try {
          await setDoc(doc(db, "members", memberId), {
            id: memberId,
            firstName: matched.firstName,
            nickname: matched.nickname,
            fullRosterName: matched.fullRosterName,
            pinCode: inputPinClean,
            pin: inputPinClean,
            isRegistered: true,
            statut: 'Activé',
            lastLogin: nowIso,
            updatedAt: nowIso
          }, { merge: true });
        } catch (e) {
          console.warn(e);
        }

        const activatedMember: RouamaMember = {
          ...matched,
          isRegistered: true,
          statut: 'Activé',
          pin: inputPinClean,
          pinCode: inputPinClean,
          avatar: avatarUrl || matched.avatar,
          photoUrl: avatarUrl || matched.photoUrl,
          lastLogin: nowIso,
          updatedAt: nowIso
        };

        setMembers(prev => prev.map(m => m.id === memberId ? activatedMember : m));
        setCurrentUser({ type: 'MEMBER', member: activatedMember });
        return { success: true, message: `Bienvenue chez vous, ${activatedMember.nickname} ! Votre compte a été activé.` };
      } catch (err) {
        console.error('Erreur activation première connexion:', err);
        return { success: false, message: "Erreur lors de l'activation du compte." };
      }
    }

    // Cas 2 : Compte déjà activé -> Vérification stricte
    if (inputPinClean !== expectedPin) {
      return { success: false, message: 'Code PIN incorrect.' };
    }

    // PIN correct -> Enregistrement de lastLogin & statut dans Firestore (users et members)
    try {
      try {
        await updateDoc(doc(db, "users", memberId), {
          pinCode: expectedPin,
          pin: expectedPin,
          isRegistered: true,
          statut: "Activé",
          lastLogin: nowIso
        });
      } catch {
        await setDoc(doc(db, "users", memberId), {
          pinCode: expectedPin,
          pin: expectedPin,
          isRegistered: true,
          statut: 'Activé',
          lastLogin: nowIso
        }, { merge: true });
      }
      try {
        await setDoc(doc(db, "members", memberId), {
          pinCode: expectedPin,
          pin: expectedPin,
          isRegistered: true,
          statut: 'Activé',
          lastLogin: nowIso
        }, { merge: true });
      } catch (e) {
        console.warn(e);
      }
    } catch (err) {
      console.warn('Erreur updateDoc lastLogin Firestore:', err);
    }

    const connectedMember: RouamaMember = {
      ...matched,
      isRegistered: true,
      statut: 'Activé',
      pin: expectedPin,
      pinCode: expectedPin,
      avatar: avatarUrl || matched.avatar,
      photoUrl: avatarUrl || matched.photoUrl,
      lastLogin: nowIso,
    };

    setMembers(prev => prev.map(m => m.id === memberId ? connectedMember : m));
    setCurrentUser({ type: 'MEMBER', member: connectedMember });

    // Si le membre possède un rôle admin attribué, enregistrer dans admin_logs
    if (connectedMember.assignedRole) {
      logAdminConnection(
        connectedMember.assignedRole,
        `${connectedMember.firstName} (${connectedMember.nickname})`,
        connectedMember.id
      );
    }

    return { success: true, message: `Bienvenue chez vous, ${connectedMember.nickname} !` };
  };

  // Enregistrement des connexions d'administrateurs dans Firestore (admin_logs)
  const logAdminConnection = async (role: string, memberName?: string, userId?: string) => {
    try {
      const now = new Date();
      const payload = {
        userId: userId || role,
        memberName: memberName || role,
        role: role,
        loginTimestamp: now.toISOString(),
        dateString: now.toISOString().split('T')[0],
      };
      await addDoc(collection(db, 'admin_logs'), sanitizeFirestore(payload));
    } catch (err) {
      console.warn('Erreur log connexion admin:', err);
    }
  };

  // Connexion Admin
  const loginAdmin = (inputRoleOrLogin: string, pin: string) => {
    if (!inputRoleOrLogin || !inputRoleOrLogin.trim()) {
      return { success: false, message: "Veuillez saisir le rôle ou l'identifiant administrateur." };
    }

    const storedAdmins = getStoredAdminCredentials();
    const currentAdmins = adminUsers && adminUsers.length > 0 ? adminUsers : storedAdmins;

    // Garantir que tous les rôles par défaut de ADMIN_USERS (dont SDP) sont toujours présents et reconnus
    const effectiveAdmins = ADMIN_USERS.map(defaultAdmin => {
      const live = (currentAdmins || []).find(a => a.id === defaultAdmin.id);
      if (live) {
        return {
          ...defaultAdmin,
          ...live,
          loginId: live.loginId || defaultAdmin.loginId,
          pin: live.pin || live.password || defaultAdmin.pin,
          password: live.password || live.pin || defaultAdmin.password || defaultAdmin.pin,
        };
      }
      return defaultAdmin;
    });

    const cleanInput = inputRoleOrLogin.trim().toUpperCase().replace(/[\s-]/g, '_');
    const adminDef = effectiveAdmins.find(
      a =>
        a.id.toUpperCase() === cleanInput ||
        (a.loginId && a.loginId.toUpperCase() === cleanInput) ||
        a.roleName.toUpperCase() === cleanInput ||
        a.roleName.toUpperCase().includes(cleanInput) ||
        ((cleanInput === 'RESP_PROGRAMME' || cleanInput === 'SUIVI_PROGRAMME' || cleanInput.includes('PROGRAMME')) && a.id === 'SDP') ||
        ((cleanInput === 'ORGANISATEUR' || cleanInput.includes('ORGANI')) && a.id === 'ORGANISATION') ||
        ((cleanInput === 'RESP_PROJET' || cleanInput === 'RESPO_PROJET' || cleanInput.includes('PROJET')) && a.id === 'PROJET') ||
        ((cleanInput === 'SUPER_ADMIN' || cleanInput === 'SUPERADMIN' || cleanInput === 'ADMIN_GENERAL') && a.id === 'SUPER_ADMIN')
    );
    if (!adminDef) {
      return { success: false, message: 'Identifiant Administrateur invalide.' };
    }

    const expectedPassword = adminDef.password || adminDef.pin;
    const cleanPin = (pin || '').trim();
    if (!cleanPin || (expectedPassword !== cleanPin && adminDef.pin !== cleanPin && adminDef.password !== cleanPin)) {
      return { success: false, message: 'Mot de passe Administrateur incorrect.' };
    }

    setCurrentUser({ type: 'ADMIN', adminRole: adminDef.id });

    // 1. Enregistre un événement dans Firestore collection 'admin_logs'
    logAdminConnection(adminDef.id, adminDef.roleName, adminDef.id);

    return { success: true, message: `Connexion au rôle ${adminDef.roleName} réussie.` };
  };

  const updateAdminCredentials = (roleId: AdminRole, newLoginId: string, newPin: string) => {
    if (!newLoginId.trim()) {
      return { success: false, message: "L'identifiant de connexion ne peut pas être vide." };
    }
    if (!newPin.trim()) {
      return { success: false, message: "Le mot de passe / PIN ne peut pas être vide." };
    }

    const cleanPin = newPin.trim();
    const cleanLogin = newLoginId.trim();

    const updatedAdmins = adminUsers.map(a =>
      a.id === roleId
        ? { ...a, loginId: cleanLogin, pin: cleanPin, password: cleanPin }
        : a
    );

    setAdminUsers(updatedAdmins);
    saveStoredAdminCredentials(updatedAdmins);

    // Synchronisation Firestore (admin/credentials + collections admins et users)
    const targetAdmin = updatedAdmins.find(a => a.id === roleId);
    setDoc(doc(db, 'admin', 'credentials'), { list: sanitizeFirestore(updatedAdmins) }, { merge: true }).catch(console.warn);
    if (targetAdmin) {
      const adminPayload = {
        id: roleId,
        roleName: targetAdmin.roleName,
        loginId: cleanLogin,
        pin: cleanPin,
        password: cleanPin,
        updatedAt: new Date().toISOString(),
      };
      setDoc(doc(db, 'admins', roleId), adminPayload, { merge: true }).catch(console.warn);
      setDoc(doc(db, 'users', roleId), adminPayload, { merge: true }).catch(console.warn);
    }

    return { success: true, message: `Identifiants pour le poste ${roleId} mis à jour et enregistrés avec succès !` };
  };

  // Mise à jour sécurisée du mot de passe par l'administrateur connecté
  const updateAdminPassword = async (
    roleId: AdminRole,
    currentPasswordInput: string,
    newPasswordInput: string,
    confirmPasswordInput: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentPasswordInput || !currentPasswordInput.trim()) {
      return { success: false, message: "Veuillez saisir votre mot de passe actuel." };
    }
    if (!newPasswordInput || !newPasswordInput.trim()) {
      return { success: false, message: "Le nouveau mot de passe ne peut pas être vide." };
    }
    if (newPasswordInput !== confirmPasswordInput) {
      return { success: false, message: "Le nouveau mot de passe et la confirmation ne correspondent pas." };
    }

    const currentAdmins = adminUsers && adminUsers.length > 0 ? adminUsers : getStoredAdminCredentials();
    const adminDef = currentAdmins.find(a => a.id === roleId);
    if (!adminDef) {
      return { success: false, message: "Compte administrateur introuvable." };
    }

    const expectedCurrentPassword = adminDef.password || adminDef.pin || '';
    if (currentPasswordInput.trim() !== expectedCurrentPassword.trim()) {
      return { success: false, message: "Mot de passe actuel incorrect." };
    }

    const cleanNewPassword = newPasswordInput.trim();
    const updatedAdmins = currentAdmins.map(a =>
      a.id === roleId
        ? { ...a, pin: cleanNewPassword, password: cleanNewPassword }
        : a
    );

    // 1. Mise à jour du state d'authentification local
    setAdminUsers(updatedAdmins);
    saveStoredAdminCredentials(updatedAdmins);

    // 2. Synchronisation en direct avec la collection Firestore (admins, users, admin/credentials)
    try {
      const nowIso = new Date().toISOString();
      const adminPayload = {
        id: roleId,
        roleName: adminDef.roleName,
        loginId: adminDef.loginId || roleId,
        pin: cleanNewPassword,
        password: cleanNewPassword,
        updatedAt: nowIso,
      };

      await Promise.allSettled([
        setDoc(doc(db, 'admins', roleId), adminPayload, { merge: true }),
        setDoc(doc(db, 'users', roleId), adminPayload, { merge: true }),
        setDoc(doc(db, 'admin', 'credentials'), { list: sanitizeFirestore(updatedAdmins) }, { merge: true }),
      ]);
    } catch (err) {
      console.error("Erreur synchronisation Firestore nouveau mot de passe:", err);
    }

    return { success: true, message: "Mot de passe modifié avec succès !" };
  };

  const logout = () => {
    // RÈGLE STRICTE PERSISTANCE DU JETON FCM (LOGOUT / DÉCONNEXION) :
    // Lors de la déconnexion, NE JAMAIS supprimer le jeton fcmToken du navigateur (localStorage)
    // ni du document utilisateur dans Firestore. L'appareil conserve son fcmToken enregistré
    // pour continuer à recevoir les notifications Push même hors session et application fermée.
    setCurrentUser(null);
  };

  // Bascule instantanée In-App entre l'Espace Membre et l'Espace Administration / Département
  const switchWorkspace = (targetView: 'MEMBER' | 'ADMIN', targetRole?: AdminRole) => {
    setCurrentUserState((prev) => {
      if (!prev) return null;

      const memberObj = prev.member || (prev.id ? members.find(m => m.id === prev.id) : undefined);
      const memberId = memberObj?.id || prev.id;
      const defaultMeta = memberId
        ? getDefaultRolesForMember(memberId, memberObj?.firstName, memberObj?.nickname)
        : { roles: ['membre'], departments: [], adminRole: undefined };

      const assignedRole = targetRole || prev.adminRole || memberObj?.assignedRole || defaultMeta.adminRole || 'SDP';

      let updatedUser: CurrentUser;
      if (targetView === 'ADMIN') {
        updatedUser = {
          ...prev,
          type: 'ADMIN',
          activeView: 'ADMIN',
          adminRole: assignedRole,
          member: memberObj,
          id: memberId,
          roles: prev.roles || memberObj?.roles || defaultMeta.roles,
          departments: prev.departments || memberObj?.departments || defaultMeta.departments,
        };
      } else {
        updatedUser = {
          ...prev,
          type: 'MEMBER',
          activeView: 'MEMBER',
          member: memberObj,
          id: memberId,
          roles: prev.roles || memberObj?.roles || defaultMeta.roles,
          departments: prev.departments || memberObj?.departments || defaultMeta.departments,
        };
      }

      try {
        localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify(updatedUser));
      } catch (e) {}

      return updatedUser;
    });
  };

  // Calcul du statut des cotisations
  const getMemberDuesDetail = (memberId: string): MemberDuesDetail => {
    const now = new Date();
    const currentMonthNum = now.getMonth() + 1;

    // Détermine le nombre de mois dus du début de l'année (Janvier 2026) jusqu'au MOIS PRÉCÉDENT le mois actuel.
    // Exemple : En Septembre 2026, les mois dus courent de Janvier à Août = 8 mois (8 * 500 = 4 000 F CFA).
    const totalRequiredMonths = Math.max(0, currentMonthNum - 1);
    const totalExpectedAmount = totalRequiredMonths * 500;

    const isPaymentValidated = (d: any) => {
      if (!d) return false;
      if (d.isHidden || d.status === 'hidden' || d.status === 'deleted' || d.status === 'REJECTED' || d.status === 'rejected') {
        return false;
      }
      const s = String(d.status || '').toLowerCase().trim();
      return (
        d.status === 'validated' ||
        d.status === 'Validé' ||
        d.status === 'approved' ||
        d.status === 'APPROVED' ||
        d.status === 'valide' ||
        d.status === 'approuvé' ||
        d.statut === 'valide' ||
        d.statut === 'approuvé' ||
        d.isValidated === true ||
        d.isApproved === true ||
        s === 'validated' ||
        s === 'validé' ||
        s === 'valide' ||
        s === 'approved' ||
        s === 'approuvé' ||
        s === 'approuve'
      );
    };

    const calculatedPaid = declarations
      .filter(d => 
        String(d.memberId).trim() === String(memberId).trim() && 
        (d.fund === 'COTISATION' || (d as any).caisse === 'Cotisation Mensuelle' || (d as any).type === 'Cotisation Mensuelle') && 
        isPaymentValidated(d)
      )
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

    const memberDoc = members.find(m => String(m.id).trim() === String(memberId).trim());
    const memberStoredTotalPaid = typeof memberDoc?.totalPaid === 'number' ? memberDoc.totalPaid : (typeof memberDoc?.solde === 'number' ? memberDoc.solde : 0);
    const totalPaid = Math.max(calculatedPaid, memberStoredTotalPaid);

    const monthsPaid = Math.floor(totalPaid / 500);
    const unpaidMonths = memberDoc?.unpaidMonths !== undefined && memberDoc.unpaidMonths >= 0 && memberStoredTotalPaid >= calculatedPaid
      ? memberDoc.unpaidMonths
      : Math.max(0, totalRequiredMonths - monthsPaid);

    let status: DuesStatus = 'RETARD';
    if (totalPaid > totalExpectedAmount) {
      status = 'EN_AVANCE';
    } else if (totalPaid >= totalExpectedAmount && (totalPaid > 0 || totalExpectedAmount === 0)) {
      status = 'A_JOUR';
    } else {
      status = 'RETARD';
    }

    return {
      status,
      unpaidMonths: status === 'RETARD' ? (unpaidMonths > 0 ? unpaidMonths : 1) : 0,
      totalPaid,
      totalExpected: totalExpectedAmount,
    };
  };

  const getMemberDuesStatus = (memberId: string): DuesStatus => {
    return getMemberDuesDetail(memberId).status;
  };

  const getActiveFinancialEvent = (fund: 'LOISIRS' | 'CAS_SOCIAUX'): FinancialEvent | undefined => {
    return financialEvents.find(e => e.fund === fund && e.status === 'PUBLISHED');
  };

  const getActiveAgrProject = (): AgrProject | undefined => {
    return projects.find(p => p.status === 'PUBLISHED');
  };

  const getRequiredAmountForRubric = (fund: FundType, subCategory?: string): number => {
    switch (fund) {
      case 'ANNIVERSAIRE':
        return 10000;
      case 'SOIREE_ROUAMA': {
        const soireeActs = activities.filter(a => a.status === 'PUBLISHED' && (a.fixedType === 'SOIREE_ROUAMA' || a.title?.toLowerCase().includes('soirée') || a.title?.toLowerCase().includes('soiree')));
        if (subCategory) {
          const specific = soireeActs.find(a => a.id === subCategory || a.title === subCategory);
          if (specific) {
            return specific.budget && specific.budget > 0 ? Math.round(specific.budget / (members.length || 12)) : 10000;
          }
        }
        const soireeAct = soireeActs[0];
        if (soireeAct) {
          return soireeAct.budget && soireeAct.budget > 0 ? Math.round(soireeAct.budget / (members.length || 12)) : 10000;
        }
        return 0; // Si aucune soirée publiée, la rubrique est inactive (montant 0)
      }
      case 'LOISIRS': {
        const activeEvts = financialEvents.filter(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
        if (subCategory) {
          const specific = activeEvts.find(e => e.id === subCategory || e.title === subCategory || e.subCategory === subCategory);
          if (specific) return specific.requiredAmountPerMember;
        }
        const activeEvt = activeEvts[0];
        return activeEvt ? activeEvt.requiredAmountPerMember : 0;
      }
      case 'CAS_SOCIAUX': {
        const activeEvts = financialEvents.filter(e => e.fund === 'CAS_SOCIAUX' && e.status === 'PUBLISHED');
        if (subCategory) {
          const specific = activeEvts.find(e => e.id === subCategory || e.subCategory === subCategory || e.title === subCategory);
          if (specific) return specific.requiredAmountPerMember;
        }
        const activeEvt = activeEvts[0];
        return activeEvt ? activeEvt.requiredAmountPerMember : 0;
      }
      case 'COTISATION': {
        const now = new Date();
        const currentMonthNum = now.getMonth() + 1; // 1-12
        // Détermine le nombre de mois dus du début de l'année (Janvier 2026) jusqu'au MOIS PRÉCÉDENT le mois actuel.
        // Exemple : En Septembre 2026, les mois dus courent de Janvier à Août = 8 mois (8 * 500 = 4 000 F CFA).
        const nbMoisDus = Math.max(0, currentMonthNum - 1);
        return nbMoisDus * 500;
      }
      case 'AGR': {
        const activeProjs = projects.filter(p => p.status === 'PUBLISHED' || p.status === 'active');
        if (subCategory) {
          const specific = activeProjs.find(p => p.id === subCategory || p.title === subCategory);
          if (specific) return specific.requiredAmountPerMember || 0;
        }
        const activeProj = activeProjs[0];
        return activeProj ? (activeProj.requiredAmountPerMember || 0) : 0;
      }
      default:
        return 0;
    }
  };

  const getMemberRubricProgress = (
    memberId: string,
    fund: FundType,
    subCategory?: string,
    overrideRequiredAmount?: number,
    overrideTitle?: string
  ): MemberRubricProgress => {
    const totalRequired = overrideRequiredAmount !== undefined ? overrideRequiredAmount : getRequiredAmountForRubric(fund, subCategory);

    const memberDecls = declarations.filter(d => {
      if (d.memberId !== memberId || d.fund !== fund) return false;
      if (subCategory && d.subCategory) {
        if (d.subCategory !== subCategory && !d.subCategory.includes(subCategory) && !subCategory.includes(d.subCategory)) {
          return false;
        }
      }
      return true;
    });

    const isProgressValidated = (d: any) => {
      if (!d) return false;
      if (d.isHidden || d.status === 'hidden' || d.status === 'deleted' || d.status === 'REJECTED' || d.status === 'rejected') {
        return false;
      }
      const s = String(d.status || '').toLowerCase().trim();
      return (
        d.status === 'validated' ||
        d.status === 'Validé' ||
        d.status === 'approved' ||
        d.status === 'APPROVED' ||
        d.isValidated === true ||
        s === 'validated' ||
        s === 'validé' ||
        s === 'valide' ||
        s === 'approved'
      );
    };

    const totalAdvanced = memberDecls
      .filter(d => isProgressValidated(d))
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

    const pendingAmount = memberDecls
      .filter(d => !isProgressValidated(d) && !d.isHidden && d.status !== 'rejected' && d.status !== 'REJECTED' && d.status !== 'deleted' && d.status !== 'hidden')
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

    const remainingDue = totalRequired > 0 ? Math.max(0, totalRequired - totalAdvanced) : 0;

    let status: 'SOLDE' | 'EN_COURS' | 'NON_ENTAME' = 'NON_ENTAME';
    if (totalRequired > 0 && totalAdvanced >= totalRequired) {
      status = 'SOLDE';
    } else if (totalAdvanced > 0) {
      status = 'EN_COURS';
    } else {
      status = 'NON_ENTAME';
    }

    let title = overrideTitle || FUND_LABELS[fund];
    if (!overrideTitle) {
      if (fund === 'CAS_SOCIAUX') {
        const activeEvts = financialEvents.filter(e => e.fund === 'CAS_SOCIAUX' && e.status === 'PUBLISHED');
        const specific = subCategory ? activeEvts.find(e => e.id === subCategory || e.subCategory === subCategory || e.title === subCategory) : activeEvts[0];
        if (specific) {
          title = specific.title;
        } else if (subCategory) {
          title = `Cas Social (${subCategory})`;
        }
      } else if (fund === 'LOISIRS') {
        const activeEvts = financialEvents.filter(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
        const specific = subCategory ? activeEvts.find(e => e.id === subCategory || e.title === subCategory) : activeEvts[0];
        if (specific) {
          title = specific.title;
        }
      } else if (fund === 'SOIREE_ROUAMA') {
        const soireeActs = activities.filter(a => a.status === 'PUBLISHED' && (a.fixedType === 'SOIREE_ROUAMA' || a.title?.toLowerCase().includes('soirée') || a.title?.toLowerCase().includes('soiree')));
        const specific = subCategory ? soireeActs.find(a => a.id === subCategory || a.title === subCategory) : soireeActs[0];
        if (specific) {
          title = specific.title;
        }
      } else if (fund === 'AGR') {
        const activeProjs = projects.filter(p => p.status === 'PUBLISHED');
        const specific = subCategory ? activeProjs.find(p => p.id === subCategory || p.title === subCategory) : activeProjs[0];
        if (specific) {
          title = specific.title;
        }
      }
    }

    return {
      fund,
      subCategory,
      title,
      totalRequired,
      totalAdvanced,
      pendingAmount,
      remainingDue,
      status,
      history: [...memberDecls].sort((a, b) => b.id.localeCompare(a.id)),
    };
  };

  const getAllMembersRubricSummary = (
    fund: FundType,
    subCategory?: string,
    overrideRequiredAmount?: number,
    overrideTitle?: string
  ) => {
    const list = members.map(m => {
      const progress = getMemberRubricProgress(m.id, fund, subCategory, overrideRequiredAmount, overrideTitle);
      return {
        member: m,
        progress,
        totalRequired: progress.totalRequired,
        totalAdvanced: progress.totalAdvanced,
        remainingDue: progress.remainingDue,
        status: progress.status,
        history: progress.history,
      };
    });

    const totalRequired = list.reduce((s, item) => s + item.totalRequired, 0);
    const totalAdvanced = list.reduce((s, item) => s + item.totalAdvanced, 0);
    const totalRemaining = list.reduce((s, item) => s + item.remainingDue, 0);
    const completionPercentage =
      totalRequired > 0 ? Math.min(100, Math.round((totalAdvanced / totalRequired) * 100)) : 100;
    const settledCount = list.filter(item => item.status === 'SOLDE').length;
    const partialCount = list.filter(item => item.status === 'EN_COURS').length;
    const notStartedCount = list.filter(item => item.status === 'NON_ENTAME').length;

    return {
      totalRequired,
      totalAdvanced,
      totalRemaining,
      completionPercentage,
      settledCount,
      partialCount,
      notStartedCount,
      membersSummary: list,
    };
  };

  // =========================================================================
  // ACTIONS DE PAIEMENT & REÇUS (Synchronisées sur Firebase Firestore)
  // =========================================================================

  // 1. Déclarer un versement (Envoyé par un membre, écrit DIRECTEMENT dans Firestore collection 'receipts')
  const declarePayment = async (
    fund: FundType,
    amount: number,
    reference: string,
    month?: string,
    paymentType?: 'TOTAL' | 'TRANCHE',
    subCategory?: string,
    receiptImage?: string
  ): Promise<{ success: boolean; message: string }> => {
    let activeMember = currentUser?.member;
    if (!activeMember && currentUser?.type === 'ADMIN') {
      activeMember = members.find(m => m.assignedRole === currentUser.adminRole) || members.find(m => m.id === '1') || members[0];
    }

    if (!activeMember) {
      return { success: false, message: 'Vous devez être connecté en tant que membre.' };
    }

    let isFull = false;

    if (fund === 'COTISATION') {
      if (amount < 500) {
        return {
          success: false,
          message: 'Le montant minimum de cotisation mensuelle est de 500 F CFA.'
        };
      }
      isFull = true;
    } else {
      const currentProgress = getMemberRubricProgress(activeMember.id, fund, subCategory);
      if (fund !== 'ANNIVERSAIRE' && currentProgress.totalRequired === 0) {
        return {
          success: false,
          message: "Cette rubrique n'a actuellement aucun événement ou projet actif ouvert aux cotisations."
        };
      }

      const minAllowed = (currentProgress.remainingDue > 0 && currentProgress.remainingDue < 1000)
        ? currentProgress.remainingDue
        : 1000;

      if (amount < minAllowed) {
        return {
          success: false,
          message: `Pour cette cotisation, le montant minimum autorisé par tranche est de ${minAllowed.toLocaleString('fr-FR')} F CFA.`
        };
      }

      isFull = paymentType === 'TOTAL' || (currentProgress.remainingDue > 0 && amount >= currentProgress.remainingDue);
    }

    if (!reference || reference.trim().length === 0) {
      return { success: false, message: 'Veuillez joindre la photo du reçu ou indiquer la référence de paiement Wave / Mobile Money.' };
    }

    const currentMonthStr = month || new Date().toISOString().substring(0, 7);

    const rawReceiptImage = receiptImage || (
      typeof reference === 'string' && (
        reference.startsWith('data:image/') ||
        reference.startsWith('http://') ||
        reference.startsWith('https://') ||
        reference.startsWith('blob:') ||
        reference.startsWith('/9j/') ||
        reference.startsWith('iVBORw0KGgo') ||
        reference.startsWith('R0lGOD') ||
        reference.startsWith('UklGR')
      ) ? (
        reference.startsWith('data:') || reference.startsWith('http') || reference.startsWith('blob')
          ? reference
          : reference.startsWith('/9j/') ? `data:image/jpeg;base64,${reference}`
          : reference.startsWith('iVBORw0KGgo') ? `data:image/png;base64,${reference}`
          : reference.startsWith('R0lGOD') ? `data:image/gif;base64,${reference}`
          : `data:image/webp;base64,${reference}`
      ) : undefined
    );

    // Redimensionnement automatique de l'image (Canvas max 600px, qualité 0.5) pour respecter strictement la limite Firestore
    let resolvedReceiptImage: string | undefined = undefined;
    if (rawReceiptImage) {
      resolvedReceiptImage = await compressReceiptImage(rawReceiptImage, 600, 0.5);
    }

    const cleanRef = typeof reference === 'string' && reference.startsWith('data:')
      ? 'Capture de reçu Wave'
      : reference.trim();

    const newDeclData: Omit<PaymentDeclaration, 'id'> = {
      memberId: activeMember.id,
      memberName: activeMember.firstName,
      memberNickname: activeMember.nickname,
      fund,
      amount,
      reference: cleanRef,
      month: currentMonthStr,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: 'en_attente',
      statut: 'en_attente',
      statutDemande: 'en_attente',
      paymentType: isFull ? 'TOTAL' : 'TRANCHE',
      subCategory,
      receiptImage: resolvedReceiptImage,
      createdAt: Date.now(),
    } as any;

    try {
      // 1. Écriture DIRECTE et EXCLUSIVE dans Firestore via addDoc (aucun localStorage utilisé)
      const docRef = await addDoc(collection(db, 'receipts'), sanitizeFirestore(newDeclData));
      await updateDoc(docRef, { id: docRef.id });

      // Synchronisation dans les sous-collections cotisations et declarations
      const fullDocData = { ...newDeclData, id: docRef.id };
      await Promise.allSettled([
        setDoc(doc(db, 'users', String(activeMember.id), 'cotisations', docRef.id), sanitizeFirestore(fullDocData), { merge: true }),
        setDoc(doc(db, 'members', String(activeMember.id), 'cotisations', docRef.id), sanitizeFirestore(fullDocData), { merge: true }),
        setDoc(doc(db, 'declarations', docRef.id), sanitizeFirestore(fullDocData), { merge: true }),
      ]);

      const displayCategory = fund === 'COTISATION'
        ? (amount >= 500 && amount % 500 === 0
            ? `Cotisation Mensuelle (${Math.floor(amount / 500)} mois)`
            : `Cotisation Mensuelle (${amount.toLocaleString('fr-FR')} F)`)
        : isFull
        ? 'Règlement Totalité'
        : 'Acompte par tranche';

      // Notification Push FCM (Événement 1 : Soumission de cotisation) -> Trésorier Leger (role: 'tresorerie')
      dispatchPushNotification({
        title: 'E-ROUAMA - Trésorerie',
        body: `Nouvelle demande de cotisation reçue de ${activeMember.nickname || activeMember.firstName}.`,
        senderRole: 'MEMBRE',
        senderName: activeMember.nickname || activeMember.firstName,
        targetRole: 'TRESORIER',
        targetDepartment: 'tresorerie',
        targetUserId: '11',
        type: 'PAYMENT',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);

      return {
        success: true,
        message: `Reçu (${displayCategory} de ${amount.toLocaleString('fr-FR')} F CFA) transmis en direct sur Firebase au Trésorier pour validation.`
      };
    } catch (err: any) {
      console.error('Erreur Firebase receipts addDoc declarePayment:', err);
      return {
        success: false,
        message: `Erreur d'enregistrement sur Firestore : ${err?.message || 'Vérifiez votre connexion internet'}`
      };
    }
  };

  // Raccourci explicite submitReceipt demandé par la directive
  const submitReceipt = async (receiptData: {
    fund: FundType;
    amount: number;
    reference: string;
    receiptImage?: string;
    month?: string;
    paymentType?: 'TOTAL' | 'TRANCHE';
    subCategory?: string;
  }) => {
    return declarePayment(
      receiptData.fund,
      receiptData.amount,
      receiptData.reference,
      receiptData.month,
      receiptData.paymentType,
      receiptData.subCategory,
      receiptData.receiptImage
    );
  };

  // 2. Valider le reçu (Trésorier -> Met à jour Firestore, recalcule le solde membre et notifie)
  const approvePayment = async (declarationId: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();

    let targetDecl = declarations.find((d) => d.id === targetId);
    if (!targetDecl) {
      try {
        const [rSnap, pSnap, dSnap] = await Promise.all([
          getDoc(doc(db, 'receipts', targetId)),
          getDoc(doc(db, 'payments', targetId)),
          getDoc(doc(db, 'declarations', targetId)),
        ]);
        if (rSnap.exists()) targetDecl = { id: targetId, ...(rSnap.data() as any) };
        else if (pSnap.exists()) targetDecl = { id: targetId, ...(pSnap.data() as any) };
        else if (dSnap.exists()) targetDecl = { id: targetId, ...(dSnap.data() as any) };
      } catch (fetchErr) {
        console.warn('Recherche directe doc Firestore:', fetchErr);
      }
    }
    if (!targetDecl) return;

    let normalizedType = (targetDecl as any).type;
    let normalizedCaisse = (targetDecl as any).caisse;
    if (!normalizedType && !normalizedCaisse && targetDecl.fund) {
      if (targetDecl.fund === 'COTISATION') {
        normalizedType = 'Cotisation Mensuelle';
        normalizedCaisse = 'Cotisation Mensuelle';
      } else if (targetDecl.fund === 'ANNIVERSAIRE') {
        normalizedType = 'Anniversaire';
        normalizedCaisse = 'Anniversaire';
      } else if (targetDecl.fund === 'LOISIRS') {
        normalizedType = 'Sorties & Loisirs';
        normalizedCaisse = 'Sorties & Loisirs';
      } else if (targetDecl.fund === 'AGR') {
        normalizedType = 'Projets AGR';
        normalizedCaisse = 'Projets AGR';
      } else if (targetDecl.fund === 'CAS_SOCIAUX') {
        normalizedType = 'Cas Sociaux';
        normalizedCaisse = 'Cas Sociaux';
      }
    }

    // EXIGENCE 1 : MISE À JOUR SYNCHRONE DU STATUT (de 'en_attente' à 'valide' / 'approuvé')
    const validationPayload = {
      status: 'valide',
      statut: 'valide',
      statutDemande: 'valide',
      statusLabel: 'Validé',
      isValidated: true,
      isApproved: true,
      validatedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };

    const payerId = String(targetDecl.memberId).trim();
    const amountVal = Number(targetDecl.amount) || Number((targetDecl as any).montant) || 0;

    const fullDeclPayload = {
      ...targetDecl,
      id: targetId,
      type: normalizedType || (targetDecl as any).type || 'Cotisation Mensuelle',
      caisse: normalizedCaisse || (targetDecl as any).caisse || 'Cotisation Mensuelle',
      ...validationPayload,
    };

    // 1. Enregistrement direct et persistant dans 'payments', 'receipts', 'declarations' et sous-collections
    try {
      await Promise.allSettled([
        setDoc(doc(db, 'payments', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'receipts', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'declarations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'users', payerId, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'members', payerId, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
      ]);
    } catch (err) {
      console.warn('Erreur setDoc synchronisation documents approvePayment:', err);
    }

    // Mise à jour immédiate du state React pour les déclarations côté interface
    setDeclarations((prev) => {
      const exists = prev.some((d) => d.id === targetId);
      if (exists) {
        return prev.map((d) => (d.id === targetId ? { ...d, ...fullDeclPayload } : d));
      }
      return [fullDeclPayload as any, ...prev];
    });

    // 2. Créditer la caisse sur Firestore (CONSERVATION STRICTE DE LA LOGIQUE)
    const updatedFundBalances = {
      ...fundBalances,
      [targetDecl.fund]: (fundBalances[targetDecl.fund] || 0) + amountVal,
    };
    await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedFundBalances), { merge: true }).catch(console.warn);
    setFundBalances(updatedFundBalances);

    // 3. Enregistrer la transaction sur Firestore via addDoc (ID unique généré par Firestore)
    const displayRef =
      typeof targetDecl.reference === 'string' && targetDecl.reference.startsWith('data:')
        ? 'Capture de reçu'
        : targetDecl.reference || 'Preuve validée';

    try {
      const txRef = await addDoc(collection(db, 'transactions'), sanitizeFirestore({
        type: 'DEPOT',
        fund: targetDecl.fund,
        amount: amountVal,
        description: `Dépôt validé (${FUND_LABELS[targetDecl.fund] || targetDecl.fund}) par ${targetDecl.memberNickname} - Réf: ${displayRef}`,
        memberNickname: targetDecl.memberNickname,
        date: new Date().toLocaleDateString('fr-FR'),
        createdBy: 'TRÉSORIER',
        createdAt: Date.now(),
      }));
      await updateDoc(txRef, { id: txRef.id }).catch(() => {});
    } catch (txErr) {
      console.warn('Erreur addDoc transaction:', txErr);
    }

    // 4. Déclencher l'alerte fraternelle Cerveau (Imputation chronologique stricte et exclusion de l'auteur)
    try {
      const payerMember = members.find((m) => String(m.id).trim() === payerId);
      const memberName = targetDecl.memberNickname || payerMember?.nickname || targetDecl.memberName || payerMember?.firstName || 'Un membre';

      if (targetDecl.fund === 'COTISATION') {
        const nbMoisPayes = Math.max(1, Math.floor(amountVal / 500));

        const previousTotalPaid = declarations
          .filter((d) => 
            String(d.memberId).trim() === payerId && 
            d.fund === 'COTISATION' && 
            !d.isHidden && 
            d.status !== 'deleted' && 
            d.status !== 'hidden' &&
            (
              d.status === 'validated' || 
              d.status === 'Validé' || 
              d.status === 'approved' || 
              d.status === 'APPROVED' || 
              d.status === 'valide' ||
              d.status === 'approuvé' ||
              (d as any).isValidated === true ||
              String(d.status || '').toLowerCase().trim() === 'validated' ||
              String(d.status || '').toLowerCase().trim() === 'approved' ||
              String(d.status || '').toLowerCase().trim() === 'validé' ||
              String(d.status || '').toLowerCase().trim() === 'valide'
            ) && 
            d.id !== targetId
          )
          .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

        const previousMonthsPaid = Math.floor(previousTotalPaid / 500);

        const startYear = 2026;
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];

        const getMonthFormatted = (idx: number) => {
          const y = startYear + Math.floor(idx / 12);
          const m = idx % 12;
          return `${monthNames[m]} ${y}`;
        };

        const startMonthIdx = previousMonthsPaid;
        const endMonthIdx = previousMonthsPaid + nbMoisPayes - 1;
        const startMonthName = getMonthFormatted(startMonthIdx);
        const endMonthName = getMonthFormatted(endMonthIdx);

        const periodeCouverte = nbMoisPayes === 1 ? startMonthName : `${startMonthName} à ${endMonthName}`;
        const alertText = `${memberName} vient de s'acquitter de sa cotisation pour la période de ${periodeCouverte} (${nbMoisPayes} mois). Bravo pour l'engagement fraternel !`;

        broadcastCerveauAlert(
          memberName,
          alertText,
          'APP',
          payerId
        );
      } else {
        const fundLabel = FUND_LABELS[targetDecl.fund] || targetDecl.fund;
        const sub = targetDecl.subCategory ? ` (${targetDecl.subCategory})` : '';
        const alertText = `${memberName} vient d'effectuer un versement de ${targetDecl.amount.toLocaleString('fr-FR')} F CFA pour ${fundLabel}${sub}. Bravo pour l'engagement fraternel !`;

        broadcastCerveauAlert(
          memberName,
          alertText,
          'APP',
          payerId
        );
      }
    } catch (e) {
      console.warn('Alerte Cerveau non émise:', e);
    }

    // 5. RECALCUL ET MISE À JOUR SYNCHRONE DU SOLDE INDIVIDUEL DU MEMBRE
    let allPaidCotisations = 0;
    let resteApresValidation = 0;
    let duesStatus: DuesStatus = 'RETARD';
    let unpaidMonths = 0;

    try {
      const now = new Date();
      const currentMonthNum = now.getMonth() + 1;
      const totalRequiredMonths = Math.max(0, currentMonthNum - 1);
      const totalExpectedAmount = totalRequiredMonths * 500;

      const isPaymentValid = (d: any) => {
        if (!d) return false;
        if (d.isHidden || d.status === 'hidden' || d.status === 'deleted' || d.status === 'REJECTED' || d.status === 'rejected') return false;
        const s = String(d.status || '').toLowerCase().trim();
        return (
          d.status === 'validated' ||
          d.status === 'Validé' ||
          d.status === 'approved' ||
          d.status === 'APPROVED' ||
          d.status === 'valide' ||
          d.status === 'approuvé' ||
          d.statut === 'valide' ||
          d.statut === 'approuvé' ||
          d.isValidated === true ||
          d.isApproved === true ||
          s === 'validated' ||
          s === 'validé' ||
          s === 'valide' ||
          s === 'approved' ||
          s === 'approuvé' ||
          s === 'approuve'
        );
      };

      const isCotisationFund = (d: any) =>
        d.fund === 'COTISATION' ||
        (d as any).caisse === 'Cotisation Mensuelle' ||
        (d as any).type === 'Cotisation Mensuelle';

      allPaidCotisations = declarations
        .filter((d) => 
          String(d.memberId).trim() === payerId && 
          isCotisationFund(d) &&
          (isPaymentValid(d) || d.id === targetId)
        )
        .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

      // Si targetDecl est une cotisation et n'était pas compté ci-dessus
      if (isCotisationFund(targetDecl) && allPaidCotisations === 0) {
        allPaidCotisations = amountVal;
      }

      const monthsPaid = Math.floor(allPaidCotisations / 500);
      unpaidMonths = Math.max(0, totalRequiredMonths - monthsPaid);
      resteApresValidation = Math.max(0, totalExpectedAmount - allPaidCotisations);
      duesStatus = allPaidCotisations > totalExpectedAmount ? 'EN_AVANCE' : (allPaidCotisations >= totalExpectedAmount && (allPaidCotisations > 0 || totalExpectedAmount === 0) ? 'A_JOUR' : 'RETARD');

      const memberBalanceUpdate = {
        resteADevoir: resteApresValidation,
        solde: allPaidCotisations,
        totalPaid: allPaidCotisations,
        montantPaye: allPaidCotisations,
        unpaidMonths: unpaidMonths,
        moisRetard: unpaidMonths,
        duesStatus: duesStatus,
        statutCotisation: duesStatus,
        statutDemande: 'valide',
        dernierPaiementId: targetId,
        derniereValidation: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ÉCRITURE SYNCHRONE DANS 'users', 'members' ET SOUS-COLLECTION 'cotisations'
      await Promise.allSettled([
        setDoc(doc(db, 'users', payerId), memberBalanceUpdate, { merge: true }),
        setDoc(doc(db, 'members', payerId), memberBalanceUpdate, { merge: true }),
        setDoc(doc(db, 'users', payerId, 'cotisations', 'summary'), memberBalanceUpdate, { merge: true }),
        setDoc(doc(db, 'members', payerId, 'cotisations', 'summary'), memberBalanceUpdate, { merge: true }),
      ]);

      // Mise à jour immédiate du state React
      setMembers((prev) =>
        prev.map((m) => (String(m.id).trim() === payerId ? { ...m, ...memberBalanceUpdate } : m))
      );

      setCurrentUser((prev) => {
        if (prev && prev.type === 'MEMBER' && prev.member && String(prev.member.id).trim() === payerId) {
          const updatedMember = {
            ...prev.member,
            ...memberBalanceUpdate,
          };
          try {
            localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify({ ...prev, member: updatedMember }));
            localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
          } catch (e) {}
          return {
            ...prev,
            member: updatedMember,
          };
        }
        return prev;
      });
    } catch (recalcErr) {
      console.warn('Erreur mise à jour resteADevoir et solde:', recalcErr);
    }

    // 6. NOTIFICATIONS PUSH FCM CIBLÉES VERS LE fcmToken DU MEMBRE (DÈS CONFIRMATION ÉCRITURE)
    try {
      const payerMember = members.find((m) => String(m.id).trim() === payerId);
      const targetFcmToken = payerMember?.fcmToken || payerMember?.fcmTokens?.[0];
      const targetFcmTokens = payerMember?.fcmTokens || (targetFcmToken ? [targetFcmToken] : []);
      const memberNickname = targetDecl.memberNickname || payerMember?.nickname || targetDecl.memberName || 'Un membre';

      // Destinataire 1 (Membre concerné) : "✅ Cotisation validée !"
      await dispatchPushNotification({
        title: '✅ Cotisation validée !',
        body: `Votre reçu de cotisation de ${amountVal.toLocaleString('fr-FR')} F CFA a été validé avec succès par la Trésorerie. Votre solde a été mis à jour (${duesStatus === 'A_JOUR' ? 'À jour' : duesStatus === 'EN_AVANCE' ? 'En avance' : `${unpaidMonths} mois de retard`}).`,
        senderRole: 'TRESORIER',
        senderName: 'Léger (Trésorier)',
        targetUserId: payerId,
        fcmToken: targetFcmToken,
        fcmTokens: targetFcmTokens,
        type: 'PAYMENT',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
        metadata: {
          paymentId: targetId,
          amount: amountVal,
          fund: targetDecl.fund,
          resteADevoir: resteApresValidation,
          duesStatus: duesStatus,
        },
      });

      // Destinataire 2 (TOUS LES MEMBRES) : "🎉 Nouveau Gbrairai disponible !"
      dispatchPushNotification({
        title: '🎉 Nouveau Gbrairai disponible !',
        body: `Un versement de ${memberNickname} vient d'être validé par la Trésorerie. Bravo pour l'engagement fraternel !`,
        senderRole: 'TRESORIER',
        senderName: 'Léger (Trésorier)',
        targetRole: 'ALL',
        type: 'PAYMENT',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
    } catch (notifErr) {
      console.warn('Erreur notification validation paiement:', notifErr);
    }
  };

  // Alias validateCotisation pour compatibilité exacte avec l'exigence
  const validateCotisation = approvePayment;

  // Fonction de synchronisation / correction automatique du profil membre
  const syncMemberProfileCotisation = async (memberId: string) => {
    if (!memberId) return;
    const cleanId = String(memberId).trim();
    try {
      const now = new Date();
      const currentMonthNum = now.getMonth() + 1;
      const totalRequiredMonths = Math.max(0, currentMonthNum - 1);
      const totalExpectedAmount = totalRequiredMonths * 500;

      const isPaymentValid = (d: any) => {
        if (!d) return false;
        if (d.isHidden || d.status === 'hidden' || d.status === 'deleted' || d.status === 'REJECTED' || d.status === 'rejected') return false;
        const s = String(d.status || '').toLowerCase().trim();
        return (
          d.status === 'validated' ||
          d.status === 'Validé' ||
          d.status === 'approved' ||
          d.status === 'APPROVED' ||
          d.status === 'valide' ||
          d.status === 'approuvé' ||
          d.statut === 'valide' ||
          d.statut === 'approuvé' ||
          d.isValidated === true ||
          d.isApproved === true ||
          s === 'validated' ||
          s === 'validé' ||
          s === 'valide' ||
          s === 'approved' ||
          s === 'approuvé' ||
          s === 'approuve'
        );
      };

      const isCotisation = (d: any) =>
        d.fund === 'COTISATION' ||
        (d as any).caisse === 'Cotisation Mensuelle' ||
        (d as any).type === 'Cotisation Mensuelle';

      const validList = declarations.filter(
        (d) => String(d.memberId).trim() === cleanId && isCotisation(d) && isPaymentValid(d)
      );

      const totalPaid = validList.reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);
      const monthsPaid = Math.floor(totalPaid / 500);
      const unpaidMonths = Math.max(0, totalRequiredMonths - monthsPaid);
      const resteADevoir = Math.max(0, totalExpectedAmount - totalPaid);
      const duesStatus: DuesStatus =
        totalPaid > totalExpectedAmount
          ? 'EN_AVANCE'
          : totalPaid >= totalExpectedAmount && (totalPaid > 0 || totalExpectedAmount === 0)
          ? 'A_JOUR'
          : 'RETARD';

      const updateData = {
        totalPaid,
        solde: totalPaid,
        montantPaye: totalPaid,
        unpaidMonths,
        moisRetard: unpaidMonths,
        resteADevoir,
        duesStatus,
        statutCotisation: duesStatus,
        statutDemande: 'valide',
        updatedAt: new Date().toISOString(),
      };

      await Promise.allSettled([
        setDoc(doc(db, 'users', cleanId), updateData, { merge: true }),
        setDoc(doc(db, 'members', cleanId), updateData, { merge: true }),
        setDoc(doc(db, 'users', cleanId, 'cotisations', 'summary'), updateData, { merge: true }),
        setDoc(doc(db, 'members', cleanId, 'cotisations', 'summary'), updateData, { merge: true }),
      ]);

      setMembers((prev) =>
        prev.map((m) => (String(m.id).trim() === cleanId ? { ...m, ...updateData } : m))
      );

      setCurrentUser((prev) => {
        if (prev && prev.type === 'MEMBER' && prev.member && String(prev.member.id).trim() === cleanId) {
          const updatedMember = { ...prev.member, ...updateData };
          try {
            localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify({ ...prev, member: updatedMember }));
            localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
          } catch (e) {}
          return { ...prev, member: updatedMember };
        }
        return prev;
      });
    } catch (err) {
      console.warn('Erreur syncMemberProfileCotisation:', err);
    }
  };

  // 3. Rejeter le reçu (Trésorier -> Met à jour Firestore via updateDoc avec motif)
  const rejectPayment = async (declarationId: string, reason?: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();
    const finalReason = reason?.trim() || 'Reçu non conforme ou rejeté par le Trésorier';

    // Mettre à jour sur Firestore dans 'receipts' via updateDoc
    try {
      await updateDoc(doc(db, 'receipts', targetId), {
        status: 'REJECTED',
        rejectionReason: finalReason,
      });
    } catch (err) {
      console.warn('Fallback setDoc pour receipts rejectPayment:', err);
      await setDoc(
        doc(db, 'receipts', targetId),
        { status: 'REJECTED', rejectionReason: finalReason },
        { merge: true }
      );
    }

    // NOTIFICATIONS PUSH FCM (ÉVÉNEMENT 2B : REJET PAIEMENT -> UNIQUEMENT LE MEMBRE CONCERNÉ)
    try {
      const targetDecl = declarations.find(d => d.id === targetId);
      const payerId = targetDecl?.memberId;
      if (payerId) {
        dispatchPushNotification({
          title: '❌ Cotisation rejetée',
          body: 'Votre reçu de cotisation a été refusé par la Trésorerie.',
          senderRole: 'TRESORIER',
          senderName: 'Léger (Trésorier)',
          targetUserId: payerId,
          type: 'PAYMENT',
          rawTitle: true,
          priority: 'high',
          sound: 'default',
          requireInteraction: true,
          url: '/',
        }).catch(console.warn);
      }
    } catch (rejectNotifErr) {
      console.warn('Erreur notification rejet paiement:', rejectNotifErr);
    }
  };

  // 4a. Masquer définitivement un reçu/déclaration sur Firestore (Trésorier & Membre)
  const hideReceipt = async (declarationId: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();
    // Retrait immédiat de l'affichage local (React State)
    setDeclarations(prev =>
      prev.filter(p => {
        const pId = p.id || (p as any)._id || (p as any).docId;
        return pId !== targetId;
      })
    );

    // Traitement Firestore en arrière-plan
    try {
      await deleteDoc(doc(db, 'payments', targetId));
    } catch (e) {
      try {
        await updateDoc(doc(db, 'payments', targetId), { status: 'deleted', isHidden: true });
      } catch (err) {}
    }
    try {
      await deleteDoc(doc(db, 'receipts', targetId));
    } catch (e) {
      try {
        await updateDoc(doc(db, 'receipts', targetId), { status: 'deleted', isHidden: true });
      } catch (err) {}
    }
    try {
      await deleteDoc(doc(db, 'declarations', targetId));
    } catch (e) {
      try {
        await updateDoc(doc(db, 'declarations', targetId), { status: 'deleted', isHidden: true });
      } catch (err) {}
    }
  };

  // 4b. Supprimer un reçu/déclaration définitivement sur Firestore via deleteDoc (Trésorier & Membre)
  const deleteReceipt = async (declarationId: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();
    // 3. Mise à jour synchrone immédiate pour retirer la ligne instantanément de l'affichage local
    setDeclarations(prev => prev.filter(d => (d.id || (d as any)._id || (d as any).docId) !== targetId && d.status !== 'deleted'));
    setTransactions(prev => prev.filter(t => (t.id || (t as any)._id || (t as any).docId) !== targetId));

    try {
      // 1. Double action : status = 'deleted' pour sécuriser l'exclusion immédiate
      const updateData = { status: 'deleted', deletedAt: new Date() };
      await updateDoc(doc(db, 'receipts', targetId), updateData).catch(async () => {
        await setDoc(doc(db, 'receipts', targetId), updateData, { merge: true }).catch(() => {});
      });
      await updateDoc(doc(db, 'payments', targetId), updateData).catch(async () => {
        await setDoc(doc(db, 'payments', targetId), updateData, { merge: true }).catch(() => {});
      });
      await updateDoc(doc(db, 'declarations', targetId), updateData).catch(async () => {
        await setDoc(doc(db, 'declarations', targetId), updateData, { merge: true }).catch(() => {});
      });

      // 2. Suppression brute en parallèle dans un bloc try/catch séparé
      try {
        await Promise.allSettled([
          deleteDoc(doc(db, 'receipts', targetId)),
          deleteDoc(doc(db, 'payments', targetId)),
          deleteDoc(doc(db, 'declarations', targetId)),
          deleteDoc(doc(db, 'transactions', targetId)),
        ]);
      } catch (delErr) {
        console.warn('Suppression brute ignorée:', delErr);
      }
    } catch (err) {
      console.error('Erreur deleteReceipt Firestore:', err);
    }
  };

  // 5. Supprimer une transaction comptable définitivement sur Firestore
  const deleteTransaction = async (txId: string) => {
    if (!txId) return;
    const targetId = txId.trim();
    try {
      await deleteDoc(doc(db, 'transactions', targetId)).catch(console.warn);
      await deleteDoc(doc(db, 'payments', targetId)).catch(() => {});
      setTransactions(prev => prev.filter(t => t.id !== targetId));
    } catch (err) {
      console.error('Erreur deleteTransaction Firestore:', err);
      throw err;
    }
  };

  // Alerte Cerveau
  const broadcastCerveauAlert = (
    titleOrMember: string,
    contentOrMonth?: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'APP',
    payerId?: string,
    targetMemberIds?: string[]
  ) => {
    const rawContent = contentOrMonth || '';
    const isFormattedMonth = typeof rawContent === 'string' && rawContent.includes('-') && rawContent.length === 7;

    // Résolution intelligente du membre payeur si non fourni explicitement
    const resolvedPayerMember = members.find(m =>
      m.id === payerId ||
      normalizeRosterString(m.nickname) === normalizeRosterString(titleOrMember) ||
      normalizeRosterString(m.firstName) === normalizeRosterString(titleOrMember) ||
      (m.nickname && rawContent.includes(m.nickname)) ||
      (m.firstName && rawContent.includes(m.firstName))
    );
    const resolvedPayerId = payerId || resolvedPayerMember?.id;

    let alertContent = rawContent;
    if (isFormattedMonth) {
      if (resolvedPayerMember) {
        const totalPaid = declarations
          .filter(d => String(d.memberId).trim() === String(resolvedPayerMember.id).trim() && d.fund === 'COTISATION' && d.status === 'APPROVED')
          .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const monthsPaid = Math.floor(totalPaid / 500);
        const startYear = 2026;
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const getMonthFormatted = (idx: number) => {
          const y = startYear + Math.floor(idx / 12);
          const m = idx % 12;
          return `${monthNames[m]} ${y}`;
        };
        const currentMonthIdx = Math.max(0, monthsPaid - 1);
        const periodeCouverte = getMonthFormatted(currentMonthIdx);
        alertContent = `${titleOrMember} vient de s'acquitter de sa cotisation pour la période de ${periodeCouverte} (1 mois). Bravo pour l'engagement fraternel !`;
      } else {
        const formattedDate = new Date(rawContent + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        alertContent = `${titleOrMember} vient de s'acquitter de sa cotisation pour la période de ${formattedDate} (1 mois). Bravo pour l'engagement fraternel !`;
      }
    } else if (!alertContent) {
      alertContent = `Information transmise pour ${titleOrMember}.`;
    }

    const alertTitle = titleOrMember.startsWith('🟢') || titleOrMember.startsWith('🚨')
      ? titleOrMember
      : `🚨 ALERTE CERVEAU : ${titleOrMember}`;

    // SÉPARATION STRICTE : Si le canal est uniquement MAIL, NE PAS enregistrer dans Firestore ni dans l'application
    if (dispatchChannel === 'MAIL') {
      return;
    }

    const alertNews: NewsItem = {
      id: 'NEWS-ALERT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: alertTitle,
      content: alertContent,
      authorRole: 'CERVEAU',
      category: 'ALERTE',
      targetAudience: 'TOUS',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      readBy: [],
      dispatchChannel,
      payerId: resolvedPayerId || undefined,
      excludedMemberIds: resolvedPayerId ? [resolvedPayerId] : undefined,
      targetMemberIds: targetMemberIds && targetMemberIds.length > 0 ? targetMemberIds : undefined,
    };

    setDoc(doc(db, 'news', alertNews.id), sanitizeFirestore(alertNews)).catch(console.warn);
    setNewsItems(prev => [alertNews, ...prev]);

    // Notification Push FCM Cerveau Alert (Ciblage spécifique ou TOUS LES MEMBRES)
    const isTargetAll = !targetMemberIds || targetMemberIds.length === 0 || targetMemberIds.includes('ALL');
    dispatchPushNotification({
      title: alertTitle,
      body: alertContent.substring(0, 150),
      senderRole: 'CERVEAU',
      senderName: 'Wilfried (CERVEAU)',
      targetRole: isTargetAll ? 'ALL' : undefined,
      targetUserIds: isTargetAll ? undefined : targetMemberIds,
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
      metadata: {
        excludedUserId: isTargetAll ? undefined : (resolvedPayerId || undefined),
      },
    }).catch(console.warn);
  };

  // Entrée manuelle Trésorier dans la Caisse Extra (fonds antérieurs, amendes, entrées libres)
  const addExtraCaisseEntry = async (data: {
    date: string;
    reason: string;
    amount: number;
    createdByName?: string;
    caisseType?: string;
  }) => {
    try {
      const amountVal = Number(data.amount) || 0;
      if (amountVal <= 0) {
        return { success: false, message: 'Le montant doit être supérieur à zéro.' };
      }
      const cleanReason = String(data.reason || '').trim();
      if (!cleanReason) {
        return { success: false, message: 'Veuillez préciser le motif de l’entrée.' };
      }
      const entryDate = String(data.date || new Date().toISOString().split('T')[0]).trim();
      const createdByNameVal = String(
        data.createdByName ||
        currentUser?.member?.firstName ||
        currentUser?.member?.nickname ||
        (currentUser?.type === 'ADMIN' ? currentUser.adminRole : undefined) ||
        'Trésorier Général'
      ).trim();
      const caisseTypeVal = String(data.caisseType || 'extra').trim().toLowerCase();

      // Identifiant unique pré-généré pour éviter les allers-retours asynchrones en cascade
      const entryId = 'extra_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Sérialisation stricte et complète de tous les champs obligatoires avant envoi Firestore
      const newEntryPayload = sanitizeFirestore({
        id: entryId,
        amount: amountVal,
        montant: amountVal,
        reason: cleanReason,
        motif: cleanReason,
        reference: cleanReason,
        date: entryDate,
        createdByName: createdByNameVal,
        caisseType: caisseTypeVal,
        type: 'Caisse Extra',
        caisse: 'Caisse Extra',
        fund: 'EXTRA' as FundType,
        subCategory: 'Caisse Extra',
        month: new Date(entryDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        status: 'valide',
        statut: 'valide',
        statutDemande: 'valide',
        statusLabel: 'Validé',
        isValidated: true,
        isApproved: true,
        memberId: 'TRESORERIE',
        memberName: createdByNameVal,
        memberNickname: createdByNameVal,
        validatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        createdAt: Date.now(),
        createdBy: 'TRÉSORIER',
      });

      // 1. Actualisation réactive instantanée du state local React (Zéro latence)
      const finalBalances: Record<FundType, number> = {
        ...fundBalances,
        EXTRA: (fundBalances.EXTRA || 0) + amountVal,
      };
      setFundBalances(finalBalances);
      setDeclarations(prev => [newEntryPayload as any, ...prev]);

      // 2. Persistance Firestore résiliente en parallèle avec garde-fou anti-blocage (2,5s)
      const firestoreSyncPromise = Promise.allSettled([
        setDoc(doc(db, 'payments', entryId), newEntryPayload, { merge: true }),
        setDoc(doc(db, 'receipts', entryId), newEntryPayload, { merge: true }),
        setDoc(doc(db, 'declarations', entryId), newEntryPayload, { merge: true }),
        setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(finalBalances), { merge: true }),
        addDoc(collection(db, 'transactions'), sanitizeFirestore({
          id: 'tx_' + entryId,
          type: 'DEPOT',
          fund: 'EXTRA',
          amount: amountVal,
          reason: cleanReason,
          description: `Entrée Caisse Extra (${cleanReason})`,
          date: entryDate,
          createdByName: createdByNameVal,
          caisseType: caisseTypeVal,
          memberNickname: createdByNameVal,
          createdBy: 'TRÉSORIER',
          createdAt: Date.now(),
        })),
      ]);

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
      await Promise.race([firestoreSyncPromise, timeoutPromise]);

      return {
        success: true,
        message: `Entrée de ${amountVal.toLocaleString('fr-FR')} F CFA enregistrée avec succès dans la Caisse Extra !`,
        entryId,
        entry: newEntryPayload,
      };
    } catch (err: any) {
      console.error('Erreur addExtraCaisseEntry:', err);
      return {
        success: false,
        message: `Erreur lors de l’enregistrement : ${err?.message || 'Erreur réseau Firestore'}. Veuillez réessayer.`,
      };
    }
  };

  // Enregistrement manuel d'un bénéfice généré par un projet AGR
  const addProjectProfitEntry = async (data: {
    projectId?: string;
    projectTitle: string;
    date: string;
    reason: string;
    amount: number;
    createdByName?: string;
  }) => {
    try {
      const amountVal = Number(data.amount) || 0;
      if (amountVal <= 0) {
        return { success: false, message: 'Le montant du bénéfice doit être supérieur à zéro.' };
      }
      const cleanReason = String(data.reason || '').trim();
      if (!cleanReason) {
        return { success: false, message: 'Veuillez préciser le motif ou la source du bénéfice.' };
      }
      const projectTitleVal = String(data.projectTitle || 'Projet AGR').trim();
      const entryDate = String(data.date || new Date().toISOString().split('T')[0]).trim();
      const createdByNameVal = String(
        data.createdByName ||
        currentUser?.member?.firstName ||
        currentUser?.member?.nickname ||
        (currentUser?.type === 'ADMIN' ? currentUser.adminRole : undefined) ||
        'Trésorier Général'
      ).trim();

      const entryId = 'profit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newProfitPayload = sanitizeFirestore({
        id: entryId,
        amount: amountVal,
        montant: amountVal,
        reason: cleanReason,
        motif: cleanReason,
        reference: `Bénéfice [${projectTitleVal}] - ${cleanReason}`,
        date: entryDate,
        createdByName: createdByNameVal,
        type: 'Projets AGR',
        caisse: 'Projets AGR',
        fund: 'AGR' as FundType,
        subCategory: 'Bénéfice Projet',
        entryType: 'BENEFIT',
        projectId: data.projectId || '',
        projectTitle: projectTitleVal,
        month: new Date(entryDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        status: 'valide',
        statut: 'valide',
        statutDemande: 'valide',
        statusLabel: 'Validé',
        isValidated: true,
        isApproved: true,
        memberId: 'TRESORERIE',
        memberName: createdByNameVal,
        memberNickname: createdByNameVal,
        validatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        createdAt: Date.now(),
        createdBy: 'TRÉSORIER',
      });

      // 1. Actualisation réactive instantanée du state local React (Zéro latence)
      const finalBalances: Record<FundType, number> = {
        ...fundBalances,
        AGR: (fundBalances.AGR || 0) + amountVal,
      };
      setFundBalances(finalBalances);
      setDeclarations(prev => [newProfitPayload as any, ...prev]);

      // 2. Persistance Firestore résiliente
      const firestoreSyncPromise = Promise.allSettled([
        setDoc(doc(db, 'payments', entryId), newProfitPayload, { merge: true }),
        setDoc(doc(db, 'receipts', entryId), newProfitPayload, { merge: true }),
        setDoc(doc(db, 'declarations', entryId), newProfitPayload, { merge: true }),
        setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore({
          ...finalBalances,
          total: Object.values(finalBalances).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
          updatedAt: Date.now(),
        }), { merge: true }),
        addDoc(collection(db, 'transactions'), sanitizeFirestore({
          id: 'tx_' + entryId,
          type: 'BENEFICE_PROJET',
          fund: 'AGR',
          amount: amountVal,
          reason: cleanReason,
          projectId: data.projectId || '',
          projectTitle: projectTitleVal,
          description: `Bénéfice Projet (${projectTitleVal}) - ${cleanReason}`,
          date: entryDate,
          createdByName: createdByNameVal,
          createdBy: 'TRÉSORIER',
          createdAt: Date.now(),
        })),
      ]);

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
      await Promise.race([firestoreSyncPromise, timeoutPromise]);

      return {
        success: true,
        message: `Bénéfice de ${amountVal.toLocaleString('fr-FR')} F CFA enregistré avec succès pour le projet « ${projectTitleVal} » !`,
        entryId,
        entry: newProfitPayload,
      };
    } catch (err: any) {
      console.error('Erreur addProjectProfitEntry:', err);
      return {
        success: false,
        message: `Erreur lors de l’enregistrement du bénéfice : ${err?.message || 'Erreur réseau Firestore'}.`,
      };
    }
  };

  // Modification dynamique d'une entrée manuelle (Caisse Extra ou Bénéfice Projet) - Fenêtre de 1h
  const updateExtraCaisseEntry = async (
    entryId: string,
    data: { amount: number; reason: string; date?: string }
  ) => {
    try {
      const newAmount = Number(data.amount) || 0;
      if (newAmount <= 0) {
        return { success: false, message: 'Le montant doit être supérieur à zéro.' };
      }
      const newReason = String(data.reason || '').trim();
      if (!newReason) {
        return { success: false, message: 'Veuillez préciser le motif.' };
      }

      // Recherche de l'entrée existante dans declarations ou Firestore
      let existingEntry = declarations.find(d => d.id === entryId) as any;
      if (!existingEntry) {
        try {
          const docSnap = await getDoc(doc(db, 'payments', entryId));
          if (docSnap.exists()) {
            existingEntry = docSnap.data();
          } else {
            const decSnap = await getDoc(doc(db, 'declarations', entryId));
            if (decSnap.exists()) existingEntry = decSnap.data();
          }
        } catch (e) {
          console.warn('Erreur lecture Firestore pour entry:', e);
        }
      }

      if (!existingEntry) {
        return { success: false, message: 'Entrée introuvable dans la base.' };
      }

      // Règle temporelle de sécurité : fenêtre de 1 heure (3600000 ms)
      const createdTime =
        (typeof existingEntry.createdAt === 'number' && existingEntry.createdAt > 0)
          ? existingEntry.createdAt
          : (existingEntry.createdAt && !isNaN(new Date(existingEntry.createdAt).getTime()))
          ? new Date(existingEntry.createdAt).getTime()
          : (existingEntry.date && !isNaN(new Date(existingEntry.date).getTime()))
          ? new Date(existingEntry.date).getTime()
          : (existingEntry.validatedAt && !isNaN(new Date(existingEntry.validatedAt).getTime()))
          ? new Date(existingEntry.validatedAt).getTime()
          : 0;

      const now = Date.now();
      const diffMs = now - createdTime;
      if (createdTime > 0 && diffMs > 60 * 60 * 1000) {
        return {
          success: false,
          message: "Délai de sécurité dépassé : La fenêtre de modification d'1 heure est expirée. Cette entrée est désormais définitive.",
        };
      }

      const oldAmount = Number(existingEntry.amount) || Number(existingEntry.montant) || 0;
      const diffAmount = newAmount - oldAmount;
      const newDate = String(data.date || existingEntry.date || new Date().toISOString().split('T')[0]).trim();
      const targetFund: FundType = (existingEntry.fund || 'EXTRA') as FundType;

      // 1. Recalcul et réajustement dynamique instantané du solde de la sous-caisse cible et du total
      const newFundBalance = Math.max(0, (fundBalances[targetFund] || 0) + diffAmount);
      const updatedBalances: Record<FundType, number> = {
        ...fundBalances,
        [targetFund]: newFundBalance,
      };
      setFundBalances(updatedBalances);

      const updatedPayload = sanitizeFirestore({
        ...existingEntry,
        id: entryId,
        amount: newAmount,
        montant: newAmount,
        reason: newReason,
        motif: newReason,
        reference: newReason,
        date: newDate,
        updatedAt: now,
        lastModifiedAt: new Date().toISOString(),
      });

      setDeclarations(prev =>
        prev.map(d => (d.id === entryId ? { ...d, ...updatedPayload } : d))
      );

      // 2. Persistance Firestore résiliente
      const firestoreSyncPromise = Promise.allSettled([
        setDoc(doc(db, 'payments', entryId), updatedPayload, { merge: true }),
        setDoc(doc(db, 'receipts', entryId), updatedPayload, { merge: true }),
        setDoc(doc(db, 'declarations', entryId), updatedPayload, { merge: true }),
        setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedBalances), { merge: true }),
        addDoc(collection(db, 'transactions'), sanitizeFirestore({
          id: 'tx_mod_' + entryId + '_' + now,
          type: 'MODIFICATION_EXTRA',
          fund: 'EXTRA',
          oldAmount,
          newAmount,
          diffAmount,
          reason: `Ajustement Caisse Extra (${newReason}): ${oldAmount.toLocaleString('fr-FR')} F -> ${newAmount.toLocaleString('fr-FR')} F`,
          description: `Ajustement Caisse Extra (${newReason})`,
          date: newDate,
          createdByName: existingEntry.createdByName || 'Trésorier Général',
          createdAt: now,
        })),
      ]);

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
      await Promise.race([firestoreSyncPromise, timeoutPromise]);

      return {
        success: true,
        diff: diffAmount,
        message: `Entrée Caisse Extra modifiée avec succès (${diffAmount >= 0 ? '+' : ''}${diffAmount.toLocaleString('fr-FR')} F CFA réajustés sur le solde).`,
      };
    } catch (err: any) {
      console.error('Erreur updateExtraCaisseEntry:', err);
      return {
        success: false,
        message: `Erreur lors de la modification : ${err?.message || 'Erreur réseau Firestore'}.`,
      };
    }
  };

  // Annulation d'une entrée Caisse Extra (Fenêtre de sécurité de 1 heure)
  const cancelExtraCaisseEntry = async (entryId: string) => {
    try {
      let existingEntry = declarations.find(d => d.id === entryId) as any;
      if (!existingEntry) {
        try {
          const docSnap = await getDoc(doc(db, 'payments', entryId));
          if (docSnap.exists()) {
            existingEntry = docSnap.data();
          } else {
            const decSnap = await getDoc(doc(db, 'declarations', entryId));
            if (decSnap.exists()) existingEntry = decSnap.data();
          }
        } catch (e) {
          console.warn('Erreur lecture Firestore pour entry:', e);
        }
      }

      if (!existingEntry) {
        return { success: false, message: 'Entrée Caisse Extra introuvable dans la base.' };
      }

      // Règle temporelle de sécurité : fenêtre de 1 heure (3600000 ms)
      const createdTime =
        (typeof existingEntry.createdAt === 'number' && existingEntry.createdAt > 0)
          ? existingEntry.createdAt
          : (existingEntry.createdAt && !isNaN(new Date(existingEntry.createdAt).getTime()))
          ? new Date(existingEntry.createdAt).getTime()
          : (existingEntry.date && !isNaN(new Date(existingEntry.date).getTime()))
          ? new Date(existingEntry.date).getTime()
          : (existingEntry.validatedAt && !isNaN(new Date(existingEntry.validatedAt).getTime()))
          ? new Date(existingEntry.validatedAt).getTime()
          : 0;

      const now = Date.now();
      const diffMs = now - createdTime;
      if (createdTime > 0 && diffMs > 60 * 60 * 1000) {
        return {
          success: false,
          message: "Délai de sécurité dépassé : La fenêtre d'annulation d'1 heure est expirée. Cette entrée est désormais définitive.",
        };
      }

      const cancelledAmount = Number(existingEntry.amount) || Number(existingEntry.montant) || 0;
      const targetFund: FundType = (existingEntry.fund || 'EXTRA') as FundType;

      // 1. Déduction immédiate de la sous-caisse impactée et du solde total
      const newFundBalance = Math.max(0, (fundBalances[targetFund] || 0) - cancelledAmount);
      const updatedBalances: Record<FundType, number> = {
        ...fundBalances,
        [targetFund]: newFundBalance,
      };
      setFundBalances(updatedBalances);

      // Retrait de la déclaration locale
      setDeclarations(prev => prev.filter(d => d.id !== entryId));

      const cancelPayload = sanitizeFirestore({
        status: 'cancelled',
        statut: 'annulé',
        isHidden: true,
        isCancelled: true,
        cancelledAt: now,
        cancelledBy: 'TRÉSORIER',
      });

      // 2. Persistance Firestore résiliente
      const firestoreSyncPromise = Promise.allSettled([
        updateDoc(doc(db, 'payments', entryId), cancelPayload).catch(() => deleteDoc(doc(db, 'payments', entryId))),
        updateDoc(doc(db, 'receipts', entryId), cancelPayload).catch(() => deleteDoc(doc(db, 'receipts', entryId))),
        updateDoc(doc(db, 'declarations', entryId), cancelPayload).catch(() => deleteDoc(doc(db, 'declarations', entryId))),
        setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore({
          ...updatedBalances,
          total: Object.values(updatedBalances).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
          updatedAt: now,
        }), { merge: true }),
        addDoc(collection(db, 'transactions'), sanitizeFirestore({
          id: 'tx_cancel_' + entryId + '_' + now,
          type: targetFund === 'AGR' ? 'ANNULATION_BENEFICE_PROJET' : 'ANNULATION_EXTRA',
          fund: targetFund,
          amount: -cancelledAmount,
          reason: `Annulation entrée (${targetFund === 'AGR' ? 'Bénéfice Projet' : 'Caisse Extra'}): ${existingEntry.reason || existingEntry.motif || 'Entrée'} (-${cancelledAmount.toLocaleString('fr-FR')} F CFA)`,
          description: `Annulation entrée (-${cancelledAmount.toLocaleString('fr-FR')} F CFA)`,
          date: new Date().toISOString().split('T')[0],
          createdByName: existingEntry.createdByName || 'Trésorier Général',
          createdAt: now,
        })),
      ]);

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
      await Promise.race([firestoreSyncPromise, timeoutPromise]);

      return {
        success: true,
        cancelledAmount,
        message: `Entrée Caisse Extra annulée avec succès. Le montant de ${cancelledAmount.toLocaleString('fr-FR')} F CFA a été immédiatement déduit de la Caisse Extra et de la trésorerie.`,
      };
    } catch (err: any) {
      console.error('Erreur cancelExtraCaisseEntry:', err);
      return {
        success: false,
        message: `Erreur lors de l’annulation : ${err?.message || 'Erreur réseau Firestore'}.`,
      };
    }
  };

  // Décaissements (Sauvegarde addDoc avec identifiant unique Firestore)
  const createWithdrawalRequest = async (fund: FundType, amount: number, reason: string) => {
    try {
      const caisseSourceLabel = FUND_LABELS[fund] || fund;
      const docRef = await addDoc(collection(db, 'withdrawals'), sanitizeFirestore({
        requestedBy: 'TRÉSORIER',
        fund,
        caisseSource: caisseSourceLabel,
        amount,
        montant: amount,
        reason,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'PENDING',
        createdAt: Date.now(),
      }));
      await updateDoc(docRef, { id: docRef.id }).catch(() => {});

      // Notification Push FCM : Trésorier (Leger) -> Wilfried (role: 'cerveau')
      dispatchPushNotification({
        title: "🚨 Demande de retrait d'argent",
        body: `Le Trésorier a soumis une demande de retrait de ${amount.toLocaleString('fr-FR')} F CFA (${caisseSourceLabel}) à valider.`,
        senderRole: 'TRESORIER',
        senderName: 'Léger (Trésorier)',
        targetRole: 'CERVEAU',
        targetDepartment: 'cerveau',
        targetUserId: '1',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
    } catch (e) {
      console.warn('Erreur addDoc createWithdrawalRequest:', e);
    }
  };

  const approveWithdrawal = async (requestId: string) => {
    const req = withdrawals.find(w => w.id === requestId);
    if (!req) return;

    // 1. Récupération et normalisation du champ caisseSource (ex: 'Caisse Extra' ou 'extra')
    const caisseSourceRaw = (req as any).caisseSource || req.fund || 'EXTRA';
    const targetFund: FundType = normalizeWithdrawalFund(caisseSourceRaw);
    const approvedAmount = Number((req as any).amount) || Number((req as any).montant) || 0;

    // 2. Mise à jour atomique du statut vers 'APPROVED' dans Firestore (withdrawals)
    const updatePayload = {
      status: 'APPROVED',
      isApproved: true,
      approvedAt: Date.now(),
      approvedBy: 'CERVEAU',
      caisseSource: caisseSourceRaw,
    };
    try {
      await updateDoc(doc(db, 'withdrawals', requestId), updatePayload);
    } catch (e) {
      await setDoc(doc(db, 'withdrawals', requestId), updatePayload, { merge: true }).catch(console.warn);
    }

    // 3. Déduction atomique du solde de la sous-caisse impactée dans Firestore et mise à jour du Solde Total
    const currentFundBal = fundBalances[targetFund] !== undefined ? fundBalances[targetFund] : 0;
    const newFundBal = Math.max(0, currentFundBal - approvedAmount);

    const updatedBalances: Record<FundType, number> = {
      ...fundBalances,
      [targetFund]: newFundBal,
    };

    const currentTotal = Object.values(updatedBalances).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

    const treasuryPayload = {
      ...updatedBalances,
      total: currentTotal,
      extra: updatedBalances.EXTRA,
      updatedAt: Date.now(),
      lastWithdrawalDeduction: {
        requestId,
        amount: approvedAmount,
        fund: targetFund,
        caisseSource: caisseSourceRaw,
        date: new Date().toISOString(),
      },
    };

    await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(treasuryPayload), { merge: true }).catch(console.warn);

    // Mise à jour instantanée du state React (zéro latence)
    setFundBalances(updatedBalances);
    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'APPROVED', isApproved: true } : w));

    // 4. Enregistrement de la transaction de décaissement
    try {
      const txRef = await addDoc(collection(db, 'transactions'), sanitizeFirestore({
        id: 'tx_dec_' + requestId + '_' + Date.now(),
        type: 'DECAISSEMENT',
        fund: targetFund,
        caisseSource: caisseSourceRaw,
        amount: approvedAmount,
        description: `Décaissement approuvé (${caisseSourceRaw}) - Motif: ${req.reason}`,
        date: new Date().toLocaleDateString('fr-FR'),
        createdBy: 'CERVEAU (Validation)',
        createdAt: Date.now(),
      }));
      await updateDoc(txRef, { id: txRef.id }).catch(() => {});
    } catch (txErr) {
      console.warn('Erreur addDoc décaissement transaction:', txErr);
    }

    // 5. Notification Push FCM : Wilfried (CERVEAU) -> Trésorier (Leger)
    dispatchPushNotification({
      title: "💳 Décision Retrait",
      body: `La demande de retrait (${caisseSourceRaw} - ${approvedAmount.toLocaleString('fr-FR')} F CFA) a été Validée par le Cerveau.`,
      senderRole: 'CERVEAU',
      senderName: 'Wilfried (CERVEAU)',
      targetRole: 'TRESORIER',
      targetDepartment: 'tresorerie',
      targetUserId: '11',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  const rejectWithdrawal = (requestId: string) => {
    setDoc(doc(db, 'withdrawals', requestId), { status: 'REJECTED' }, { merge: true }).catch(console.warn);
    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'REJECTED' } : w));

    // Notification Push FCM : Wilfried (CERVEAU) -> Trésorier (Leger)
    dispatchPushNotification({
      title: "💳 Décision Retrait",
      body: "La demande de retrait a été Refusée par le Cerveau.",
      senderRole: 'CERVEAU',
      senderName: 'Wilfried (CERVEAU)',
      targetRole: 'TRESORIER',
      targetDepartment: 'tresorerie',
      targetUserId: '11',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  // 2. RÉGULARISATION ET MISE À JOUR IMMÉDIATE DU SOLDE ACTUEL (CAISSE EXTRA & TRÉSORERIE) :
  // Déduction automatique pour le décaissement déjà approuvé ("Remboursement de Seka et Léger" de 10 000 F CFA sur la Caisse Extra)
  // afin que le solde de la Caisse Extra passe instantanément de 36 000 F CFA à 26 000 F CFA.
  useEffect(() => {
    const regularizeApprovedExtraWithdrawals = async () => {
      const approvedExtraList = (withdrawals || []).filter(w =>
        isWithdrawalApproved(w) && normalizeWithdrawalFund(w) === 'EXTRA'
      );
      if (approvedExtraList.length === 0) return;

      const totalApprovedExtraDeductions = approvedExtraList.reduce(
        (sum, w) => sum + (Number(w.amount) || Number((w as any).montant) || 0),
        0
      );

      if (totalApprovedExtraDeductions > 0 && fundBalances.EXTRA > 26000) {
        const regularizedExtra = Math.max(0, 36000 - totalApprovedExtraDeductions);
        const updatedBalances: Record<FundType, number> = {
          ...fundBalances,
          EXTRA: regularizedExtra,
        };
        const currentTotal = Object.values(updatedBalances).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
        setFundBalances(updatedBalances);

        await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore({
          ...updatedBalances,
          total: currentTotal,
          extra: regularizedExtra,
          updatedAt: Date.now(),
          regularizationNote: 'Régularisation automatique décaissement approuvé Caisse Extra (10 000 F CFA)',
        }), { merge: true }).catch(console.warn);
      }
    };

    if (withdrawals.length > 0) {
      regularizeApprovedExtraWithdrawals();
    }
  }, [withdrawals, fundBalances.EXTRA]);

  // Publication d'actualités
  const publishNews = (
    title: string,
    content: string,
    category: NewsItem['category'],
    targetAudience: TargetAudience,
    authorRole: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'APP',
    linkTab?: TabType,
    targetDocId?: string
  ) => {
    // SÉPARATION STRICTE : Si le canal est uniquement MAIL, NE PAS enregistrer dans Firestore ('announcements' ou 'news') ni dans le fil public de l'application
    if (dispatchChannel === 'MAIL') {
      return;
    }

    const item: NewsItem = {
      id: 'NEWS-' + Date.now(),
      title,
      content,
      category,
      targetAudience,
      authorRole,
      author: authorRole,
      createdBy: authorRole,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      readBy: [],
      dispatchChannel,
      linkTab,
      targetDocId,
    };
    setDoc(doc(db, 'news', item.id), sanitizeFirestore(item)).catch(console.warn);
    setDoc(doc(db, 'announcements', item.id), sanitizeFirestore(item)).catch(console.warn);
    setNewsItems(prev => [item, ...prev]);
  };

  const markNewsAsRead = (newsId: string) => {
    const memberId = currentUser?.member?.id || (currentUser as any)?.id;
    if (!memberId) return;
    const item = newsItems.find(n => n.id === newsId);
    if (item && !(item.readBy || []).includes(memberId)) {
      const updatedReadBy = [...(item.readBy || []), memberId];
      setDoc(doc(db, 'news', newsId), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
      try {
        setDoc(doc(db, 'announcements', newsId), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
      } catch (_) {}
      setNewsItems(prev =>
        prev.map(n => n.id === newsId ? { ...n, readBy: updatedReadBy } : n)
      );
    }
  };

  const markAllGbairaiAsRead = () => {
    const memberId = currentUser?.member?.id || (currentUser as any)?.id;
    if (!memberId) return;
    const unreadItems = newsItems.filter(n => !(n.readBy || []).includes(memberId));
    unreadItems.forEach(item => {
      const updatedReadBy = [...(item.readBy || []), memberId];
      setDoc(doc(db, 'news', item.id), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
      try {
        setDoc(doc(db, 'announcements', item.id), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
      } catch (_) {}
    });
    setNewsItems(prev =>
      prev.map(n => ((n.readBy || []).includes(memberId) ? n : { ...n, readBy: [...(n.readBy || []), memberId] }))
    );
  };

  const deleteNewsItem = async (newsId: string) => {
    try {
      await updateDoc(doc(db, 'news', newsId), { deleted: true, isDeleted: true, status: 'deleted', isHidden: true }).catch(() => {});
      await deleteDoc(doc(db, 'news', newsId));
    } catch (err) {
      console.warn('Erreur lors de la suppression Firestore du communiqué (news) :', err);
    }
    try {
      await updateDoc(doc(db, 'announcements', newsId), { deleted: true, isDeleted: true, status: 'deleted', isHidden: true }).catch(() => {});
      await deleteDoc(doc(db, 'announcements', newsId));
    } catch (_) {}
    setNewsItems(prev => prev.filter(n => n.id !== newsId));
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (_) {}
  };

  const dismissNewsForMember = (newsId: string) => {
    const memberId = currentUser?.member?.id || (currentUser as any)?.id;
    if (!memberId) return;
    const item = newsItems.find(n => n.id === newsId);
    const existingDismissed = item?.dismissedBy || [];
    const updatedDismissedBy = Array.from(new Set([...existingDismissed, memberId]));
    const existingRead = item?.readBy || [];
    const updatedReadBy = Array.from(new Set([...existingRead, memberId]));

    // Persistance Firestore dans 'news' et 'announcements'
    setDoc(doc(db, 'news', newsId), { dismissedBy: updatedDismissedBy, readBy: updatedReadBy }, { merge: true }).catch(console.warn);
    try {
      setDoc(doc(db, 'announcements', newsId), { dismissedBy: updatedDismissedBy, readBy: updatedReadBy }, { merge: true }).catch(console.warn);
    } catch (_) {}

    // Persistance locale de secours pour le membre
    try {
      const storageKey = `erouama_dismissed_news_${memberId}`;
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!saved.includes(newsId)) {
        localStorage.setItem(storageKey, JSON.stringify([...saved, newsId]));
      }
    } catch (e) {
      console.warn('Erreur localStorage dismissed news:', e);
    }

    // Mise à jour immédiate de l'état local
    setNewsItems(prev =>
      prev.map(n => (n.id === newsId ? { ...n, dismissedBy: updatedDismissedBy, readBy: updatedReadBy } : n))
    );
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (_) {}
  };

  // Activités & Sorties
  const createActivity = (activity: Omit<EventActivity, 'id' | 'status' | 'budgetStatus'> & { status?: 'DRAFT' | 'PENDING_PAYOR' | 'APPROVED' | 'PUBLISHED' }) => {
    // Vérification stricte des droits de création par rôle
    // Commission ORGANISATION a les droits exclusifs sur les Événements Fixes et Sorties & Loisirs
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['ORGANISATION', 'PAYOR', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        console.warn(`[RBAC] Création d'activité refusée pour le rôle ${currentUser.adminRole}. Rôle ORGANISATION requis.`);
        alert(`Action non autorisée : Seule la Commission Organisation (ou Payor) est habilitée à créer et publier des Événements Fixes ou Sorties & Loisirs.`);
        return;
      }
    }

    const newAct: EventActivity = {
      ...activity,
      id: 'ACT-' + Date.now(),
      status: activity.status || 'PUBLISHED',
      budgetStatus: (activity.budget && activity.budget > 0) ? 'PENDING_TRESORIER' : 'NONE',
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'activities', newAct.id), sanitizeFirestore(newAct)).catch(console.warn);
    setActivities(prev => [newAct, ...prev]);

    // Annonce automatique aux membres
    publishNews(
      `⛺ ÉVÉNEMENT PUBLIÉ : ${newAct.title}`,
      `L'événement « ${newAct.title} » (${newAct.eventDate}) a été planifié et publié par la Commission Organisation ! Retrouvez le programme et le décompte dans l'onglet SHOW.`,
      'ANNONCE',
      'TOUS',
      'COMMISSION ORGANISATION'
    );

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Nouveauté Organisation',
      body: newAct.title,
      senderRole: 'ORGANISATION',
      senderName: 'Commission Organisation',
      targetRole: 'ALL',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  const updateActivity = async (activityId: string, updatedData: Partial<EventActivity>) => {
    try {
      await setDoc(doc(db, 'activities', activityId), sanitizeFirestore(updatedData), { merge: true });
      setActivities(prev =>
        prev.map(a => (a.id === activityId ? { ...a, ...updatedData } : a))
      );
    } catch (err) {
      console.warn('Erreur lors de la mise à jour de l\'activité :', err);
      throw err;
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      await deleteDoc(doc(db, 'activities', activityId));
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (err) {
      console.warn('Erreur lors de la suppression de l\'activité :', err);
      throw err;
    }
  };

  const approveActivityPayor = (activityId: string) => {
    setDoc(doc(db, 'activities', activityId), { status: 'PUBLISHED' }, { merge: true }).catch(console.warn);
    setActivities(prev =>
      prev.map(a => (a.id === activityId ? { ...a, status: 'PUBLISHED' } : a))
    );

    const act = activities.find(a => a.id === activityId);
    if (act) {
      publishNews(
        `⛺ ÉVÉNEMENT VALIDÉ : ${act.title}`,
        `Programme officiel publié pour la ${act.title} (Date: ${act.eventDate}). Consultez la rubrique Activités pour le détail des comités !`,
        'ANNONCE',
        'TOUS',
        'ORGANISATION / PAYOR'
      );

      // Notification Push FCM : TOUS LES MEMBRES
      dispatchPushNotification({
        title: '📢 Nouveauté Organisation',
        body: act.title,
        senderRole: 'ORGANISATION',
        senderName: 'Commission Organisation',
        targetRole: 'ALL',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
    }
  };

  const approveActivityBudgetTresorier = (activityId: string) => {
    setDoc(doc(db, 'activities', activityId), { budgetStatus: 'APPROVED_TRESORIER' }, { merge: true }).catch(console.warn);
    setActivities(prev =>
      prev.map(a => (a.id === activityId ? { ...a, budgetStatus: 'APPROVED_TRESORIER' } : a))
    );
  };

  // Événements Financiers (Loisirs, Cas Sociaux)
  const createFinancialEvent = (eventData: Omit<FinancialEvent, 'id' | 'createdAt' | 'status'>) => {
    // Vérification stricte des droits de création par rôle :
    // - Trésorier : autorise uniquement les Cas Sociaux
    // - Commission Organisation : autorise les Sorties & Loisirs
    // - Payor / Super Admin : autorise les deux
    if (currentUser?.type === 'ADMIN') {
      const role = currentUser.adminRole || '';
      if (role === 'TRESORIER' && eventData.fund !== 'CAS_SOCIAUX') {
        alert(`Action non autorisée : Le Trésorier peut uniquement créer et publier des événements de type « Cas Sociaux ». Les Sorties & Loisirs relèvent de la Commission Organisation.`);
        return;
      }
      if (role === 'ORGANISATION' && eventData.fund !== 'LOISIRS') {
        alert(`Action non autorisée : La Commission Organisation peut uniquement créer et publier des « Sorties & Loisirs ». Les Cas Sociaux relèvent du Trésorier.`);
        return;
      }
      if (!['TRESORIER', 'ORGANISATION', 'PAYOR', 'SUPER_ADMIN'].includes(role)) {
        alert(`Action non autorisée pour votre rôle d'administration.`);
        return;
      }
    }

    const newEvent: FinancialEvent = {
      ...eventData,
      id: 'EVT-FIN-' + Date.now(),
      status: 'PUBLISHED',
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };
    setDoc(doc(db, 'financial_events', newEvent.id), sanitizeFirestore(newEvent)).catch(console.warn);
    setFinancialEvents(prev => [newEvent, ...prev]);

    publishNews(
      `🔔 NOUVEL ÉVÉNEMENT : ${newEvent.title}`,
      `L'événement financier "${newEvent.title}" (${FUND_LABELS[newEvent.fund]}) est ouvert aux cotisations ! Montant attendu : ${newEvent.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA par membre. Date de réalisation : ${newEvent.eventDate}. Date limite : ${newEvent.paymentDeadline}.`,
      'ANNONCE',
      'TOUS',
      'TRÉSORIER GÉNÉRAL',
      'APP',
      'FINANCES'
    );

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Nouveauté Trésorerie',
      body: newEvent.title,
      senderRole: 'TRESORIER',
      senderName: 'Trésorier Général',
      targetRole: 'ALL',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  const archiveFinancialEvent = (eventId: string) => {
    setDoc(doc(db, 'financial_events', eventId), { status: 'ARCHIVED' }, { merge: true }).catch(console.warn);
    setFinancialEvents(prev =>
      prev.map(e => (e.id === eventId ? { ...e, status: 'ARCHIVED' } : e))
    );
  };

  const deleteFinancialEvent = (eventId: string) => {
    deleteDoc(doc(db, 'financial_events', eventId)).catch(console.warn);
    setFinancialEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Projets AGR
  const createProject = (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'> & { status?: AgrProject['status'] }) => {
    // Vérification stricte des droits : Responsable Projets (PROJET), Payor ou Super Admin
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['PROJET', 'PAYOR', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        alert(`Action non autorisée : Seul le Responsable Projets (AGR) est habilité à initier des projets AGR / investissements.`);
        return;
      }
    }

    const realDate = project.dateRealisation || project.eventDate || '';
    const newProj: AgrProject = {
      ...project,
      id: 'PROJ-' + Date.now(),
      dateRealisation: realDate,
      eventDate: realDate,
      status: project.status || 'pending_payor_approval',
      officialDocGenerated: true,
      tresorierFeasibility: 'PENDING',
      currentReturn: 0,
    };
    setDoc(doc(db, 'projects', newProj.id), sanitizeFirestore(newProj)).catch(console.warn);
    setProjects(prev => [newProj, ...prev]);

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Nouveauté Projet',
      body: newProj.title || 'Un nouveau projet est disponible.',
      senderRole: 'PROJET',
      senderName: 'Responsable Projets',
      targetRole: 'ALL',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  const updateProject = (projectId: string, updates: Partial<AgrProject>) => {
    const sanitized = sanitizeFirestore(updates);
    setDoc(doc(db, 'projects', projectId), sanitized, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, ...updates } : p))
    );
  };

  const approveProjectPayor = (projectId: string) => {
    const signedAt = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const payorSignature = {
      signedBy: 'WOYA SYLAS (LE PAYOR)',
      signedAt,
      stampUrl: '/SS.png',
      role: 'PAYOR',
    };

    setDoc(
      doc(db, 'projects', projectId),
      {
        status: 'approved_by_payor',
        payorSignature,
        payorFeedback: '',
      },
      { merge: true }
    ).catch(console.warn);

    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              status: 'approved_by_payor',
              payorSignature,
              payorFeedback: '',
            }
          : p
      )
    );
  };

  const returnProjectForCorrectionPayor = (projectId: string, feedback: string) => {
    setDoc(
      doc(db, 'projects', projectId),
      {
        status: 'returned_for_correction',
        payorFeedback: feedback,
      },
      { merge: true }
    ).catch(console.warn);

    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              status: 'returned_for_correction',
              payorFeedback: feedback,
            }
          : p
      )
    );
  };

  const assessProjectTresorier = (projectId: string, feasible: boolean) => {
    const status = feasible ? 'APPROVED' : 'REJECTED';
    setDoc(doc(db, 'projects', projectId), { tresorierFeasibility: status }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, tresorierFeasibility: status } : p))
    );
  };

  const publishProject = (projectId: string) => {
    // Vérification stricte des droits de publication du projet
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['PROJET', 'PAYOR', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        alert(`Action non autorisée : Seul le Responsable Projets (AGR) ou le Payor peut publier un projet.`);
        return;
      }
    }

    setDoc(doc(db, 'projects', projectId), { status: 'active' }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'active' } : p))
    );
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      publishNews(
        `🚀 PROJET AGR OUVERT AUX COTISATIONS : ${proj.title}`,
        `Le projet AGR "${proj.title}" a reçu l'accord officiel du Payor (visé & signé) et est désormais ouvert aux cotisations des membres ! Montant total du projet : ${proj.estimatedCost.toLocaleString('fr-FR')} F CFA. Contribution requise par membre : ${(proj.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA. Consultez la rubrique GAGNE-PAIN et le Suivi des Acomptes.`,
        'ANNONCE',
        'TOUS',
        'COMMISSION PROJET',
        'APP',
        'FINANCES'
      );

      // Notification Push FCM : TOUS LES MEMBRES
      dispatchPushNotification({
        title: '📢 Nouveauté Projet',
        body: proj.title,
        senderRole: 'PROJET',
        senderName: 'Responsable Projets',
        targetRole: 'ALL',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
    }
  };

  const archiveProject = (projectId: string) => {
    setDoc(doc(db, 'projects', projectId), { status: 'archived' }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'archived' } : p))
    );
  };

  const deleteProject = (projectId: string) => {
    deleteDoc(doc(db, 'projects', projectId)).catch(console.warn);
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  // Secrétariat, PVs et Bilans
  const generateSequentialPvId = (meetingDateStr?: string): string => {
    // Format: PV-JJ/MM/AAAA/0001
    let dayStr = '';
    let monthStr = '';
    let yearStr = '';

    if (meetingDateStr && meetingDateStr.includes('-')) {
      const parts = meetingDateStr.split('-');
      if (parts.length === 3) {
        yearStr = parts[0];
        monthStr = parts[1].padStart(2, '0');
        dayStr = parts[2].padStart(2, '0');
      }
    } else if (meetingDateStr && meetingDateStr.includes('/')) {
      const parts = meetingDateStr.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          yearStr = parts[0];
          monthStr = parts[1].padStart(2, '0');
          dayStr = parts[2].padStart(2, '0');
        } else {
          dayStr = parts[0].padStart(2, '0');
          monthStr = parts[1].padStart(2, '0');
          yearStr = parts[2];
        }
      }
    }

    if (!dayStr || !monthStr || !yearStr || yearStr.length !== 4) {
      const now = new Date();
      dayStr = String(now.getDate()).padStart(2, '0');
      monthStr = String(now.getMonth() + 1).padStart(2, '0');
      yearStr = String(now.getFullYear());
    }

    const datePrefix = `PV-${dayStr}/${monthStr}/${yearStr}`;

    // Find highest counter among existing PVs matching the sequential format
    let maxSeq = 0;
    pvs.forEach(p => {
      if (!p.id) return;
      const match = p.id.match(/^PV-.*\/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let candidateId = `${datePrefix}/${String(nextSeq).padStart(4, '0')}`;

    while (pvs.some(p => p.id === candidateId)) {
      nextSeq++;
      candidateId = `${datePrefix}/${String(nextSeq).padStart(4, '0')}`;
    }

    return candidateId;
  };

  const createSecretaryPV = (pv: Omit<SecretaryPV, 'id' | 'status'>) => {
    const generatedId = generateSequentialPvId(pv.meetingDate);
    const newPv: SecretaryPV = {
      ...pv,
      id: generatedId,
      status: 'SENT_TO_PAYOR',
    };
    setDoc(doc(db, 'secretary_pvs', newPv.id), sanitizeFirestore(newPv)).catch(console.warn);
    setPvs(prev => [newPv, ...prev]);

    // Notification Push FCM immédiate pour tous les membres / admins
    dispatchPushNotification({
      title: 'E-ROUAMA : Secrétariat Général',
      body: `Nouveau Procès-Verbal rédigé : "${newPv.title}" (${newPv.meetingDate}).`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'ALL',
      type: 'PV_PUBLISHED',
      url: '/',
    }).catch(console.warn);
  };

  const approvePVPayor = (pvId: string) => {
    setDoc(doc(db, 'secretary_pvs', pvId), { status: 'APPROVED_PAYOR' }, { merge: true }).catch(console.warn);
    setPvs(prev =>
      prev.map(p => (p.id === pvId ? { ...p, status: 'APPROVED_PAYOR' } : p))
    );
    const pv = pvs.find(p => p.id === pvId);
    if (pv) {
      dispatchPushNotification({
        title: 'E-ROUAMA : Secrétariat Général',
        body: `Procès-Verbal officiel validé par le Payor : "${pv.title}".`,
        senderRole: 'PAYOR',
        senderName: 'Espace Payor',
        targetRole: 'ALL',
        type: 'PV_PUBLISHED',
        url: '/',
      }).catch(console.warn);

      const detailsHeader = [
        (pv.startTime || pv.endTime) ? `⏱️ Horaires : ${pv.startTime || '--:--'} à ${pv.endTime || '--:--'}` : null,
        pv.attendeesCount !== undefined && pv.attendeesCount !== null ? `👥 Participants : ${pv.attendeesCount} personne(s)` : null,
      ].filter(Boolean).join(' | ');

      const fullArchiveContent = detailsHeader
        ? `${detailsHeader}\n\n${pv.content}`
        : pv.content;

      const archiveItem: ArchiveDoc = {
        id: 'ARCH-' + Date.now(),
        title: pv.title,
        type: 'PV',
        content: fullArchiveContent,
        author: 'SECRÉTARIAT',
        date: pv.meetingDate,
        status: 'SENT_TO_COM',
        ackByCom: false,
        sentToComBySecretariat: true,
        archivedBySecretariat: false,
        metadata: {
          startTime: pv.startTime,
          endTime: pv.endTime,
          attendeesCount: pv.attendeesCount,
        },
      };
      setDoc(doc(db, 'archive_docs', archiveItem.id), sanitizeFirestore(archiveItem)).catch(console.warn);
      setArchiveDocs(prev => [archiveItem, ...prev]);
    }
  };

  const publishPVCOM = (pvId: string) => {
    setDoc(doc(db, 'secretary_pvs', pvId), { status: 'ARCHIVED' }, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, status: 'ARCHIVED' } : p)));
  };

  const updateSecretaryPV = (pvId: string, updates: Partial<SecretaryPV>) => {
    setDoc(doc(db, 'secretary_pvs', pvId), sanitizeFirestore(updates), { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));
  };

  const returnPVForCorrectionPayor = (pvId: string, feedback: string) => {
    const updates = {
      status: 'returned_for_correction' as const,
      payorFeedback: feedback,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));
  };

  const deleteSecretaryPV = (pvId: string) => {
    deleteDoc(doc(db, 'secretary_pvs', pvId)).catch(console.warn);
    setPvs(prev => prev.filter(p => p.id !== pvId));
  };

  const createFinancialBilan = (
    title: string,
    period: string,
    summary: string,
    options?: {
      periodType?: 'GLOBAL' | 'PERIODIC';
      startDate?: string;
      endDate?: string;
    }
  ): FinancialBilan => {
    const periodMode = options?.periodType || (period.includes('Du ') ? 'PERIODIC' : 'GLOBAL');
    const startDate = options?.startDate;
    const endDate = options?.endDate;

    const computed = computeBilanData({
      declarations,
      withdrawals,
      periodMode,
      startDate,
      endDate,
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const fullDate = `${dateStr} à ${timeStr}`;

    const newBilan: FinancialBilan = {
      id: 'BILAN-' + Date.now(),
      title,
      period,
      periodType: periodMode,
      startDate: startDate || '',
      endDate: endDate || '',
      totalIn: computed.totalIn,
      totalOut: computed.totalOut,
      totalBalance: computed.totalSolde,
      balances: computed.balances,
      summary,
      date: dateStr,
      status: 'PENDING_PAYOR',
      treasurerSignatureDate: fullDate,
      sentToSecretariat: false,
      sentToCom: false,
      ackByCom: false,
      archivedBySecretariat: false,
    };
    setDoc(doc(db, 'secretary_bilans', newBilan.id), sanitizeFirestore(newBilan)).catch(console.warn);
    setBilans(prev => [newBilan, ...prev]);
    return newBilan;
  };

  const approveBilanPayor = (bilanId: string) => {
    const now = new Date();
    const fullDate = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    const updates = {
      status: 'APPROVED_PAYOR' as const,
      payorSignatureDate: fullDate,
      sentToSecretariat: true,
      sentToCom: false,
      ackByCom: false,
      archivedBySecretariat: false,
    };
    setDoc(doc(db, 'secretary_bilans', bilanId), updates, { merge: true }).catch(console.warn);
    setBilans(prev =>
      prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b))
    );
  };

  const updateFinancialBilan = (bilanId: string, updates: Partial<FinancialBilan>) => {
    const target = bilans.find(b => b.id === bilanId);
    let finalUpdates = { ...updates };
    if (updates.period || updates.startDate || updates.endDate || updates.periodType) {
      const merged = { ...target, ...updates };
      const periodParams = extractBilanPeriodParams(merged);
      const computed = computeBilanData({
        declarations,
        withdrawals,
        periodMode: periodParams.periodMode,
        startDate: periodParams.startDate,
        endDate: periodParams.endDate,
        maxDate: merged.date,
      });
      finalUpdates = {
        ...finalUpdates,
        periodType: periodParams.periodMode,
        startDate: periodParams.startDate || '',
        endDate: periodParams.endDate || '',
        totalIn: computed.totalIn,
        totalOut: computed.totalOut,
        totalBalance: computed.totalSolde,
        balances: computed.balances,
      };
    }
    setDoc(doc(db, 'secretary_bilans', bilanId), sanitizeFirestore(finalUpdates), { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...finalUpdates } : b)));
  };

  const returnBilanForCorrectionPayor = (bilanId: string, feedback: string) => {
    const updates = {
      status: 'returned_for_correction' as const,
      payorFeedback: feedback,
    };
    setDoc(doc(db, 'secretary_bilans', bilanId), updates, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b)));
  };

  const deleteFinancialBilan = (bilanId: string) => {
    deleteDoc(doc(db, 'secretary_bilans', bilanId)).catch(console.warn);
    setBilans(prev => prev.filter(b => b.id !== bilanId));
  };

  const sendBilanToSecretariat = (bilanId: string) => {
    setDoc(doc(db, 'secretary_bilans', bilanId), { sentToSecretariat: true }, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, sentToSecretariat: true } : b)));
  };

  const sendBilanFromSecretariatToCom = (bilanId: string) => {
    setDoc(doc(db, 'secretary_bilans', bilanId), { sentToCom: true }, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, sentToCom: true } : b)));
  };

  const ackBilanCOM = (bilanId: string) => {
    setDoc(doc(db, 'secretary_bilans', bilanId), { ackByCom: true, status: 'ACK_COM_RECU' }, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ackByCom: true, status: 'ACK_COM_RECU' as const } : b)));
  };

  const publishBilanNewsCOM = (bilanId: string) => {
    setDoc(doc(db, 'secretary_bilans', bilanId), { publishedByCom: true }, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, publishedByCom: true } : b)));
    const targetBilan = bilans.find(b => b.id === bilanId);
    if (targetBilan) {
      publishNews(
        `📢 NOUVEAU DOCUMENT OFFICIEL DISPONIBLE`,
        `Le Bilan Financier Global a été validé par la Présidence et la Trésorerie. Il est disponible et consultable dans le Coffre-Fort / Archives Officieuses.`,
        'ANNONCE',
        'TOUS',
        'COM / SECRÉTARIAT',
        'APP',
        'ARCHIVES',
        targetBilan.id
      );
    }
  };

  const ackAndPublishBilanCOM = (bilanId: string) => {
    ackBilanCOM(bilanId);
    publishBilanNewsCOM(bilanId);
  };

  const archiveBilanSecretariat = (bilanId: string) => {
    setDoc(doc(db, 'secretary_bilans', bilanId), { archivedBySecretariat: true, status: 'ARCHIVED' }, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, archivedBySecretariat: true, status: 'ARCHIVED' as const } : b)));
    const targetBilan = bilans.find(b => b.id === bilanId);
    if (targetBilan) {
      const arch: ArchiveDoc = {
        id: 'ARCH-BILAN-' + targetBilan.id,
        title: 'Bilan Financier (Global (Intégralité des données))',
        type: 'BILAN_FINANCIER',
        content: `Document Officiel Bi-Signé • Archivé\n\nSynthèse financière certifiée par le Trésorier Général et le Payor.`,
        author: 'TRÉSORIER & PAYOR',
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'ARCHIVED',
        ackByCom: true,
        sentToComBySecretariat: true,
        archivedBySecretariat: true,
      };
      setDoc(doc(db, 'archive_docs', arch.id), sanitizeFirestore(arch)).catch(console.warn);
      setArchiveDocs(prev => [...prev.filter(a => a.id !== arch.id), arch]);
    }
  };

  const updateMemberAvatar = async (memberId: string, avatarDataUrl: string): Promise<boolean> => {
    try {
      // 1. SAUVEGARDE DE LA PHOTO DANS FIRESTORE
      // Écrit photoUrl et avatar pour assurer la compatibilité ascendante
      const memberRef = doc(db, 'members', memberId);
      await setDoc(
        memberRef,
        {
          photoUrl: avatarDataUrl,
          avatar: avatarDataUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Mise à jour de la liste locale des membres
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { ...m, avatar: avatarDataUrl, photoUrl: avatarDataUrl }
            : m
        )
      );

      // 3. Mise à jour du state local de l'utilisateur connecté et persistance en session
      setCurrentUser(prev => {
        if (prev && prev.type === 'MEMBER' && prev.member && prev.member.id === memberId) {
          const updatedMember = {
            ...prev.member,
            avatar: avatarDataUrl,
            photoUrl: avatarDataUrl,
          };
          try {
            localStorage.setItem(
              EROUAMA_ACTIVE_SESSION_KEY,
              JSON.stringify({ ...prev, member: updatedMember })
            );
          } catch (e) {
            console.warn('Erreur persistance session localStorage:', e);
          }
          return {
            ...prev,
            member: updatedMember,
          };
        }
        return prev;
      });

      return true;
    } catch (err) {
      console.error('Erreur updateMemberAvatar dans Firestore:', err);
      return false;
    }
  };

  // 1. PRESERVATION DE LA PHOTO DANS LES MISES À JOUR (UPDATE) :
  // Dans les fonctions de mise à jour d'un membre (updateMember, saveProfile, editUser, updateMemberProfile) :
  // Assure-toi de fusionner la nouvelle photo avec l'ancienne valeur si aucune nouvelle image n'est choisie lors de l'édition :
  const updateMember = async (
    memberId: string,
    formFields: Partial<RouamaMember> & { newPhotoBase64?: string; [key: string]: any }
  ): Promise<boolean> => {
    try {
      const existingMemberData = (members.find(m => m.id === memberId) ||
        (currentUser?.type === 'MEMBER' && (currentUser.member?.id === memberId || currentUser.id === memberId) ? currentUser.member : {}) ||
        {}) as RouamaMember;

      const newPhotoBase64 = formFields.newPhotoBase64 || formFields.photoUrl || formFields.avatar;
      const preservedPhoto = newPhotoBase64 || existingMemberData.photoUrl || existingMemberData.avatar || '';

      const updatedData: any = {
        ...existingMemberData,
        ...formFields,
        photoUrl: preservedPhoto,
        avatar: preservedPhoto,
        updatedAt: new Date().toISOString(),
      };
      delete updatedData.newPhotoBase64;

      // Synchronisation stricte de pinCode et pin
      if (formFields.pin !== undefined || formFields.pinCode !== undefined) {
        const rawPin = formFields.pinCode !== undefined ? formFields.pinCode : formFields.pin;
        const cleanPin = rawPin !== null && rawPin !== undefined ? String(rawPin).trim() : '';
        updatedData.pin = cleanPin;
        updatedData.pinCode = cleanPin;
        if (cleanPin) {
          updatedData.isRegistered = true;
          updatedData.statut = 'Activé';
        }
      }

      // 2. SAUVEGARDE PROPRE DANS FIRESTORE :
      // Utilise updateDoc ou setDoc(docRef, updatedData, { merge: true }) pour préserver tous les champs non modifiés (notamment photoUrl / avatar)
      const memberRef = doc(db, 'members', memberId);
      const cleaned = sanitizeFirestore(updatedData);

      try {
        await updateDoc(memberRef, cleaned);
      } catch {
        await setDoc(memberRef, cleaned, { merge: true });
      }

      // Synchronisation miroir propre dans 'users'
      try {
        await updateDoc(doc(db, 'users', memberId), cleaned);
      } catch (e) {
        await setDoc(doc(db, 'users', memberId), cleaned, { merge: true });
      }

      // Mise à jour synchrone du state global members
      setMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, ...updatedData } : m))
      );

      // Si l'utilisateur connecté est ce membre, mettre à jour la session active
      setCurrentUser(prev => {
        if (prev?.type === 'MEMBER' && (prev.member?.id === memberId || prev.id === memberId)) {
          const updatedMember = { ...(prev.member || {}), ...updatedData };
          try {
            localStorage.setItem(
              EROUAMA_ACTIVE_SESSION_KEY,
              JSON.stringify({ ...prev, member: updatedMember })
            );
            localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
          } catch (e) {}
          return { ...prev, member: updatedMember };
        }
        return prev;
      });

      return true;
    } catch (err) {
      console.error('Erreur updateMember dans Firestore:', err);
      return false;
    }
  };

  const saveProfile = updateMember;
  const editUser = updateMember;
  const updateMemberProfile = updateMember;

  const assignMemberRole = (memberId: string, role?: AdminRole) => {
    setDoc(doc(db, 'users', memberId), { assignedRole: role || null }, { merge: true }).catch(console.warn);
    setDoc(doc(db, 'members', memberId), { assignedRole: role || null }, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, assignedRole: role } : m))
    );
  };

  const resetMemberPin = (memberId: string) => {
    const resetPayload = { pin: null, pinCode: null, isRegistered: false, statut: 'En attente', updatedAt: new Date().toISOString() };
    setDoc(doc(db, 'users', memberId), resetPayload, { merge: true }).catch(console.warn);
    setDoc(doc(db, 'members', memberId), resetPayload, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, pin: undefined, pinCode: undefined, isRegistered: false, statut: 'En attente' } : m))
    );
    try {
      const currentList = getStoredRegisteredUsers();
      const filtered = currentList.filter(u => u.id !== memberId);
      localStorage.setItem(EROUAMA_REGISTERED_USERS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to reset member pin in localStorage', e);
    }
  };

  // =========================================================
  // GESTION DU SUIVI DU PROGRAMME & ALERTES (SDP)
  // =========================================================
  const addProgrammeTask = async (taskData: Omit<ProgrammeTask, 'id' | 'createdAt'>): Promise<{ success: boolean; id: string }> => {
    const id = `TASK-${Date.now()}`;
    const newTask: ProgrammeTask = {
      ...taskData,
      id,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'programme_tasks', id), sanitizeFirestore(newTask), { merge: true });
      setProgrammeTasks(prev => {
        const next = [...prev.filter(t => t.id !== id), newTask];
        return next.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
      });
      return { success: true, id };
    } catch (err) {
      console.warn('Erreur addProgrammeTask:', err);
      return { success: false, id: '' };
    }
  };

  const updateProgrammeTask = async (taskId: string, updates: Partial<ProgrammeTask>): Promise<{ success: boolean }> => {
    try {
      await updateDoc(doc(db, 'programme_tasks', taskId), sanitizeFirestore(updates));
      setProgrammeTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, ...updates } : t))
      );
      return { success: true };
    } catch (err) {
      console.warn('Erreur updateProgrammeTask:', err);
      return { success: false };
    }
  };

  const deleteProgrammeTask = async (taskId: string): Promise<{ success: boolean }> => {
    try {
      await deleteDoc(doc(db, 'programme_tasks', taskId));
      setProgrammeTasks(prev => prev.filter(t => t.id !== taskId));
      return { success: true };
    } catch (err) {
      console.warn('Erreur deleteProgrammeTask:', err);
      return { success: false };
    }
  };

  const createProgrammeAlert = async (alertData: Omit<ProgrammeAlert, 'id' | 'sentAt' | 'status'>): Promise<{ success: boolean; id: string }> => {
    const id = `ALERT-${Date.now()}`;
    const newAlert: ProgrammeAlert = {
      ...alertData,
      id,
      status: 'PENDING',
      sentAt: new Date().toISOString(),
      sentBy: 'Chargé du Suivi du Programme (SDP)',
    };
    try {
      await setDoc(doc(db, 'programme_alerts', id), sanitizeFirestore(newAlert), { merge: true });
      setProgrammeAlerts(prev => [newAlert, ...prev.filter(a => a.id !== id)]);

      if (alertData.taskId) {
        const existingTask = programmeTasks.find(t => t.id === alertData.taskId);
        if (existingTask) {
          const remCount = (existingTask.remindersCount || 0) + 1;
          const taskUpdates: Partial<ProgrammeTask> = {
            remindersCount: remCount,
            lastReminderSentAt: new Date().toISOString(),
          };
          if (existingTask.status !== 'COMPLETED') {
            taskUpdates.status = 'WARNING';
          }
          await updateDoc(doc(db, 'programme_tasks', alertData.taskId), sanitizeFirestore(taskUpdates));
          setProgrammeTasks(prev => prev.map(t => (t.id === alertData.taskId ? { ...t, ...taskUpdates } : t)));
        }
      }
      return { success: true, id };
    } catch (err) {
      console.warn('Erreur createProgrammeAlert:', err);
      return { success: false, id: '' };
    }
  };

  const resolveProgrammeAlert = async (alertId: string): Promise<{ success: boolean }> => {
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'programme_alerts', alertId), {
        status: 'RESOLVED',
        resolvedAt: nowIso,
      });
      setProgrammeAlerts(prev =>
        prev.map(a => (a.id === alertId ? { ...a, status: 'RESOLVED', resolvedAt: nowIso } : a))
      );
      return { success: true };
    } catch (err) {
      console.warn('Erreur resolveProgrammeAlert:', err);
      return { success: false };
    }
  };

  // =========================================================================
  // DEMANDES D'INFORMATION INTER-ADMINISTRATIONS (MESSAGERIE B2B)
  // =========================================================================
  const createInfoRequest = async (
    req: Omit<InfoRequest, 'id' | 'createdAt' | 'status' | 'isRead'>
  ): Promise<{ success: boolean; id?: string; message: string }> => {
    try {
      const id = 'REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const nowIso = new Date().toISOString();
      const newReq: InfoRequest = {
        ...req,
        id,
        isRead: false,
        status: 'En attente',
        replyMessage: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(doc(db, 'info_requests', id), sanitizeFirestore(newReq));
      setInfoRequests(prev => [newReq, ...prev.filter(r => r.id !== id)]);

      // Notification Push FCM envoyée au rôle / département destinataire
      dispatchPushNotification({
        title: `E-ROUAMA : ${req.senderRoleLabel || req.senderRole}`,
        body: `Demande d'information : "${req.subject}"\n${req.message.substring(0, 100)}...`,
        senderRole: req.senderRole,
        senderName: req.senderName,
        targetRole: req.recipientRole,
        targetDepartment: req.recipientRole,
        type: 'INFO_REQUEST',
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);

      return { success: true, id, message: "Demande d'information transmise avec succès." };
    } catch (err: any) {
      console.warn("Erreur createInfoRequest:", err);
      return { success: false, message: err?.message || "Erreur lors de l'envoi de la demande." };
    }
  };

  const replyInfoRequest = async (
    id: string,
    replyMessage: string,
    replierName: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const nowIso = new Date().toISOString();
      const updates = {
        replyMessage: replyMessage.trim(),
        status: 'Répondu',
        isRead: true,
        repliedAt: nowIso,
        repliedBy: replierName,
        updatedAt: nowIso,
      };
      await updateDoc(doc(db, 'info_requests', id), sanitizeFirestore(updates));
      setInfoRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, ...updates } : r))
      );

      // Notification Push FCM envoyée en réponse au demandeur
      const targetReq = infoRequests.find(r => r.id === id);
      dispatchPushNotification({
        title: `E-ROUAMA : ${replierName}`,
        body: `Réponse à "${targetReq?.subject || 'Demande d\'information'}" : ${replyMessage.substring(0, 100)}...`,
        senderRole: replierName,
        senderName: replierName,
        targetRole: targetReq ? targetReq.senderRole : 'ALL',
        targetDepartment: targetReq ? targetReq.senderRole : 'ALL',
        type: 'INFO_REQUEST',
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);

      return { success: true, message: "Réponse transmise avec succès au département demandeur." };
    } catch (err: any) {
      console.warn("Erreur replyInfoRequest:", err);
      return { success: false, message: err?.message || "Erreur lors de l'envoi de la réponse." };
    }
  };

  const markInfoRequestRead = async (id: string): Promise<{ success: boolean }> => {
    try {
      await updateDoc(doc(db, 'info_requests', id), { isRead: true, updatedAt: new Date().toISOString() });
      setInfoRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, isRead: true } : r))
      );
      return { success: true };
    } catch (err) {
      console.warn("Erreur markInfoRequestRead:", err);
      return { success: false };
    }
  };

  const deleteInfoRequest = async (id: string): Promise<{ success: boolean }> => {
    try {
      await deleteDoc(doc(db, 'info_requests', id));
      setInfoRequests(prev => prev.filter(r => r.id !== id));
      return { success: true };
    } catch (err) {
      console.warn("Erreur deleteInfoRequest:", err);
      return { success: false };
    }
  };

  const updateVerseOfTheDay = (verse: string, reference?: string) => {
    const updated: VerseOfTheDay = {
      verse,
      reference,
      date: new Date().toLocaleDateString('fr-FR'),
      updatedBy: 'SPIRITUALITÉ',
    };
    setDoc(doc(db, 'spiritual', 'verse'), sanitizeFirestore(updated)).catch(console.warn);
    setVerseOfTheDay(updated);

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Nouveauté Spiritualité',
      body: reference ? `${reference} : "${verse.substring(0, 80)}..."` : verse.substring(0, 80),
      senderRole: 'SPIRITUALITE',
      senderName: 'Commission Spiritualité',
      targetRole: 'ALL',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  const addPrayerIntention = (intention: string, memberNickname?: string, isChain: boolean = false) => {
    const newIntention: PrayerIntention = {
      id: 'PRAYER-' + Date.now(),
      memberNickname: memberNickname || (currentUser?.member?.nickname || 'Membre Rouama'),
      intention,
      date: new Date().toLocaleDateString('fr-FR'),
      isChain,
    };
    setDoc(doc(db, 'prayer_intentions', newIntention.id), sanitizeFirestore(newIntention)).catch(console.warn);
    setPrayerIntentions(prev => [newIntention, ...prev]);
  };

  const createReligiousEvent = (
    eventData: Omit<ReligiousEvent, 'id' | 'publishedAt'>,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'GENERAL'
  ) => {
    const newEvt: ReligiousEvent = {
      ...eventData,
      id: 'REL-EVT-' + Date.now(),
      publishedAt: new Date().toLocaleDateString('fr-FR'),
    };
    setDoc(doc(db, 'religious_events', newEvt.id), sanitizeFirestore(newEvt)).catch(console.warn);
    setReligiousEvents(prev => [newEvt, ...prev]);

    const title = `[ÉVÉNEMENT RELIGIEUX] ${eventData.title}`;
    const content = `Date: ${eventData.eventDate} à ${eventData.eventTime}\nLieu: ${eventData.location}${eventData.theme ? `\nThème: ${eventData.theme}` : ''}`;
    publishNews(title, content, 'ANNONCE', 'TOUS', 'SPIRITUALITÉ', dispatchChannel);

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Nouveauté Spiritualité',
      body: eventData.title,
      senderRole: 'SPIRITUALITE',
      senderName: 'Commission Spiritualité',
      targetRole: 'ALL',
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: '/',
    }).catch(console.warn);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        members,
        adminUsers,
        fundBalances,
        declarations,
        transactions,
        withdrawals,
        newsItems,
        gbairaiMessages: newsItems,
        activities,
        projects,
        financialEvents,
        archiveDocs,
        pvs,
        bilans,
        isFirebaseConnected,
        programmeTasks,
        programmeAlerts,
        adminLogs,
        logAdminConnection,
        addProgrammeTask,
        updateProgrammeTask,
        deleteProgrammeTask,
        createProgrammeAlert,
        resolveProgrammeAlert,
        infoRequests,
        createInfoRequest,
        replyInfoRequest,
        markInfoRequestRead,
        deleteInfoRequest,
        verseOfTheDay,
        prayerIntentions,
        religiousEvents,
        updateVerseOfTheDay,
        addPrayerIntention,
        createReligiousEvent,
        setCurrentUser,
        switchWorkspace,
        registerMember,
        loginMember,
        loginAdmin,
        updateAdminCredentials,
        updateAdminPassword,
        logout,
        getMemberDuesStatus,
        getMemberDuesDetail,
        getMemberRubricProgress,
        getActiveFinancialEvent,
        getActiveAgrProject,
        getAllMembersRubricSummary,
        declarePayment,
        submitReceipt,
        approvePayment,
        validateCotisation,
        syncMemberProfileCotisation,
        rejectPayment,
        hideReceipt,
        deleteReceipt,
        deleteTransaction,
        addExtraCaisseEntry,
        addProjectProfitEntry,
        updateExtraCaisseEntry,
        cancelExtraCaisseEntry,
        createWithdrawalRequest,
        approveWithdrawal,
        rejectWithdrawal,
        publishNews,
        deleteNewsItem,
        dismissNewsForMember,
        markNewsAsRead,
        markAllGbairaiAsRead,
        createActivity,
        updateActivity,
        deleteActivity,
        approveActivityPayor,
        approveActivityBudgetTresorier,
        createFinancialEvent,
        archiveFinancialEvent,
        deleteFinancialEvent,
        createProject,
        updateProject,
        deleteProject,
        approveProjectPayor,
        returnProjectForCorrectionPayor,
        assessProjectTresorier,
        publishProject,
        archiveProject,
        createSecretaryPV,
        updateSecretaryPV,
        returnPVForCorrectionPayor,
        deleteSecretaryPV,
        approvePVPayor,
        publishPVCOM,
        createFinancialBilan,
        updateFinancialBilan,
        returnBilanForCorrectionPayor,
        deleteFinancialBilan,
        approveBilanPayor,
        sendBilanToSecretariat,
        sendBilanFromSecretariatToCom,
        ackBilanCOM,
        publishBilanNewsCOM,
        ackAndPublishBilanCOM,
        archiveBilanSecretariat,
        broadcastCerveauAlert,
        assignMemberRole,
        resetMemberPin,
        updateMemberAvatar,
        updateMember,
        saveProfile,
        editUser,
        updateMemberProfile,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
