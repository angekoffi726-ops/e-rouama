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
  DEFAULT_GBAIRAI_NEWS,
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
  InfoRequestMessage,
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
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  arrayUnion,
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
  recordAdminActivity: (role: string, memberName?: string, userId?: string) => Promise<void>;
  addProgrammeTask: (task: Omit<ProgrammeTask, 'id' | 'createdAt'>) => Promise<{ success: boolean; id: string }>;
  updateProgrammeTask: (taskId: string, updates: Partial<ProgrammeTask>) => Promise<{ success: boolean }>;
  deleteProgrammeTask: (taskId: string) => Promise<{ success: boolean }>;
  createProgrammeAlert: (alert: Omit<ProgrammeAlert, 'id' | 'sentAt' | 'status'>) => Promise<{ success: boolean; id: string }>;
  resolveProgrammeAlert: (alertId: string) => Promise<{ success: boolean }>;

  // Navette d'Échange Inter-Admins (Fils de discussion continus - info_requests)
  infoRequests: InfoRequest[];
  createInfoRequest: (
    req: Omit<InfoRequest, 'id' | 'createdAt' | 'status' | 'isRead'>
  ) => Promise<{ success: boolean; id?: string; message: string }>;
  replyInfoRequest: (
    id: string,
    replyMessage: string,
    replierName: string,
    replierRole?: string,
    replierRoleLabel?: string
  ) => Promise<{ success: boolean; message: string }>;
  closeInfoRequest: (
    id: string,
    closedBy: string,
    reopen?: boolean
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
  saveReligiousEventDraft: (event: Omit<ReligiousEvent, 'id' | 'publishedAt' | 'status' | 'createdAt'>) => Promise<string>;
  publishReligiousEventToGbairai: (eventId: string, dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL') => Promise<void>;
  updateReligiousEvent: (eventId: string, data: Partial<Omit<ReligiousEvent, 'id'>>) => Promise<void>;
  deleteReligiousEvent: (eventId: string) => Promise<void>;

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
  markNewsAsRead: (newsId: string, specificMemberId?: string) => void;

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
  markAllGbairaiAsRead: (specificMemberId?: string) => Promise<void> | void;
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
  refreshTreasury: () => Promise<void>;
  refreshNavette: () => Promise<void>;
  isRefreshingData: boolean;
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
          return { type: 'MEMBER', activeView: 'MEMBER', id: parsed.id, member: parsed };
        }
        if (parsed && parsed.type === 'MEMBER' && parsed.member?.id && !parsed.id) {
          parsed.id = parsed.member.id;
        }
        // Sécurité stricte : refuser toute session sans membre authentifié
        if (!parsed || (!parsed.member?.id && !parsed.id && !parsed.firstName)) {
          return null;
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

  // 2. PRÉSERVATION DES SOLDES EN LOCAL (CACHE / PERSISTENCE LOCALSTORAGE)
  // RÈGLE ABSOLUE : Ne JAMAIS réinitialiser les soldes à 0 F CFA lors d'une erreur de réseau ou de quota.
  // Conserver impérativement la dernière valeur connue en mémoire et en cache local.
  const EROUAMA_FUND_BALANCES_KEY = 'erouama_cached_fund_balances_v1';
  const getInitialFundBalances = (): Record<FundType, number> => {
    try {
      const raw = localStorage.getItem(EROUAMA_FUND_BALANCES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            COTISATION: Math.max(0, Number(parsed.COTISATION) || 0),
            ANNIVERSAIRE: Math.max(0, Number(parsed.ANNIVERSAIRE) || 0),
            SOIREE_ROUAMA: Math.max(0, Number(parsed.SOIREE_ROUAMA) || 0),
            LOISIRS: Math.max(0, Number(parsed.LOISIRS) || 0),
            AGR: Math.max(0, Number(parsed.AGR) || 0),
            CAS_SOCIAUX: Math.max(0, Number(parsed.CAS_SOCIAUX) || 0),
            EXTRA: Math.max(31000, Number(parsed.EXTRA) || 0),
          };
        }
      }
    } catch {}
    return {
      COTISATION: 0,
      ANNIVERSAIRE: 0,
      SOIREE_ROUAMA: 0,
      LOISIRS: 0,
      AGR: 0,
      CAS_SOCIAUX: 0,
      EXTRA: 31000,
    };
  };

  const [fundBalances, setFundBalancesState] = useState<Record<FundType, number>>(() => getInitialFundBalances());

  const setFundBalances = (
    updater: Record<FundType, number> | ((prev: Record<FundType, number>) => Record<FundType, number>)
  ) => {
    setFundBalancesState((prev) => {
      const incoming = typeof updater === 'function' ? updater(prev) : updater;
      const updated: Record<FundType, number> = { ...prev };

      (Object.keys(prev) as FundType[]).forEach((fund) => {
        const newVal = incoming[fund];
        if (typeof newVal === 'number' && !isNaN(newVal)) {
          // Si le nouveau montant calculé est 0 alors que l'ancien solde était positif (> 0),
          // on préserve l'ancien solde (protection stricte contre les chutes à 0 F CFA)
          if (newVal === 0 && (prev[fund] || 0) > 0) {
            updated[fund] = prev[fund];
          } else {
            updated[fund] = newVal;
          }
        }
      });

      try {
        const hasPositive = Object.values(updated).some((v) => typeof v === 'number' && v > 0);
        if (hasPositive) {
          localStorage.setItem(EROUAMA_FUND_BALANCES_KEY, JSON.stringify(updated));
        }
      } catch {}

      return updated;
    });
  };
  const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const withdrawalsRef = useRef<WithdrawalRequest[]>([]);
  const treasuryLoaderRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const gbairaiLoaderRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const navetteLoaderRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [newsItems, setNewsItems] = useState<NewsItem[]>(DEFAULT_GBAIRAI_NEWS);
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

  // Sauvegarder la session active locale et enregistrer automatiquement l'assiduité du jour
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify(currentUser));
        if (currentUser.type === 'MEMBER' && currentUser.member) {
          localStorage.setItem('rouama_user', JSON.stringify(currentUser.member));
        } else {
          localStorage.setItem('rouama_user', JSON.stringify(currentUser));
        }

        // Enregistrement automatique de présence admin pour les sessions persistantes de la veille
        try {
          if (currentUser.type === 'ADMIN' && currentUser.adminRole) {
            recordAdminActivity(currentUser.adminRole, currentUser.adminRole, currentUser.adminRole);
          } else if (currentUser.type === 'MEMBER' && currentUser.member) {
            const role = currentUser.member.assignedRole || currentUser.adminRole;
            if (role) {
              recordAdminActivity(
                role,
                `${currentUser.member.firstName || ''} (${currentUser.member.nickname || ''})`,
                currentUser.member.id
              );
            }
          }
        } catch (actErr) {
          console.warn('Enregistrement automatique présence admin ignoré:', actErr);
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

    // Mouvements officiels de référence de la Caisse Extra (Entrées & Sorties)
    const BASELINE_EXTRA_PAYMENTS = [
      {
        id: 'extra_amendes_statutaires',
        fund: 'EXTRA',
        type: 'Caisse Extra',
        caisse: 'Caisse Extra',
        subCategory: 'Caisse Extra',
        amount: 8000,
        montant: 8000,
        reason: 'Amendes',
        motif: 'Amendes',
        reference: 'Amendes statutaires',
        memberNickname: 'Trésorerie',
        memberName: 'Trésorerie E-ROUAMA',
        status: 'validated',
        isValidated: true,
        isApproved: true,
        date: '2026-10-01',
        createdAt: 1727776800000,
      },
      {
        id: 'extra_fond_carba',
        fund: 'EXTRA',
        type: 'Caisse Extra',
        caisse: 'Caisse Extra',
        subCategory: 'Caisse Extra',
        amount: 33000,
        montant: 33000,
        reason: 'Fond Carba',
        motif: 'Fond Carba',
        reference: 'Fond Carba',
        memberNickname: 'Trésorerie',
        memberName: 'Trésorerie E-ROUAMA',
        status: 'validated',
        isValidated: true,
        isApproved: true,
        date: '2026-10-05',
        createdAt: 1728122400000,
      },
    ];

    const BASELINE_EXTRA_WITHDRAWALS = [
      {
        id: 'with_extra_remboursement_leger_seka',
        fund: 'EXTRA',
        caisseSource: 'Caisse Extra',
        caisse: 'Caisse Extra',
        amount: 10000,
        montant: 10000,
        reason: 'Remboursement Léger & Seka',
        motif: 'Remboursement Léger & Seka',
        requestedBy: 'Trésorerie',
        beneficiaryName: 'Léger & Seka',
        memberNickname: 'Léger & Seka',
        status: 'APPROVED',
        isApproved: true,
        date: '2026-10-15',
        createdAt: 1728986400000,
      },
    ];

    const isDateIn18Sep22OctWindow = (dateStr?: string): boolean => {
      if (!dateStr) return false;
      const s = String(dateStr).trim();
      const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})/);
      if (m1) {
        const day = parseInt(m1[1], 10);
        const month = parseInt(m1[2], 10);
        if (month === 9 && day >= 18) return true;
        if (month === 10 && day <= 22) return true;
      }
      const m2 = s.match(/^\d{4}[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m2) {
        const month = parseInt(m2[1], 10);
        const day = parseInt(m2[2], 10);
        if (month === 9 && day >= 18) return true;
        if (month === 10 && day <= 22) return true;
      }
      return false;
    };

    // Caches internes pour le recalcul dynamique et automatique des soldes
    let receiptsCache: any[] = [];
    let paymentsCache: any[] = [];
    let declarationsCache: any[] = [];
    let transactionsCache: any[] = [];
    let treasuryBalances: Record<FundType, number> = {
      COTISATION: 0,
      ANNIVERSAIRE: 0,
      SOIREE_ROUAMA: 0,
      LOISIRS: 0,
      AGR: 0,
      CAS_SOCIAUX: 0,
      EXTRA: 31000,
    };

    const syncDynamicBalances = () => {
      const mergedMap = new Map<string, any>();
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();

      const addEntry = (item: any) => {
        if (!item || !item.id) return;
        if (seenIds.has(item.id)) return;

        const mKey = String(item.memberId || item.memberName || item.memberNickname || '').trim().toLowerCase();
        const amt = Number(item.amount) || Number(item.montant) || 0;
        const dt = String(item.date || '').trim();
        const ref = String(item.reference || item.transactionId || item.proofRef || '').trim().toLowerCase();

        if (isDateIn18Sep22OctWindow(dt)) {
          const dupKey = `${mKey}__${amt}__${dt}`;
          if (seenSignatures.has(dupKey)) return;
          seenSignatures.add(dupKey);
        } else if (ref && ref !== 'sans référence' && ref !== 'n/a') {
          const refKey = `${mKey}__${amt}__${dt}__${ref}`;
          if (seenSignatures.has(refKey)) return;
          seenSignatures.add(refKey);
        }

        seenIds.add(item.id);
        mergedMap.set(item.id, item);
      };

      // 1. Intégration formelle des encaissements de la Caisse Extra (Amendes 8 000 F CFA & Fond Carba 33 000 F CFA)
      BASELINE_EXTRA_PAYMENTS.forEach(addEntry);

      receiptsCache.forEach(r => addEntry(r));
      paymentsCache.forEach(p => addEntry(p));
      declarationsCache.forEach(d => addEntry(d));

      transactionsCache.forEach(t => {
        if (t && t.id && !seenIds.has(t.id)) {
          if (t.type === 'DEPOT' || (Number(t.amount) > 0 && !t.type?.includes('RETRAIT'))) {
            addEntry({
              id: t.id,
              amount: Number(t.amount) || 0,
              montant: Number(t.amount) || 0,
              fund: t.fund || (t.caisseType === 'extra' ? 'EXTRA' : 'COTISATION'),
              date: t.date,
              type: t.fund === 'EXTRA' || t.caisseType === 'extra' ? 'Caisse Extra' : (t.type || 'Cotisation Mensuelle'),
              caisse: t.fund === 'EXTRA' || t.caisseType === 'extra' ? 'Caisse Extra' : (t.caisse || 'Cotisation Mensuelle'),
              memberNickname: t.memberNickname || t.memberName || 'Membre',
              status: 'valide',
              isValidated: true,
              isApproved: true,
              createdAt: t.createdAt || 0,
            });
          }
        }
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
      let cotisations = validatedPayments
        .filter(p => 
          p.type === 'Cotisation Mensuelle' || 
          p.caisse === 'Cotisation Mensuelle' || 
          p.fund === 'COTISATION' || 
          (!p.type && !p.caisse && (!p.fund || p.fund === 'COTISATION')) ||
          (!p.type && !p.caisse)
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      let anniversaire = validatedPayments
        .filter(p => 
          p.type === 'Anniversaire' || 
          p.caisse === 'Anniversaire' || 
          p.fund === 'ANNIVERSAIRE' ||
          p.type === 'Célébration 21 mars (Anniversaire)' ||
          p.caisse === 'Célébration 21 mars (Anniversaire)'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      let sorties = validatedPayments
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

      let agr = validatedPayments
        .filter(p => 
          p.type === 'Projets AGR' || 
          p.caisse === 'Projets AGR' || 
          p.fund === 'AGR' ||
          p.type === 'AGR' ||
          p.caisse === 'AGR'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      let casSociaux = validatedPayments
        .filter(p => 
          p.type === 'Cas Sociaux' || 
          p.caisse === 'Cas Sociaux' || 
          p.fund === 'CAS_SOCIAUX' ||
          p.type === 'Cas Sociaux & Entraide' ||
          p.caisse === 'Cas Sociaux & Entraide'
        )
        .reduce((acc, p) => acc + (Number(p.amount) || Number(p.montant) || 0), 0);

      let extra = validatedPayments
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
        COTISATION: Math.max(treasuryBalances.COTISATION || 0, Math.max(0, cotisations - withdrawnPerFund.COTISATION)),
        ANNIVERSAIRE: Math.max(treasuryBalances.ANNIVERSAIRE || 0, Math.max(0, anniversaire - withdrawnPerFund.ANNIVERSAIRE)),
        LOISIRS: Math.max(treasuryBalances.LOISIRS || 0, Math.max(0, sorties - withdrawnPerFund.LOISIRS)),
        AGR: Math.max(treasuryBalances.AGR || 0, Math.max(0, agr - withdrawnPerFund.AGR)),
        CAS_SOCIAUX: Math.max(treasuryBalances.CAS_SOCIAUX || 0, Math.max(0, casSociaux - withdrawnPerFund.CAS_SOCIAUX)),
        SOIREE_ROUAMA: Math.max(treasuryBalances.SOIREE_ROUAMA || 0, 0),
        EXTRA: Math.max(31000, Math.max(treasuryBalances.EXTRA || 0, Math.max(0, extra - withdrawnPerFund.EXTRA))),
      };

      // RÈGLE ABSOLUE : Si aucune déclaration n'a pu être chargée (ex: quota dépassé, offline ou erreur)
      // et qu'aucun solde treasury n'est défini, NE JAMAIS réinitialiser les soldes à 0 F CFA !
      if (allDecls.length === 0 && Object.values(treasuryBalances).every(v => !v || v === 0)) {
        console.warn('⚠️ Données de caisse vides ou quota atteint : préservation intégrale des derniers soldes connus.');
        return;
      }

      setFundBalances(prev => ({
        ...prev,
        ...computed,
      }));

      // Synchronisation unifiée : l'état des déclarations reflète les données
      if (allDecls.length > 0) {
        setDeclarations(allDecls);
      }
    };

    // =========================================================================
    // 1. ARRÊT IMMÉDIAT DES LISTENERS EN BOUCLE & CHARGEMENT UNIQUE (GETDOC/GETDOCS)
    // =========================================================================

    // Chargeur Trésorerie (Treasury, Caisses, Reçus, Paiements, Déclarations, Transactions, Décaissements)
    const loadTreasury = async () => {
      try {
        let tBalances: Record<FundType, number> = {
          COTISATION: 0,
          ANNIVERSAIRE: 0,
          SOIREE_ROUAMA: 0,
          LOISIRS: 0,
          AGR: 0,
          CAS_SOCIAUX: 0,
          EXTRA: 0,
        };

        try {
          const treasurySnap = await getDoc(doc(db, 'treasury', 'balances'));
          if (treasurySnap.exists()) {
            tBalances = { ...tBalances, ...(treasurySnap.data() as any) };
          }
        } catch (e) {
          console.warn('Lecture treasury/balances (persistance cache active):', e);
        }

        try {
          const caissesSnap = await getDocs(collection(db, 'caisses'));
          const updates: Partial<Record<FundType, number>> = {};
          caissesSnap.forEach((docSnap) => {
            const d = docSnap.data();
            const idUpper = docSnap.id.toUpperCase();
            if (docSnap.id === 'balances' || docSnap.id === 'general' || docSnap.id === 'total') {
              Object.assign(updates, d);
            } else {
              let fundKey: FundType | null = null;
              if (idUpper.includes('EXTRA')) fundKey = 'EXTRA';
              else if (idUpper.includes('COTISAT')) fundKey = 'COTISATION';
              else if (idUpper.includes('ANNIV')) fundKey = 'ANNIVERSAIRE';
              else if (idUpper.includes('SOCIAU') || idUpper.includes('SOCIAL')) fundKey = 'CAS_SOCIAUX';
              else if (idUpper.includes('LOISIR') || idUpper.includes('SORTIE')) fundKey = 'LOISIRS';
              else if (idUpper.includes('AGR')) fundKey = 'AGR';
              else if (idUpper.includes('SOIREE') || idUpper.includes('ROUAMA')) fundKey = 'SOIREE_ROUAMA';
              else if (d.fund && ['COTISATION', 'ANNIVERSAIRE', 'CAS_SOCIAUX', 'LOISIRS', 'AGR', 'SOIREE_ROUAMA', 'EXTRA'].includes(d.fund)) {
                fundKey = d.fund as FundType;
              }
              const val = typeof d.solde === 'number' ? d.solde
                : typeof d.balance === 'number' ? d.balance
                : typeof d.montant === 'number' ? d.montant
                : typeof d.amount === 'number' ? d.amount
                : typeof d.total === 'number' ? d.total : null;
              if (fundKey && val !== null) {
                (updates as any)[fundKey] = val;
              }
              if (typeof d.EXTRA === 'number') updates.EXTRA = d.EXTRA;
              if (typeof d.extra === 'number') updates.EXTRA = d.extra;
              if (typeof d.caisseExtra === 'number') updates.EXTRA = d.caisseExtra;
              if (typeof d.COTISATION === 'number') updates.COTISATION = d.COTISATION;
              if (typeof d.cotisation === 'number') updates.COTISATION = d.cotisation;
            }
          });
          tBalances = { ...tBalances, ...updates };
        } catch (e) {
          console.warn('Lecture caisses (persistance cache active):', e);
        }
        treasuryBalances = tBalances;

        const [rSnap, pSnap, dSnap, tSnap, wSnap, cSnap] = await Promise.allSettled([
          getDocs(collection(db, 'receipts')),
          getDocs(collection(db, 'payments')),
          getDocs(collection(db, 'declarations')),
          getDocs(collection(db, 'transactions')),
          getDocs(collection(db, 'withdrawals')),
          getDocs(collection(db, 'cotisations')),
        ]);

        // Logging et debug des erreurs de lecture pour vérifier l'arrivée des données
        if (pSnap.status === 'fulfilled') {
          console.log("Données cotisations reçues:", pSnap.value.docs.length);
        } else if (cSnap.status === 'fulfilled') {
          console.log("Données cotisations reçues:", cSnap.value.docs.length);
        } else {
          console.log("Données cotisations reçues:", 0);
        }

        const seenDocIds = new Set<string>();

        if (rSnap.status === 'fulfilled') {
          const loaded: PaymentDeclaration[] = [];
          rSnap.value.docs.forEach((docSnap) => {
            if (seenDocIds.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') return;
            const isWilfried = data.memberId === '1' || data.memberName?.toUpperCase()?.includes('WILFRIED') || data.memberNickname?.toUpperCase()?.includes('CAPELO');
            const dateStr = String(data.date || '');
            if (isWilfried && (dateStr.includes('09/09/2026') || dateStr.includes('18/09/2026')) && (data.status === 'REJECTED' || data.isTest)) return;
            loaded.push({ ...data, id: docSnap.id });
          });
          loaded.sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0) || b.id.localeCompare(a.id));
          receiptsCache = loaded;
          setDeclarations(loaded);
        }

        if (pSnap.status === 'fulfilled') {
          const loaded: any[] = [];
          pSnap.value.docs.forEach((docSnap) => {
            if (seenDocIds.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') return;
            loaded.push({ id: docSnap.id, ...data });
          });
          paymentsCache = loaded;
        }

        if (cSnap.status === 'fulfilled') {
          const loaded: any[] = [];
          cSnap.value.docs.forEach((docSnap) => {
            if (seenDocIds.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') return;
            loaded.push({ id: docSnap.id, ...data });
          });
          if (loaded.length > 0) {
            paymentsCache = [...paymentsCache, ...loaded];
          }
        }

        if (dSnap.status === 'fulfilled') {
          const loaded: any[] = [];
          dSnap.value.docs.forEach((docSnap) => {
            if (seenDocIds.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') return;
            loaded.push({ id: docSnap.id, ...data });
          });
          declarationsCache = loaded;
        }

        if (tSnap.status === 'fulfilled') {
          const loaded: Transaction[] = [];
          tSnap.value.docs.forEach((docSnap) => {
            if (seenDocIds.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            loaded.push({ ...data, id: docSnap.id });
          });
          loaded.sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0) || b.id.localeCompare(a.id));
          transactionsCache = loaded;
          setTransactions(loaded);
        }

        if (wSnap.status === 'fulfilled') {
          const loaded: WithdrawalRequest[] = wSnap.value.docs.map((d) => ({
            ...(d.data() as any),
            id: d.id,
          }));
          const seenWIds = new Set<string>(loaded.map(w => w.id));
          BASELINE_EXTRA_WITHDRAWALS.forEach(bw => {
            if (!seenWIds.has(bw.id)) {
              loaded.push(bw as any);
              seenWIds.add(bw.id);
            }
          });
          withdrawalsRef.current = loaded;
          setWithdrawals(loaded);
        } else {
          withdrawalsRef.current = BASELINE_EXTRA_WITHDRAWALS as any;
          setWithdrawals(BASELINE_EXTRA_WITHDRAWALS as any);
        }

        syncDynamicBalances();
      } catch (err) {
        console.warn('Erreur chargement Trésorerie (cache actif):', err);
      }
    };

    // Chargeur Gbairai (News / Annonces)
    const loadGbairai = async () => {
      try {
        const newsSnap = await getDocs(collection(db, 'news'));
        const loaded: NewsItem[] = [];
        newsSnap.forEach((d) => {
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
          setNewsItems(loaded);
        } else {
          setNewsItems(DEFAULT_GBAIRAI_NEWS);
        }
      } catch (err) {
        console.warn('Erreur chargement Gbairai (cache actif):', err);
      }
    };

    // Chargeur Navette (demandes d'information & navettes inter-admins)
    const loadNavette = async () => {
      try {
        const [infoReqsSnap, navettesSnap] = await Promise.allSettled([
          getDocs(collection(db, 'info_requests')),
          getDocs(collection(db, 'navettes')),
        ]);
        const map = new Map<string, InfoRequest>();
        if (infoReqsSnap.status === 'fulfilled') {
          infoReqsSnap.value.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
        }
        if (navettesSnap.status === 'fulfilled') {
          navettesSnap.value.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
        }
        const loaded = Array.from(map.values());
        loaded.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setInfoRequests(loaded);
      } catch (err) {
        console.warn('Erreur chargement Navette (cache actif):', err);
      }
    };

    // Chargeur Membres & Utilisateurs
    let usersDocsMap = new Map<string, any>();
    let membersDocsMap = new Map<string, any>();

    const reconcileMembers = () => {
      setIsFirebaseConnected(true);
      const reconciledList: RouamaMember[] = INITIAL_ROUAMA_MEMBERS.map((official) => {
        let uDoc = usersDocsMap.get(official.id) || membersDocsMap.get(official.id);
        if (!uDoc) {
          for (const docData of [...usersDocsMap.values(), ...membersDocsMap.values()]) {
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

        const mDoc = membersDocsMap.get(official.id) || {};
        const mergedDoc = uDoc ? { ...mDoc, ...uDoc } : mDoc;

        const rawPin = mergedDoc.pinCode !== undefined
          ? mergedDoc.pinCode
          : (mergedDoc.pin !== undefined
            ? mergedDoc.pin
            : (mergedDoc.password || mergedDoc.code || official.pinCode || official.pin || ''));
        const cleanPin = rawPin && String(rawPin).trim() !== '' && String(rawPin).trim() !== 'Non défini' ? String(rawPin).trim() : '';

        const isActive = Boolean(
          (cleanPin !== '') ||
          mergedDoc.isRegistered === true ||
          mergedDoc.statut === 'Activé' ||
          official.isRegistered === true ||
          official.statut === 'Activé'
        );

        const photo =
          (typeof mergedDoc?.photoUrl === 'string' && mergedDoc.photoUrl.trim() ? mergedDoc.photoUrl.trim() : '') ||
          (typeof mergedDoc?.avatar === 'string' && mergedDoc.avatar.trim() ? mergedDoc.avatar.trim() : '') ||
          (typeof mergedDoc?.photoURL === 'string' && mergedDoc.photoURL.trim() ? mergedDoc.photoURL.trim() : '') ||
          official.photoUrl ||
          official.avatar ||
          '';

        const effectivePin = cleanPin || (isActive ? (official.pinCode || official.pin || undefined) : undefined);
        const defaultRoles = getDefaultRolesForMember(official.id, official.firstName, official.nickname);
        const memberRoles = mergedDoc?.roles || (official as any).roles || defaultRoles.roles;
        const memberDepts = mergedDoc?.departments || (official as any).departments || defaultRoles.departments;
        const memberFcmTokens = Array.isArray(mergedDoc?.fcmTokens) ? mergedDoc.fcmTokens : (mergedDoc?.fcmToken ? [mergedDoc.fcmToken] : []);

        return {
          id: official.id,
          firstName: official.firstName,
          nickname: official.nickname,
          fullRosterName: official.fullRosterName,
          phone: mergedDoc?.phone || official.phone,
          email: mergedDoc?.email || official.email || '',
          pin: effectivePin,
          pinCode: effectivePin,
          statut: isActive ? 'Activé' : 'En attente',
          isRegistered: isActive,
          avatar: photo,
          photoUrl: photo,
          assignedRole: mergedDoc?.assignedRole || official.assignedRole || defaultRoles.adminRole,
          roles: memberRoles,
          departments: memberDepts,
          fcmTokens: memberFcmTokens,
          fcmToken: mergedDoc?.fcmToken || memberFcmTokens[0] || undefined,
          resteADevoir: typeof mergedDoc?.resteADevoir === 'number' ? mergedDoc.resteADevoir : (official.resteADevoir || 0),
          totalPaid: typeof mergedDoc?.totalPaid === 'number' ? mergedDoc.totalPaid : (typeof mergedDoc?.solde === 'number' ? mergedDoc.solde : (typeof mergedDoc?.montantPaye === 'number' ? mergedDoc.montantPaye : undefined)),
          solde: typeof mergedDoc?.solde === 'number' ? mergedDoc.solde : (typeof mergedDoc?.totalPaid === 'number' ? mergedDoc.totalPaid : undefined),
          unpaidMonths: typeof mergedDoc?.unpaidMonths === 'number' ? mergedDoc.unpaidMonths : (typeof mergedDoc?.moisRetard === 'number' ? mergedDoc.moisRetard : undefined),
          moisRetard: typeof mergedDoc?.moisRetard === 'number' ? mergedDoc.moisRetard : (typeof mergedDoc?.unpaidMonths === 'number' ? mergedDoc.unpaidMonths : undefined),
          duesStatus: mergedDoc?.duesStatus || mergedDoc?.statutCotisation || undefined,
          statutCotisation: mergedDoc?.statutCotisation || mergedDoc?.duesStatus || undefined,
          statutDemande: mergedDoc?.statutDemande || undefined,
          updatedAt: mergedDoc?.updatedAt || official.updatedAt,
          lastLogin: mergedDoc?.lastLogin || official.lastLogin,
        };
      });

      setMembers(reconciledList);

      setCurrentUser((prev: any) => {
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
    };

    const loadMembersAndUsers = async () => {
      try {
        const [usersSnap, membersSnap] = await Promise.allSettled([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'members')),
        ]);
        if (usersSnap.status === 'fulfilled') {
          usersDocsMap.clear();
          usersSnap.value.forEach((docSnap) => {
            const d = docSnap.data();
            if (['TRESORIER', 'CERVEAU', 'PAYOR', 'SDP', 'ORGANISATEUR', 'ORGANISATION', 'PROJET', 'COM', 'SECRETARIAT', 'SPIRITUALITE'].includes(docSnap.id)) return;
            usersDocsMap.set(docSnap.id, { ...d, _docId: docSnap.id });
          });
        }
        if (membersSnap.status === 'fulfilled') {
          membersDocsMap.clear();
          membersSnap.value.forEach((docSnap) => {
            membersDocsMap.set(docSnap.id, { ...docSnap.data(), _docId: docSnap.id });
          });
        }
        reconcileMembers();
      } catch (err) {
        console.warn('Erreur chargement membres/users:', err);
      }
    };

    // Chargeur des autres collections
    const loadOtherCollections = async () => {
      try {
        const [actSnap, projSnap, finEventSnap, verseSnap, intentSnap, relEventSnap, pvsSnap, bilansSnap, archSnap, adminSnap, progTaskSnap, progAlertSnap, adminLogSnap] = await Promise.allSettled([
          getDocs(collection(db, 'activities')),
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'financial_events')),
          getDoc(doc(db, 'spiritual', 'verse')),
          getDocs(collection(db, 'prayer_intentions')),
          getDocs(collection(db, 'religious_events')),
          getDocs(collection(db, 'secretary_pvs')),
          getDocs(collection(db, 'secretary_bilans')),
          getDocs(collection(db, 'archive_docs')),
          getDocs(collection(db, 'admins')),
          getDocs(collection(db, 'programme_tasks')),
          getDocs(collection(db, 'programme_alerts')),
          getDocs(collection(db, 'admin_logs')),
        ]);

        if (actSnap.status === 'fulfilled') {
          const rawLoaded: EventActivity[] = [];
          actSnap.value.forEach(d => {
            const data = d.data() as any;
            let actItem: EventActivity = { id: d.id, ...data };
            // Harmonisation automatique si l'événement Soirée Rouama a conservé une date 2026 obsolète
            if (
              actItem.fixedType === 'SOIREE_ROUAMA' ||
              actItem.id === 'ACT-SOIREE-2026' ||
              actItem.id === 'ACT-SOIREE-2027' ||
              actItem.title?.toUpperCase().includes('SOIRÉE') ||
              actItem.title?.toUpperCase().includes('SOIREE')
            ) {
              if (actItem.eventDate === 'Août 2026' || actItem.eventYear === '2026' || !actItem.eventDate || actItem.eventDate.includes('2026')) {
                actItem = {
                  ...actItem,
                  title: 'SOIRÉE ROUAMA 2027',
                  eventDate: 'Août 2027',
                  eventYear: '2027',
                  eventMonth: '8',
                  eventDay: '1',
                  isDayPending: true,
                };
              }
            }
            rawLoaded.push(actItem);
          });

          // Déduplication stricte : ne conserver qu'un seul exemplaire de la Soirée Rouama et de l'Anniversaire
          const loaded: EventActivity[] = [];
          let hasSoiree = false;
          let hasAnniv = false;

          for (const item of rawLoaded) {
            const isSoiree =
              item.fixedType === 'SOIREE_ROUAMA' ||
              item.id === 'ACT-SOIREE-2027' ||
              item.id === 'ACT-SOIREE-2026' ||
              item.title?.toUpperCase().includes('SOIRÉE') ||
              item.title?.toUpperCase().includes('SOIREE');
            const isAnniv =
              item.fixedType === 'ANNIVERSAIRE' ||
              item.id === 'ACT-ANNIVERSAIRE-2027' ||
              item.title?.toUpperCase().includes('ANNIVERSAIRE');

            if (isSoiree) {
              if (hasSoiree) continue;
              hasSoiree = true;
              loaded.push({ ...item, id: item.id === 'ACT-SOIREE-2026' ? 'ACT-SOIREE-2027' : item.id });
              continue;
            }

            if (isAnniv) {
              if (hasAnniv) continue;
              hasAnniv = true;
              loaded.push(item);
              continue;
            }

            if (!loaded.some(a => a.id === item.id)) {
              loaded.push(item);
            }
          }

          if (!hasAnniv) loaded.push(DEFAULT_ANNIVERSAIRE_ACTIVITY);
          if (!hasSoiree) loaded.push(DEFAULT_SOIREE_ACTIVITY);
          loaded.sort((a, b) => b.id.localeCompare(a.id));
          setActivities(loaded);
        }

        if (projSnap.status === 'fulfilled') {
          const loaded: AgrProject[] = [];
          projSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setProjects(loaded);
        }

        if (finEventSnap.status === 'fulfilled') {
          const loaded: FinancialEvent[] = [];
          finEventSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setFinancialEvents(loaded);
        }

        if (verseSnap.status === 'fulfilled' && verseSnap.value.exists()) {
          setVerseOfTheDay(verseSnap.value.data() as VerseOfTheDay);
        }

        if (intentSnap.status === 'fulfilled') {
          const loaded: PrayerIntention[] = [];
          intentSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setPrayerIntentions(loaded);
        }

        if (relEventSnap.status === 'fulfilled') {
          const loaded: ReligiousEvent[] = [];
          relEventSnap.value.forEach(d => {
            const data = d.data() as any;
            loaded.push({
              id: d.id,
              status: data.status || (data.publishedAt ? 'PUBLISHED' : 'DRAFT'),
              publishedToGbairai: Boolean(data.publishedToGbairai || data.publishedAt),
              ...data,
            });
          });
          loaded.sort((a, b) => (b.createdAt || b.publishedAt || b.id).localeCompare(a.createdAt || a.publishedAt || a.id));
          setReligiousEvents(loaded);
        }

        if (pvsSnap.status === 'fulfilled') {
          const loaded: SecretaryPV[] = [];
          pvsSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setPvs(loaded);
        }

        if (bilansSnap.status === 'fulfilled') {
          const loaded: FinancialBilan[] = [];
          bilansSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setBilans(loaded);
        }

        if (archSnap.status === 'fulfilled') {
          const loaded: ArchiveDoc[] = [];
          archSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setArchiveDocs(loaded);
        }

        if (adminSnap.status === 'fulfilled' && !adminSnap.value.empty) {
          setAdminUsers(prev => {
            const map = new Map<string, AdminUser>();
            ADMIN_USERS.forEach(a => map.set(a.id, a));
            prev.forEach(a => map.set(a.id, a));
            adminSnap.value.forEach(d => {
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

        if (progTaskSnap.status === 'fulfilled') {
          const loaded: ProgrammeTask[] = [];
          progTaskSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setProgrammeTasks(loaded);
        }

        if (progAlertSnap.status === 'fulfilled') {
          const loaded: ProgrammeAlert[] = [];
          progAlertSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setProgrammeAlerts(loaded);
        }

        if (adminLogSnap.status === 'fulfilled') {
          const loaded: AdminLoginLog[] = [];
          adminLogSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setAdminLogs(loaded);
        }
      } catch (err) {
        console.warn('Erreur chargement autres collections:', err);
      }
    };

    // Chargement unique et propre au montage du composant
    loadTreasury();
    loadGbairai();
    loadNavette();
    loadMembersAndUsers();
    loadOtherCollections();

    // ÉCOUTEURS TEMPS RÉEL POUR GBAIRAI ET NAVETTE D'ÉCHANGE
    // Permet au Chargé au Suivi (SDP) de voir les lectures Gbairai en temps réel
    // et garantit que les messages de la Navette ne sont jamais perdus
    const unsubGbairai = onSnapshot(collection(db, 'news'), (snapshot) => {
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
        setNewsItems(loaded);
      }
    }, (err) => {
      console.warn('Erreur écouteur temps réel Gbairai:', err);
    });

    const unsubNavette = onSnapshot(collection(db, 'info_requests'), (snapshot) => {
      const map = new Map<string, InfoRequest>();
      snapshot.forEach((d) => {
        map.set(d.id, { id: d.id, ...(d.data() as any) });
      });
      const loaded = Array.from(map.values());
      loaded.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (loaded.length > 0) {
        setInfoRequests(loaded);
      }
    }, (err) => {
      console.warn('Erreur écouteur temps réel info_requests:', err);
    });

    // Écouteur temps réel pour les logs d'activité/connexions administratives
    const unsubAdminLogs = onSnapshot(collection(db, 'admin_logs'), (snapshot) => {
      const loaded: AdminLoginLog[] = [];
      snapshot.forEach((d) => {
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      loaded.sort((a, b) => (b.loginTimestamp || '').localeCompare(a.loginTimestamp || ''));
      setAdminLogs(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel admin_logs:', err);
    });

    // Écouteur temps réel pour les événements religieux (actualisation et suppression instantanées)
    const unsubReligiousEvents = onSnapshot(collection(db, 'religious_events'), (snapshot) => {
      const loaded: ReligiousEvent[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as any;
        loaded.push({
          id: d.id,
          status: data.status || (data.publishedAt ? 'PUBLISHED' : 'DRAFT'),
          publishedToGbairai: Boolean(data.publishedToGbairai || data.publishedAt),
          ...data,
        });
      });
      loaded.sort((a, b) => (b.createdAt || b.publishedAt || b.id).localeCompare(a.createdAt || a.publishedAt || a.id));
      setReligiousEvents(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel religious_events:', err);
    });

    // Références pour rafraîchissements ponctuels après création ou validation
    treasuryLoaderRef.current = loadTreasury;
    gbairaiLoaderRef.current = loadGbairai;
    navetteLoaderRef.current = loadNavette;

    return () => {
      if (unsubGbairai) unsubGbairai();
      if (unsubNavette) unsubNavette();
      if (unsubAdminLogs) unsubAdminLogs();
      if (unsubReligiousEvents) unsubReligiousEvents();
    };
  }, []);

  // CHARGEMENT AUTOMATIQUE AU RECHARGEMENT / RECONNEXION DU MEMBRE DEPUIS FIRESTORE
  // CHARGEMENT SIMPLE SANS BOUCLE DU SOLDE ET STATUTS DU MEMBRE ACTIF
  useEffect(() => {
    if (currentUser?.type === 'MEMBER' && currentUser.member?.id) {
      const currentUserId = String(currentUser.member.id).trim();
      let isMounted = true;

      const loadMemberDetails = async () => {
        try {
          const [userSnap, memberSnap, cotisationsSnap] = await Promise.allSettled([
            getDoc(doc(db, 'users', currentUserId)),
            getDoc(doc(db, 'members', currentUserId)),
            getDocs(collection(db, 'users', currentUserId, 'cotisations')),
          ]);

          if (!isMounted) return;

          let data: any = {};
          if (userSnap.status === 'fulfilled' && userSnap.value.exists()) {
            data = { ...data, ...userSnap.value.data() };
          }
          if (memberSnap.status === 'fulfilled' && memberSnap.value.exists()) {
            data = { ...data, ...memberSnap.value.data() };
          }

          if (Object.keys(data).length > 0) {
            const photo = data.photoUrl || data.avatar || data.photoURL;

            setCurrentUser((prev: any) => {
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

          if (cotisationsSnap.status === 'fulfilled' && !cotisationsSnap.value.empty && isMounted) {
            const items: any[] = [];
            cotisationsSnap.value.forEach((d) => items.push({ id: d.id, ...d.data() }));
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
        } catch (err) {
          console.warn('Erreur chargement profil membre:', err);
        }
      };

      loadMemberDetails();

      return () => {
        isMounted = false;
      };
    }
  }, [currentUser?.type, currentUser?.member?.id]);

  // Protection des données réelles : neutralisation des purges destructrices automatiques
  const resetAllData = async () => {
    console.warn("🛡️ Protection active : les données Firestore existantes (reçus, membres, caisses) sont strictement préservées.");
  };

  // Actualisation manuelle ponctuelle à la demande de l'utilisateur (Frein de secours quotas Firestore)
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  const refreshTreasury = async () => {
    setIsRefreshingData(true);
    try {
      if (treasuryLoaderRef.current) {
        await treasuryLoaderRef.current();
      }
    } catch (err) {
      console.warn('Erreur actualisation manuelle trésorerie:', err);
    } finally {
      setIsRefreshingData(false);
    }
  };

  const refreshNavette = async () => {
    setIsRefreshingData(true);
    try {
      if (navetteLoaderRef.current) {
        await navetteLoaderRef.current();
      }
    } catch (err) {
      console.warn('Erreur actualisation manuelle navette:', err);
    } finally {
      setIsRefreshingData(false);
    }
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
        setCurrentUser({ type: 'MEMBER', activeView: 'MEMBER', member: activatedMember, id: memberId });
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
    setCurrentUser({ type: 'MEMBER', activeView: 'MEMBER', member: connectedMember, id: memberId });

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

  // Enregistrement de l'activité/présence en temps réel d'un administrateur (session persistante & connexions)
  const recordAdminActivity = async (role: string, memberName?: string, userId?: string) => {
    if (!role || !role.trim()) return;
    const cleanRole = role.trim().toUpperCase().replace(/[\s-]/g, '_');
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.split('T')[0];

    try {
      // 1. Mise à jour Firestore du document admins/${cleanRole}
      await setDoc(
        doc(db, 'admins', cleanRole),
        sanitizeFirestore({
          id: cleanRole,
          role: cleanRole,
          lastAdminAccess: nowIso,
          lastLoginDate: todayStr,
          lastActiveAt: nowIso,
          updatedAt: nowIso,
          ...(memberName ? { lastActiveMemberName: memberName } : {}),
          ...(userId ? { lastActiveUserId: userId } : {}),
        }),
        { merge: true }
      ).catch(e => console.warn('Mise à jour admins doc:', e));

      // 2. Si userId ou memberId fourni, mise à jour dans users
      const targetUserId = userId || (currentUser?.type === 'MEMBER' ? currentUser.member?.id : undefined);
      if (targetUserId) {
        setDoc(
          doc(db, 'users', String(targetUserId)),
          sanitizeFirestore({
            lastAdminAccess: nowIso,
            lastLoginDate: todayStr,
            assignedRole: cleanRole,
          }),
          { merge: true }
        ).catch(() => {});
      }

      // 3. Déduplication quotidienne pour admin_logs afin d'éviter le spamming à chaque clic
      const sessionDedupKey = `erouama_admin_activity_${cleanRole}_${todayStr}`;
      const alreadyLoggedToday = sessionStorage.getItem(sessionDedupKey);

      if (!alreadyLoggedToday) {
        sessionStorage.setItem(sessionDedupKey, nowIso);
        await addDoc(
          collection(db, 'admin_logs'),
          sanitizeFirestore({
            userId: targetUserId || cleanRole,
            memberName: memberName || cleanRole,
            role: cleanRole,
            loginTimestamp: nowIso,
            dateString: todayStr,
            source: 'SESSION_ACTIVITY',
          })
        ).catch(e => console.warn('Erreur addDoc admin_logs:', e));
      }
    } catch (err) {
      console.warn('Erreur recordAdminActivity:', err);
    }
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
      await recordAdminActivity(role, memberName, userId);
    } catch (err) {
      console.warn('Erreur log connexion admin:', err);
    }
  };

  // Connexion Admin directe INTERDITE par la politique de sécurité stricte
  // Seule la connexion Membre (Prénom + Code PIN) est autorisée pour accéder à la plateforme.
  const loginAdmin = (_inputRoleOrLogin: string, _pin: string) => {
    return {
      success: false,
      message: "Connexion directe par rôle administratif désactivée. Veuillez vous connecter obligatoirement avec votre prénom officiel de membre.",
    };
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

    if (!memberId || !String(memberId).trim()) {
      return {
        status: 'RETARD',
        unpaidMonths: 0,
        totalPaid: 0,
        totalExpected: totalExpectedAmount,
      };
    }

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

    const safeMembers = Array.isArray(members) ? members : [];
    const memberDoc = safeMembers.find(m => m && String(m.id).trim() === String(memberId).trim());
    const isSurl = String(memberId).trim() === '7' || Boolean(memberDoc?.nickname?.toUpperCase()?.includes('SURL'));
    const safeDeclarations = Array.isArray(declarations) ? declarations : [];
    const calculatedPaid = isSurl ? 500 : safeDeclarations
      .filter(d => 
        d &&
        String(d.memberId).trim() === String(memberId).trim() && 
        (d.fund === 'COTISATION' || (d as any).caisse === 'Cotisation Mensuelle' || (d as any).type === 'Cotisation Mensuelle') && 
        isPaymentValidated(d)
      )
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

    const memberStoredTotalPaid = typeof memberDoc?.totalPaid === 'number' ? memberDoc.totalPaid : (typeof memberDoc?.solde === 'number' ? memberDoc.solde : 0);
    const totalPaid = isSurl ? 500 : Math.max(calculatedPaid, memberStoredTotalPaid);

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

    // EXÉCUTION ATOMIQUE VIA runTransaction :
    // 1. Vérification anti-doublon (si déjà validé, ne pas incrémenter 2 fois)
    // 2. Validation du reçu et incrémentation atomique du solde de caisse en une seule opération
    let finalBalances = { ...fundBalances };
    try {
      await runTransaction(db, async (transaction) => {
        const payDocRef = doc(db, 'payments', targetId);
        const receiptDocRef = doc(db, 'receipts', targetId);
        const balanceDocRef = doc(db, 'treasury', 'balances');

        const [paySnap, balanceSnap] = await Promise.all([
          transaction.get(payDocRef),
          transaction.get(balanceDocRef),
        ]);

        // Protection anti-doublon stricte : si déjà validé, court-circuit
        if (paySnap.exists()) {
          const payData = paySnap.data() as any;
          if (
            payData.status === 'valide' ||
            payData.status === 'validated' ||
            payData.status === 'approved' ||
            payData.isValidated === true ||
            payData.isApproved === true
          ) {
            console.log(`Reçu [${targetId}] déjà validé atomiquement sur Firestore.`);
            return;
          }
        }

        const currentBalances = balanceSnap.exists()
          ? (balanceSnap.data() as Record<string, number>)
          : { ...fundBalances };

        const targetFund = (targetDecl!.fund || 'COTISATION') as FundType;
        const currentAmount = Number(currentBalances[targetFund]) || 0;
        const newFundAmount = currentAmount + amountVal;

        const updatedBalances = {
          ...currentBalances,
          [targetFund]: newFundAmount,
        };
        finalBalances = updatedBalances as Record<FundType, number>;

        // Écritures atomiques de la transaction
        transaction.set(payDocRef, sanitizeFirestore(fullDeclPayload), { merge: true });
        transaction.set(receiptDocRef, sanitizeFirestore(fullDeclPayload), { merge: true });
        transaction.set(doc(db, 'declarations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true });
        transaction.set(balanceDocRef, sanitizeFirestore(updatedBalances), { merge: true });

        if (payerId) {
          transaction.set(doc(db, 'users', payerId, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true });
          transaction.set(doc(db, 'members', payerId, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true });
        }
        transaction.set(doc(db, 'cotisations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true });
      });
    } catch (txnErr) {
      console.warn('Erreur runTransaction dans approvePayment, repli sécurisé standard:', txnErr);
      await Promise.allSettled([
        setDoc(doc(db, 'payments', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'receipts', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
        setDoc(doc(db, 'declarations', targetId), sanitizeFirestore(fullDeclPayload), { merge: true }),
      ]);
      finalBalances = {
        ...fundBalances,
        [targetDecl.fund]: (fundBalances[targetDecl.fund] || 0) + amountVal,
      };
      await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(finalBalances), { merge: true }).catch(console.warn);
    }

    // Mise à jour immédiate du state React pour les déclarations côté interface
    setDeclarations((prev) => {
      const exists = prev.some((d) => d.id === targetId);
      if (exists) {
        return prev.map((d) => (d.id === targetId ? { ...d, ...fullDeclPayload } : d));
      }
      return [fullDeclPayload as any, ...prev];
    });

    setFundBalances(finalBalances);

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

  // Frein de secours : Les soldes de la Caisse Extra et de la trésorerie sont calculés dynamiquement
  // dans syncDynamicBalances() avec déduction des décaissements approuvés, sans écriture en boucle dans Firestore.

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

  const markNewsAsRead = (newsId: string, specificMemberId?: string) => {
    const targetMemberId = specificMemberId || currentUser?.member?.id || (currentUser as any)?.id;
    if (!targetMemberId) return;

    const targetMember = members.find(m => String(m.id) === String(targetMemberId));
    const targetNick = targetMember?.nickname || (currentUser?.member?.id === targetMemberId ? currentUser?.member?.nickname : undefined);

    const item = newsItems.find(n => n.id === newsId);
    if (item) {
      const currentRead = (item.readBy || []).map(String);
      const isAlreadyRead =
        currentRead.includes(String(targetMemberId)) ||
        (targetNick && currentRead.some(r => r.toUpperCase() === targetNick.toUpperCase()));

      if (!isAlreadyRead) {
        const toAdd = [String(targetMemberId)];
        if (targetNick) toAdd.push(targetNick);
        const updatedReadBy = Array.from(new Set([...currentRead, ...toAdd]));

        setDoc(doc(db, 'news', newsId), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
        try {
          setDoc(doc(db, 'announcements', newsId), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
        } catch (_) {}

        setNewsItems(prev =>
          prev.map(n => (n.id === newsId ? { ...n, readBy: updatedReadBy } : n))
        );
      }
    }
  };

  const markAllGbairaiAsRead = async (specificMemberId?: string): Promise<void> => {
    const targetMemberId = String(specificMemberId || currentUser?.member?.id || (currentUser as any)?.id || '').trim();
    if (!targetMemberId) return;

    const targetMember = members.find(m => String(m.id).trim() === targetMemberId);
    const targetNick = targetMember?.nickname || (currentUser?.member?.id === targetMemberId ? currentUser?.member?.nickname : undefined);
    const toAdd = [targetMemberId];
    if (targetNick) toAdd.push(targetNick);

    try {
      const readKey = `erouama_read_gbairai_${targetMemberId}`;
      const existingStored = JSON.parse(localStorage.getItem(readKey) || '[]');
      const newStored = Array.from(new Set([...existingStored, ...newsItems.map(n => n.id)]));
      localStorage.setItem(readKey, JSON.stringify(newStored));
    } catch {}

    // 1. Calcul synchrone immédiat des documents non lus à mettre à jour
    const docsToUpdate: { id: string; readBy: string[] }[] = [];
    (newsItems || []).forEach(n => {
      const currentRead = (n.readBy || []).map(r => String(r).trim());
      const isAlreadyRead =
        currentRead.includes(targetMemberId) ||
        (targetNick && currentRead.some(r => r.toUpperCase() === targetNick.toUpperCase()));

      if (!isAlreadyRead) {
        const updatedRead = Array.from(new Set([...currentRead, ...toAdd]));
        docsToUpdate.push({ id: n.id, readBy: updatedRead });
      }
    });

    // 2. Mise à jour de l'état local pour remise instantanée du compteur visuel à 0
    setNewsItems(prev => {
      return prev.map(n => {
        const found = docsToUpdate.find(u => u.id === n.id);
        if (found) {
          return { ...n, readBy: found.readBy };
        }
        const currentRead = (n.readBy || []).map(r => String(r).trim());
        const isAlreadyRead =
          currentRead.includes(targetMemberId) ||
          (targetNick && currentRead.some(r => r.toUpperCase() === targetNick.toUpperCase()));
        if (!isAlreadyRead) {
          return { ...n, readBy: Array.from(new Set([...currentRead, ...toAdd])) };
        }
        return n;
      });
    });

    // 3. Écriture immédiate dans Firestore (collections news et announcements)
    if (docsToUpdate.length > 0) {
      await Promise.allSettled(
        docsToUpdate.map(async ({ id, readBy }) => {
          try {
            await setDoc(doc(db, 'news', id), { readBy }, { merge: true });
          } catch (e) {
            console.warn(`Erreur setDoc news ${id}:`, e);
          }
          try {
            await setDoc(doc(db, 'announcements', id), { readBy }, { merge: true });
          } catch (_) {}
        })
      );
    }

    // 4. Balayage Firestore complet en arrière-plan pour garantir 100% d'exactitude
    try {
      const snap = await getDocs(collection(db, 'news'));
      const writes: Promise<any>[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.deleted === true || data.isDeleted === true || data.status === 'deleted' || data.status === 'hidden' || data.isHidden === true) return;
        const currentRead = (data.readBy || []).map((r: any) => String(r).trim());
        const isRead =
          currentRead.includes(targetMemberId) ||
          (targetNick && currentRead.some((r: string) => r.toUpperCase() === targetNick.toUpperCase()));
        if (!isRead) {
          const updatedRead = Array.from(new Set([...currentRead, ...toAdd]));
          writes.push(setDoc(doc(db, 'news', d.id), { readBy: updatedRead }, { merge: true }));
          writes.push(setDoc(doc(db, 'announcements', d.id), { readBy: updatedRead }, { merge: true }).catch(() => {}));
        }
      });
      if (writes.length > 0) {
        await Promise.allSettled(writes);
      }
    } catch (err) {
      console.warn('Erreur balayage Firestore news:', err);
    }
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
  // NAVETTE D'ÉCHANGE INTER-ADMINISTRATIONS (FILS DE DISCUSSION CONTINUS)
  // =========================================================================
  const createInfoRequest = async (
    req: Omit<InfoRequest, 'id' | 'createdAt' | 'status' | 'isRead'>
  ): Promise<{ success: boolean; id?: string; message: string }> => {
    try {
      const id = 'REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const nowIso = new Date().toISOString();
      const initialMsg: InfoRequestMessage = {
        id: 'msg_' + Date.now() + '_1',
        senderRole: req.senderRole,
        senderRoleLabel: req.senderRoleLabel || req.senderRole,
        senderName: req.senderName,
        message: req.message.trim(),
        createdAt: nowIso,
      };
      const newReq: InfoRequest = {
        ...req,
        id,
        isRead: false,
        isClosed: false,
        status: 'En attente',
        replyMessage: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [initialMsg],
      };
      await setDoc(doc(db, 'info_requests', id), sanitizeFirestore(newReq));
      setInfoRequests(prev => [newReq, ...prev.filter(r => r.id !== id)]);

      // Notification Push FCM envoyée au rôle / département destinataire
      dispatchPushNotification({
        title: `Navette d'Échange : ${req.senderRoleLabel || req.senderRole}`,
        body: `Nouvelle demande : "${req.subject}"\n${req.message.substring(0, 100)}...`,
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

      return { success: true, id, message: "Navette d'échange initiée avec succès." };
    } catch (err: any) {
      console.warn("Erreur createInfoRequest:", err);
      return { success: false, message: err?.message || "Erreur lors de l'envoi de la demande." };
    }
  };

  const replyInfoRequest = async (
    id: string,
    replyMessage: string,
    replierName: string,
    replierRole?: string,
    replierRoleLabel?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const nowIso = new Date().toISOString();
      const targetReq = infoRequests.find(r => r.id === id);

      // Reconstituer le fil chronologique existant
      const existingMessages: InfoRequestMessage[] = [];
      if (targetReq?.messages && Array.isArray(targetReq.messages) && targetReq.messages.length > 0) {
        existingMessages.push(...targetReq.messages);
      } else if (targetReq) {
        existingMessages.push({
          id: 'msg_init_' + targetReq.id,
          senderRole: targetReq.senderRole,
          senderRoleLabel: targetReq.senderRoleLabel || targetReq.senderRole,
          senderName: targetReq.senderName,
          message: targetReq.message,
          createdAt: targetReq.createdAt,
        });
        if (targetReq.replyMessage) {
          existingMessages.push({
            id: 'msg_legacy_' + targetReq.id,
            senderRole: targetReq.recipientRole,
            senderRoleLabel: targetReq.recipientRoleLabel || targetReq.recipientRole,
            senderName: targetReq.repliedBy || targetReq.recipientRoleLabel || 'Destinataire',
            message: targetReq.replyMessage,
            createdAt: targetReq.repliedAt || targetReq.updatedAt || targetReq.createdAt,
          });
        }
      }

      const roleKey = (replierRole || (targetReq ? targetReq.recipientRole : '')).toUpperCase().trim();
      const roleLabel = replierRoleLabel || replierName;

      const newMsg: InfoRequestMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        senderRole: roleKey,
        senderRoleLabel: roleLabel,
        senderName: replierName,
        message: replyMessage.trim(),
        createdAt: nowIso,
      };

      const updatedMessages = [...existingMessages, newMsg];

      // Dynamisme de statut :
      // - Si le dernier message vient de l'émetteur initial -> "En attente" (en attente du destinataire)
      // - Si le dernier message vient de l'autre département -> "Répondu" (ou "Répondu / En cours d'échange")
      const isFromOriginalSender = !!(targetReq && (
        roleKey === targetReq.senderRole.toUpperCase().trim() ||
        roleKey.includes(targetReq.senderRole.toUpperCase().trim()) ||
        targetReq.senderRole.toUpperCase().trim().includes(roleKey)
      ));

      const newStatus = isFromOriginalSender ? 'En attente' : 'Répondu';

      const updates: Partial<InfoRequest> = {
        replyMessage: replyMessage.trim(),
        status: newStatus,
        isRead: false,
        isClosed: false,
        repliedAt: nowIso,
        repliedBy: replierName,
        updatedAt: nowIso,
        messages: updatedMessages,
      };

      await updateDoc(doc(db, 'info_requests', id), sanitizeFirestore(updates));
      setInfoRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, ...updates } : r))
      );

      // Notification Push FCM envoyée à l'autre partie
      const targetRole = isFromOriginalSender
        ? (targetReq ? targetReq.recipientRole : 'ALL')
        : (targetReq ? targetReq.senderRole : 'ALL');

      dispatchPushNotification({
        title: `Navette d'Échange : ${replierName}`,
        body: `Nouveau message sur "${targetReq?.subject || 'Échange'}" : ${replyMessage.substring(0, 100)}...`,
        senderRole: replierName,
        senderName: replierName,
        targetRole,
        targetDepartment: targetRole,
        type: 'INFO_REQUEST',
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);

      return { success: true, message: "Réplique transmise avec succès dans le fil d'échange." };
    } catch (err: any) {
      console.warn("Erreur replyInfoRequest:", err);
      return { success: false, message: err?.message || "Erreur lors de l'envoi de la réplique." };
    }
  };

  const closeInfoRequest = async (
    id: string,
    closedBy: string,
    reopen: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const nowIso = new Date().toISOString();
      const updates: Partial<InfoRequest> = reopen
        ? {
            isClosed: false,
            status: 'Répondu',
            updatedAt: nowIso,
          }
        : {
            isClosed: true,
            status: 'Clôturé',
            closedAt: nowIso,
            closedBy,
            updatedAt: nowIso,
          };

      await updateDoc(doc(db, 'info_requests', id), sanitizeFirestore(updates));
      setInfoRequests(prev =>
        prev.map(r => (r.id === id ? { ...r, ...updates } : r))
      );

      return {
        success: true,
        message: reopen
          ? "Le fil de la navette d'échange a été réouvert."
          : "La navette d'échange a été marquée comme clôturée et solvabilisée.",
      };
    } catch (err: any) {
      console.warn("Erreur closeInfoRequest:", err);
      return { success: false, message: err?.message || "Erreur lors de la mise à jour de la clôture." };
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
    // Synchronisation multi-collections dans Firestore de production
    setDoc(doc(db, 'spiritual', 'verse'), sanitizeFirestore(updated)).catch(console.warn);
    setDoc(doc(db, 'spiritual', 'verse_of_the_day'), sanitizeFirestore(updated)).catch(console.warn);
    setDoc(doc(db, 'versets', 'today'), sanitizeFirestore({ ...updated, createdAt: Date.now() })).catch(console.warn);
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

  const saveReligiousEventDraft = async (
    eventData: Omit<ReligiousEvent, 'id' | 'publishedAt' | 'status' | 'createdAt'>
  ): Promise<string> => {
    const newEvt: ReligiousEvent = {
      ...eventData,
      id: 'REL-EVT-' + Date.now(),
      status: 'DRAFT',
      publishedToGbairai: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    await setDoc(doc(db, 'religious_events', newEvt.id), sanitizeFirestore(newEvt)).catch(console.warn);
    setReligiousEvents(prev => [newEvt, ...prev.filter(e => e.id !== newEvt.id)]);
    return newEvt.id;
  };

  const publishReligiousEventToGbairai = async (
    eventId: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'GENERAL'
  ) => {
    const evt = religiousEvents.find(e => e.id === eventId);
    if (!evt) return;

    const publishedDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const updatedEvt: ReligiousEvent = {
      ...evt,
      status: 'PUBLISHED',
      publishedAt: publishedDate,
      dispatchChannel,
      publishedToGbairai: true,
    };

    await setDoc(doc(db, 'religious_events', eventId), sanitizeFirestore(updatedEvt)).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? updatedEvt : e));

    const title = `[ÉVÉNEMENT RELIGIEUX] ${evt.title}`;
    const content = `Date: ${evt.eventDate} à ${evt.eventTime}\nLieu: ${evt.location}${evt.theme ? `\nThème: ${evt.theme}` : ''}`;
    publishNews(title, content, 'ANNONCE', 'TOUS', 'SPIRITUALITÉ', dispatchChannel);

    // Notification Push FCM : TOUS LES MEMBRES
    dispatchPushNotification({
      title: '📢 Événement Religieux',
      body: `${evt.title} - ${evt.eventDate} à ${evt.location}`,
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

  const updateReligiousEvent = async (
    eventId: string,
    data: Partial<Omit<ReligiousEvent, 'id'>>
  ) => {
    const existing = religiousEvents.find(e => e.id === eventId);
    const updatedEvt: ReligiousEvent = {
      ...(existing || {} as any),
      ...data,
      id: eventId,
      updatedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    try {
      await setDoc(doc(db, 'religious_events', eventId), sanitizeFirestore(updatedEvt), { merge: true });
    } catch (err) {
      console.warn('Erreur Firestore setDoc updateReligiousEvent:', err);
    }
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? updatedEvt : e));
  };

  const deleteReligiousEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'religious_events', eventId));
    } catch (err) {
      console.warn('Erreur Firestore deleteDoc religious_events:', err);
    }
    setReligiousEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const createReligiousEvent = (
    eventData: Omit<ReligiousEvent, 'id' | 'publishedAt'>,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'GENERAL'
  ) => {
    const newEvt: ReligiousEvent = {
      ...eventData,
      id: 'REL-EVT-' + Date.now(),
      status: 'PUBLISHED',
      publishedAt: new Date().toLocaleDateString('fr-FR'),
      publishedToGbairai: true,
      dispatchChannel,
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
        recordAdminActivity,
        addProgrammeTask,
        updateProgrammeTask,
        deleteProgrammeTask,
        createProgrammeAlert,
        resolveProgrammeAlert,
        infoRequests,
        createInfoRequest,
        replyInfoRequest,
        closeInfoRequest,
        markInfoRequestRead,
        deleteInfoRequest,
        verseOfTheDay,
        prayerIntentions,
        religiousEvents,
        updateVerseOfTheDay,
        addPrayerIntention,
        createReligiousEvent,
        saveReligiousEventDraft,
        publishReligiousEventToGbairai,
        updateReligiousEvent,
        deleteReligiousEvent,
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
        refreshTreasury,
        refreshNavette,
        isRefreshingData,
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
