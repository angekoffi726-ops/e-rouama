import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import {
  db,
  testFirestoreConnection,
  sanitizeFirestore,
  formatFirestoreErrorMessage,
  probeFirestoreRestStatus,
} from '../firebase';
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
  cloudSyncError: string | null;
  clearCloudSyncError: () => void;
  treasuryRegularizations: Record<string, any> | null;

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
  dismissedDemoRequestIds: string[];
  demosDisabled: boolean;
  dismissDemoInfoRequests: (ids: string[], disableAll?: boolean) => Promise<void>;

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
  sendReligiousEventToSecretariat: (eventId: string) => void;
  sendReligiousEventsBatchToSecretariat: (eventIds: string[]) => void;
  sendReligiousEventFromSecretariatToSuivi: (eventId: string) => void;
  sendReligiousEventsBatchFromSecretariatToSuivi: (eventIds: string[]) => void;
  sendReligiousEventFromSecretariatToPayor: (eventId: string) => void;
  sendReligiousEventsBatchFromSecretariatToPayor: (eventIds: string[]) => void;
  approveReligiousEventPayor: (eventId: string) => void;
  approveReligiousEventsBatchPayor: (eventIds: string[]) => void;
  returnReligiousEventForCorrectionPayor: (eventId: string, feedback: string) => void;
  returnReligiousEventsBatchForCorrectionPayor: (eventIds: string[], feedback: string) => void;
  splitReligiousEventsBatchToIndividual: (eventIds: string[]) => void;
  sendReligiousEventNoteToCom: (eventId: string) => void;
  ackReligiousEventCOM: (eventId: string) => void;
  archiveReligiousEventSecretariat: (eventId: string) => void;

  // Auth
  setCurrentUser: (userOrUpdater: any) => void;
  switchWorkspace: (view: 'MEMBER' | 'ADMIN', targetRole?: AdminRole) => void;
  activateMemberAccount: (memberId: string, extraFields?: Record<string, any>) => Promise<void>;
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
  publishActivity: (activityId: string) => void;
  sendActivityToSecretariat: (activityId: string) => void;
  sendActivitiesBatchToSecretariat: (activityIds: string[]) => void;
  sendActivityFromSecretariatToSuivi: (activityId: string) => void;
  sendActivitiesBatchFromSecretariatToSuivi: (activityIds: string[]) => void;
  sendActivityFromSecretariatToPayor: (activityId: string) => void;
  sendActivitiesBatchFromSecretariatToPayor: (activityIds: string[]) => void;
  approveActivityPayor: (activityId: string) => void;
  approveActivitiesBatchPayor: (activityIds: string[]) => void;
  returnActivityForCorrectionPayor: (activityId: string, feedback: string) => void;
  returnActivitiesBatchForCorrectionPayor: (activityIds: string[], feedback: string) => void;
  splitActivitiesBatchToIndividual: (activityIds: string[]) => void;
  sendActivityNoteToCom: (activityId: string) => void;
  ackActivityCOM: (activityId: string) => void;
  archiveActivitySecretariat: (activityId: string) => void;
  approveActivityBudgetTresorier: (activityId: string) => void;

  // Financial Events (Trésorier : Sorties & Cas Sociaux)
  createFinancialEvent: (event: Omit<FinancialEvent, 'id' | 'createdAt' | 'status'>) => void;
  archiveFinancialEvent: (eventId: string) => void;
  deleteFinancialEvent: (eventId: string) => Promise<void>;

  // Projects AGR
  createProject: (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'> & { status?: AgrProject['status'] }) => Promise<{ ok: boolean; error?: string }>;
  updateProject: (projectId: string, updates: Partial<AgrProject>) => Promise<{ ok: boolean; error?: string }>;
  deleteProject: (projectId: string) => Promise<void>;
  sendProjectToSecretariat: (projectId: string) => Promise<{ ok: boolean; error?: string }>;
  sendProjectsBatchToSecretariat: (projectIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  sendProjectFromSecretariatToSuivi: (projectId: string) => void;
  sendProjectsBatchFromSecretariatToSuivi: (projectIds: string[]) => void;
  sendProjectFromSecretariatToPayor: (projectId: string) => void;
  sendProjectsBatchFromSecretariatToPayor: (projectIds: string[]) => void;
  approveProjectPayor: (projectId: string) => void;
  approveProjectsBatchPayor: (projectIds: string[]) => void;
  returnProjectForCorrectionPayor: (projectId: string, feedback: string) => void;
  returnProjectsBatchForCorrectionPayor: (projectIds: string[], feedback: string) => void;
  splitProjectsBatchToIndividual: (projectIds: string[]) => void;
  sendProjectNoteToCom: (projectId: string) => void;
  ackProjectCOM: (projectId: string) => void;
  archiveProjectSecretariat: (projectId: string) => void;
  assessProjectTresorier: (projectId: string, feasible: boolean) => void;
  publishProject: (projectId: string) => void;
  archiveProject: (projectId: string) => void;
  sendComGbairaiAlert: (type: 'ACTIVITY' | 'PROJECT' | 'RELIGIOUS_EVENT', id: string) => void;

  createSecretaryPV: (pv: Omit<SecretaryPV, 'id' | 'status'> & { status?: SecretaryPV['status'] }) => void;
  updateSecretaryPV: (pvId: string, updates: Partial<SecretaryPV>) => void;
  sendPVFromSecretariatToPayor: (pvId: string) => void;
  returnPVForCorrectionPayor: (pvId: string, feedback: string) => void;
  deleteSecretaryPV: (pvId: string) => Promise<void>;
  approvePVPayor: (pvId: string) => void;
  archivePVSecretariat: (pvId: string) => void;
  sendPVNoteToCom: (pvId: string) => void;
  ackPVCOM: (pvId: string) => void;
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
  deleteFinancialBilan: (bilanId: string) => Promise<void>;
  approveBilanPayor: (bilanId: string) => void;
  sendBilanToSecretariat: (bilanId: string) => void;
  sendBilanFromSecretariatToPayor: (bilanId: string) => void;
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
  deleteNewsItem: (newsId: string) => Promise<void>;
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
  refreshProjects: () => Promise<{ ok: boolean; error?: string; count?: number }>;
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
  const [treasuryRegularizations, setTreasuryRegularizations] = useState<Record<string, any> | null>(null);
  const syncedPresenceKeysRef = useRef<Set<string>>(new Set());

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
  const EROUAMA_FUND_BALANCES_KEY = 'erouama_cached_fund_balances_v4';
  const getInitialFundBalances = (): Record<FundType, number> => {
    try {
      localStorage.removeItem('erouama_cached_fund_balances_v1');
      localStorage.removeItem('erouama_cached_fund_balances_v2');
      localStorage.removeItem('erouama_cached_fund_balances_v3');
      const raw = localStorage.getItem(EROUAMA_FUND_BALANCES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            COTISATION: Number(parsed.COTISATION) || 33000,
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
      COTISATION: 33000,
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
  const EROUAMA_DELETED_RECORDS_KEY = 'erouama_deleted_records_v1';
  const EROUAMA_DISMISSED_DEMO_REQS_KEY = 'erouama_dismissed_demo_reqs_v1';

  const readLocalDeletedRecords = (): {
    ids: string[];
    deletedTimestamps: Record<string, number>;
    defaultsNewsCleared: boolean;
  } => {
    try {
      const raw = localStorage.getItem(EROUAMA_DELETED_RECORDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ids: Array.isArray(parsed?.ids) ? parsed.ids : [],
          deletedTimestamps:
            parsed?.deletedTimestamps && typeof parsed.deletedTimestamps === 'object'
              ? parsed.deletedTimestamps
              : {},
          defaultsNewsCleared: Boolean(parsed?.defaultsNewsCleared),
        };
      }
    } catch {}
    return { ids: [], deletedTimestamps: {}, defaultsNewsCleared: false };
  };

  const readLocalDismissedDemos = (): { ids: string[]; disableAll: boolean } => {
    try {
      const raw = localStorage.getItem(EROUAMA_DISMISSED_DEMO_REQS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ids: Array.isArray(parsed?.ids) ? parsed.ids : [],
          disableAll: Boolean(parsed?.disableAll),
        };
      }
    } catch {}
    return { ids: [], disableAll: false };
  };

  const initialDeletedMeta = readLocalDeletedRecords();
  const deletedRecordIdsRef = useRef<Set<string>>(new Set(initialDeletedMeta.ids));
  const deletedTimestampsRef = useRef<Record<string, number>>(initialDeletedMeta.deletedTimestamps || {});
  const defaultsNewsClearedRef = useRef<boolean>(initialDeletedMeta.defaultsNewsCleared);
  const initialDemoMeta = readLocalDismissedDemos();
  const [dismissedDemoRequestIds, setDismissedDemoRequestIds] = useState<string[]>(initialDemoMeta.ids);
  const [demosDisabled, setDemosDisabled] = useState<boolean>(initialDemoMeta.disableAll);

  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const clearCloudSyncError = useCallback(() => setCloudSyncError(null), []);

  const infoRequestsMapRef = useRef<Map<string, InfoRequest>>(new Map());
  const navettesMapRef = useRef<Map<string, InfoRequest>>(new Map());
  const newsDocsMapRef = useRef<Map<string, NewsItem>>(new Map());
  const announcementsDocsMapRef = useRef<Map<string, NewsItem>>(new Map());

  const runWithTimeout = async <T,>(
    promise: Promise<T>,
    ms = 4500,
    label = 'firestore'
  ): Promise<T | null> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[Timeout] ${label} dépassé (${ms}ms) — finalisation locale sécurisée.`);
          resolve(null);
        }, ms);
      });
      return await Promise.race([promise, timeoutPromise]);
    } catch (err) {
      console.warn(`[Erreur] ${label}:`, err);
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const persistFirestoreDoc = async (
    collectionName: string,
    docId: string,
    payload: Record<string, any>,
    merge: boolean,
    label: string
  ): Promise<{ ok: boolean; error?: string }> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineMsg = 'Appareil hors-ligne : aucune modification enregistrée sur le serveur cloud.';
      setCloudSyncError(offlineMsg);
      return { ok: false, error: offlineMsg };
    }
    try {
      const docRef = doc(db, collectionName, docId);
      const cleanPayload = sanitizeFirestore(payload);
      const writePromise = merge
        ? setDoc(docRef, cleanPayload, { merge: true }).then(() => 'OK' as const)
        : setDoc(docRef, cleanPayload).then(() => 'OK' as const);
      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => {
        timer = setTimeout(() => resolve('TIMEOUT'), 5500);
      });
      const result = await Promise.race([writePromise, timeoutPromise]);
      if (result === 'OK') {
        setCloudSyncError(null);
        return { ok: true };
      }

      // Timeout SDK : le SDK Firebase retente silencieusement en cas de quota 429 ou d'absence de réseau.
      // Ne JAMAIS retourner ok=true sans confirmation serveur : sondage REST rapide pour diagnostic exact.
      const restProbe = await probeFirestoreRestStatus(collectionName, docId);
      const errMsg = !restProbe.ok && restProbe.message
        ? restProbe.message
        : `Délai d’écriture serveur dépassé (${label}) : l’enregistrement sur le serveur cloud n’a pas pu être confirmé.`;
      console.warn(`[Échec Sync Cloud] ${label} (${collectionName}/${docId}): ${errMsg}`);
      setCloudSyncError(errMsg);
      return { ok: false, error: errMsg };
    } catch (err: any) {
      let errMsg = formatFirestoreErrorMessage(err);
      if (!errMsg.includes('429') && !errMsg.includes('PERMISSION_DENIED')) {
        const restProbe = await probeFirestoreRestStatus(collectionName, docId);
        if (!restProbe.ok && restProbe.message) {
          errMsg = restProbe.message;
        }
      }
      console.warn(`[Erreur Firestore] ${label} (${collectionName}/${docId}):`, err);
      setCloudSyncError(errMsg);
      return { ok: false, error: errMsg };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const syncLocalDeletedStorage = () => {
    try {
      localStorage.setItem(
        EROUAMA_DELETED_RECORDS_KEY,
        JSON.stringify({
          ids: Array.from(deletedRecordIdsRef.current),
          deletedTimestamps: deletedTimestampsRef.current,
          defaultsNewsCleared: defaultsNewsClearedRef.current,
        })
      );
    } catch {}
  };

  const persistDeletedRecordIds = async (ids: string[], options?: { defaultsNewsCleared?: boolean }) => {
    const cleanIds = ids.filter(Boolean);
    const nowTs = Date.now();
    cleanIds.forEach(id => {
      deletedRecordIdsRef.current.add(id);
      deletedTimestampsRef.current[id] = nowTs;
    });
    if (options?.defaultsNewsCleared) {
      defaultsNewsClearedRef.current = true;
    }
    syncLocalDeletedStorage();
    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (cleanIds.length > 0) {
      payload.ids = arrayUnion(...cleanIds);
      const tsPatch: Record<string, number> = {};
      cleanIds.forEach(id => {
        tsPatch[id] = nowTs;
      });
      payload.deletedTimestamps = tsPatch;
    }
    if (defaultsNewsClearedRef.current) {
      payload.defaultsNewsCleared = true;
    }
    await runWithTimeout(
      setDoc(doc(db, 'admin', 'deleted_records_v1'), payload, { merge: true }),
      4000,
      'persistDeletedRecordIds'
    );
  };

  const unblockDeletedRecordIds = async (ids: string[]) => {
    const cleanIds = ids.filter(id => Boolean(id) && deletedRecordIdsRef.current.has(id));
    if (cleanIds.length === 0) return;
    const tsDeletePatch: Record<string, any> = {};
    cleanIds.forEach(id => {
      deletedRecordIdsRef.current.delete(id);
      delete deletedTimestampsRef.current[id];
      tsDeletePatch[id] = deleteField();
    });
    syncLocalDeletedStorage();
    await runWithTimeout(
      setDoc(
        doc(db, 'admin', 'deleted_records_v1'),
        {
          ids: arrayRemove(...cleanIds),
          deletedTimestamps: tsDeletePatch,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),
      4000,
      'unblockDeletedRecordIds'
    );
  };

  const cleanupLinkedActivityReferences = async (recordId: string) => {
    if (!recordId) return;
    const linkedNewsIds = (newsItemsRef.current || [])
      .filter(n => n.targetDocId === recordId)
      .map(n => n.id);
    const linkedTaskIds = programmeTasks
      .filter(t => t.sourceId === recordId)
      .map(t => t.id);
    const linkedAlertIds = programmeAlerts
      .filter(a => (a.taskId && linkedTaskIds.includes(a.taskId)) || a.taskId === recordId)
      .map(a => a.id);

    const extraIds = [...linkedNewsIds, ...linkedTaskIds, ...linkedAlertIds].filter(Boolean);
    if (linkedNewsIds.length > 0) {
      linkedNewsIds.forEach(nId => {
        newsDocsMapRef.current.delete(nId);
        announcementsDocsMapRef.current.delete(nId);
      });
      setNewsItems(prev => prev.filter(n => n.targetDocId !== recordId));
    }
    if (linkedTaskIds.length > 0) {
      setProgrammeTasks(prev => prev.filter(t => t.sourceId !== recordId));
    }
    if (linkedAlertIds.length > 0) {
      setProgrammeAlerts(prev => prev.filter(a => !linkedAlertIds.includes(a.id)));
    }
    if (extraIds.length > 0) {
      await persistDeletedRecordIds(extraIds);
      await runWithTimeout(
        Promise.allSettled([
          ...linkedNewsIds.map(nId => deleteDoc(doc(db, 'news', nId))),
          ...linkedNewsIds.map(nId => deleteDoc(doc(db, 'announcements', nId))),
          ...linkedTaskIds.map(tId => deleteDoc(doc(db, 'programme_tasks', tId))),
          ...linkedAlertIds.map(aId => deleteDoc(doc(db, 'programme_alerts', aId))),
        ]),
        4000,
        `cleanupLinkedActivityReferences:${recordId}`
      );
    }
  };

  const dismissDemoInfoRequests = async (ids: string[], disableAll: boolean = false) => {
    const nextIds = Array.from(new Set([...dismissedDemoRequestIds, ...ids.filter(Boolean)]));
    const nextDisableAll = Boolean(disableAll || demosDisabled || nextIds.length >= 3);
    setDismissedDemoRequestIds(nextIds);
    setDemosDisabled(nextDisableAll);
    try {
      localStorage.setItem(
        EROUAMA_DISMISSED_DEMO_REQS_KEY,
        JSON.stringify({ ids: nextIds, disableAll: nextDisableAll })
      );
    } catch {}
    try {
      const payload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (ids.length > 0) {
        payload.ids = arrayUnion(...ids);
      }
      if (nextDisableAll) {
        payload.disableAll = true;
      }
      await setDoc(doc(db, 'admin', 'dismissed_demo_requests'), payload, { merge: true });
    } catch (err) {
      console.warn('Erreur persistance dismissed_demo_requests:', err);
    }
  };

  const getInitialGbairaiNews = (): NewsItem[] => {
    if (defaultsNewsClearedRef.current) return [];
    return DEFAULT_GBAIRAI_NEWS.filter(n => !deletedRecordIdsRef.current.has(n.id));
  };

  const [newsItems, setNewsItems] = useState<NewsItem[]>(getInitialGbairaiNews);
  const newsItemsRef = useRef<NewsItem[]>(getInitialGbairaiNews());
  const membersRef = useRef<RouamaMember[]>(members);
  const currentUserRef = useRef<CurrentUser | null>(currentUser);

  useEffect(() => {
    newsItemsRef.current = newsItems;
  }, [newsItems]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const activateMemberAccount = useCallback(async (memberId: string, extraFields?: Record<string, any>): Promise<void> => {
    const cleanId = String(memberId || '').trim();
    if (!cleanId) return;
    const nowIso = new Date().toISOString();
    const official = INITIAL_ROUAMA_MEMBERS.find(m => m.id === cleanId);
    const existing = (membersRef.current || []).find(m => m.id === cleanId);

    const payload: Record<string, any> = {
      id: cleanId,
      ...(official ? {
        firstName: official.firstName,
        nickname: official.nickname,
        fullRosterName: official.fullRosterName,
        phone: existing?.phone || official.phone || '',
      } : {}),
      isRegistered: true,
      statut: 'Activé',
      resetAt: null,
      updatedAt: nowIso,
      ...(extraFields ? sanitizeFirestore(extraFields) : {}),
    };

    // Préserver le PIN existant s'il n'est pas fourni explicitement
    if (payload.pin === undefined && (existing?.pin || existing?.pinCode)) {
      const keepPin = String(existing.pinCode || existing.pin || '').trim();
      if (keepPin && keepPin !== 'Non défini') {
        payload.pin = keepPin;
        payload.pinCode = keepPin;
      }
    }

    setMembers(prev => {
      const next = prev.map(m => (m.id === cleanId ? { ...m, ...payload } : m));
      membersRef.current = next;
      return next;
    });

    setCurrentUser((prev: any) => {
      if (prev && prev.type === 'MEMBER' && prev.member && String(prev.member.id).trim() === cleanId) {
        const updatedMember = { ...prev.member, ...payload };
        try {
          localStorage.setItem(EROUAMA_ACTIVE_SESSION_KEY, JSON.stringify({ ...prev, member: updatedMember }));
          localStorage.setItem('rouama_user', JSON.stringify(updatedMember));
        } catch {}
        return { ...prev, member: updatedMember };
      }
      return prev;
    });

    try {
      await Promise.allSettled([
        setDoc(doc(db, 'users', cleanId), sanitizeFirestore(payload), { merge: true }),
        setDoc(doc(db, 'members', cleanId), sanitizeFirestore(payload), { merge: true }),
      ]);
    } catch (err) {
      console.warn('Erreur synchronisation activateMemberAccount Firestore:', err);
    }
  }, []);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [projects, setProjects] = useState<AgrProject[]>([]);
  const projectsRef = useRef<AgrProject[]>([]);
  const setProjectsSynced = useCallback(
    (updater: AgrProject[] | ((prev: AgrProject[]) => AgrProject[])) => {
      setProjects(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        projectsRef.current = next;
        return next;
      });
    },
    []
  );

  const isTargetTestBatchProject = (
    p: Partial<AgrProject> & { id: string },
    strictLegacyIdMatch = false
  ): boolean => {
    const normTitle = String(p.title || '').trim().toUpperCase();
    const docDate = String(p.dateRealisation || p.eventDate || '').trim();
    if (p.batchId === 'BATCH-PROJ-1794992532283') return true;
    if (normTitle === 'RES' && (docDate === '2027-01-02' || p.id === 'PROJ-001')) return true;
    if (normTitle === 'FER' && (docDate === '2027-02-05' || p.id === 'PROJ-002')) return true;
    if (strictLegacyIdMatch && (p.id === 'PROJ-001' || p.id === 'PROJ-002') && (!normTitle || normTitle === 'RES' || normTitle === 'FER')) {
      return true;
    }
    return false;
  };

  const evaluateProjectTombstone = (
    dId: string,
    projItem: Partial<AgrProject> & { id: string },
    strictLegacyIdMatch = false
  ): 'TEST_PURGE' | 'DELETED' | 'UNBLOCK' | 'KEEP' => {
    if (isTargetTestBatchProject(projItem, strictLegacyIdMatch)) return 'TEST_PURGE';
    if (!deletedRecordIdsRef.current.has(dId)) return 'KEEP';
    const deletedAt = deletedTimestampsRef.current[dId] || 0;
    const docTs = Number(projItem.updatedAtMs || projItem.createdAtMs || 0);
    // Ne jamais bloquer un projet légitime portant un autre titre (ex: Agriculture ROUAMA / Garba journalier)
    // s'il a été créé sans timestamp sur un ancien ID PROJ-001 / PROJ-002
    const normTitle = String(projItem.title || '').trim().toUpperCase();
    if ((dId === 'PROJ-001' || dId === 'PROJ-002') && normTitle && normTitle !== 'RES' && normTitle !== 'FER' && docTs === 0) {
      return 'UNBLOCK';
    }
    // Si aucune date de suppression précise n'est connue ou si le document serveur est plus récent, débloquer
    if (deletedAt === 0 || (docTs > 0 && docTs > deletedAt)) {
      return 'UNBLOCK';
    }
    return 'DELETED';
  };

  const sortProjectsList = (list: AgrProject[]): AgrProject[] => {
    return [...list].sort((a, b) => {
      const tsDiff = (b.createdAtMs || 0) - (a.createdAtMs || 0);
      if (tsDiff !== 0) return tsDiff;
      return (b.id || '').localeCompare(a.id || '');
    });
  };

  const reconcileActivitiesSnapshot = (rawLoaded: EventActivity[]): EventActivity[] => {
    const loaded: EventActivity[] = [];
    let hasSoiree = false;
    let hasAnniv = false;

    for (const raw of rawLoaded) {
      let item = raw;
      if (
        item.fixedType === 'SOIREE_ROUAMA' ||
        item.id === 'ACT-SOIREE-2026' ||
        item.id === 'ACT-SOIREE-2027' ||
        item.title?.toUpperCase().includes('SOIRÉE') ||
        item.title?.toUpperCase().includes('SOIREE')
      ) {
        if (item.eventDate === 'Août 2026' || item.eventYear === '2026' || !item.eventDate || item.eventDate.includes('2026')) {
          item = {
            ...item,
            title: 'SOIRÉE ROUAMA 2027',
            eventDate: 'Août 2027',
            eventYear: '2027',
            eventMonth: '8',
            eventDay: '1',
            isDayPending: true,
          };
        }
      }

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

    loaded.sort((a, b) => b.id.localeCompare(a.id));
    return loaded;
  };

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

  // Dédoublonnage et filtrage strict des événements spirituels (aucune promotion automatique vers PUBLISHED)
  const reconcileHistoricalSpiritualEvents = (currentRelEvents: ReligiousEvent[], _currentNews: NewsItem[]): ReligiousEvent[] => {
    const normalizeStr = (str?: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueResult: ReligiousEvent[] = [];
    const seenKeys = new Set<string>();

    (currentRelEvents || []).forEach(evt => {
      if (!evt) return;
      const lowerEvtTitle = (evt.title || '').toLowerCase();
      if (
        lowerEvtTitle.includes('prière rouama') ||
        lowerEvtTitle.includes('priere rouama') ||
        lowerEvtTitle.includes('saint augustin')
      ) {
        return;
      }
      const key = `${normalizeStr(evt.title)}_${normalizeStr(evt.eventDate || '')}_${evt.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueResult.push(evt);
      }
    });

    return uniqueResult.sort((a, b) => (b.createdAt || b.publishedAt || b.id).localeCompare(a.createdAt || a.publishedAt || a.id));
  };

  // Sauvegarder la session active locale (sans déclencher d'écriture Firestore en boucle)
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

  // Enregistrement automatique dédupliqué de présence admin (une seule fois par jour/rôle/session)
  useEffect(() => {
    if (!currentUser) return;
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
  }, [currentUser?.type, currentUser?.adminRole, currentUser?.member?.id, currentUser?.member?.assignedRole]);

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
      COTISATION: 33000,
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
        // Exclusion stricte du faux dépôt DOYEN (+5 000 F CFA)
        if (String(item.memberId).trim() === '10' || mKey.includes('doyen')) return;

        const amt = Number(item.amount) || Number(item.montant) || 0;
        const dt = String(item.date || '').trim();
        const ref = String(item.reference || item.transactionId || item.proofRef || '').trim().toLowerCase();

        // Déduplication stricte LE SURL uniquement dans la fenêtre du 18/09 au 22/10
        const isSurl = String(item.memberId).trim() === '7' || mKey.includes('surl') || mKey.includes('ulrich');
        if (isSurl && isDateIn18Sep22OctWindow(dt)) {
          if (seenSignatures.has('surl_locked_entry_18sep22oct')) return;
          seenSignatures.add('surl_locked_entry_18sep22oct');
        }

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
          p.fund === 'COTISATION'
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
        COTISATION: Math.max(33000, Math.max(0, cotisations - withdrawnPerFund.COTISATION)),
        ANNIVERSAIRE: Math.max(0, anniversaire - withdrawnPerFund.ANNIVERSAIRE),
        LOISIRS: Math.max(0, sorties - withdrawnPerFund.LOISIRS),
        AGR: Math.max(0, agr - withdrawnPerFund.AGR),
        CAS_SOCIAUX: Math.max(0, casSociaux - withdrawnPerFund.CAS_SOCIAUX),
        SOIREE_ROUAMA: 0,
        EXTRA: Math.max(31000, Math.max(0, extra - withdrawnPerFund.EXTRA)),
      };

      // Prise en compte immédiate des régularisations manuelles enregistrées par le Trésorier
      const activeRegs = (treasuryBalances as any)?.regularizations || {};
      (Object.keys(computed) as FundType[]).forEach(k => {
        if (activeRegs[k] && typeof activeRegs[k].amount === 'number') {
          computed[k] = activeRegs[k].amount;
        }
      });

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
            if (seenDocIds.has(docSnap.id) || deletedRecordIdsRef.current.has(docSnap.id)) return;
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
            if (seenDocIds.has(docSnap.id) || deletedRecordIdsRef.current.has(docSnap.id)) return;
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
            if (seenDocIds.has(docSnap.id) || deletedRecordIdsRef.current.has(docSnap.id)) return;
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
            if (seenDocIds.has(docSnap.id) || deletedRecordIdsRef.current.has(docSnap.id)) return;
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
            if (seenDocIds.has(docSnap.id) || deletedRecordIdsRef.current.has(docSnap.id)) return;
            seenDocIds.add(docSnap.id);

            const data = docSnap.data() as any;
            if (data.status === 'deleted' || data.isHidden === true || data.status === 'hidden') return;
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
        const [newsSnap, annSnap] = await Promise.allSettled([
          getDocs(collection(db, 'news')),
          getDocs(collection(db, 'announcements')),
        ]);
        const map = new Map<string, NewsItem>();
        const processDoc = (d: any, colName: 'news' | 'announcements') => {
          if (deletedRecordIdsRef.current.has(d.id)) {
            deleteDoc(doc(db, colName, d.id)).catch(() => {});
            return;
          }
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
          map.set(d.id, item);
        };
        if (newsSnap.status === 'fulfilled') {
          newsDocsMapRef.current.clear();
          newsSnap.value.forEach(d => {
            processDoc(d, 'news');
            if (map.has(d.id)) newsDocsMapRef.current.set(d.id, map.get(d.id)!);
          });
        }
        if (annSnap.status === 'fulfilled') {
          announcementsDocsMapRef.current.clear();
          annSnap.value.forEach(d => {
            processDoc(d, 'announcements');
            if (map.has(d.id)) announcementsDocsMapRef.current.set(d.id, map.get(d.id)!);
          });
        }
        const loaded = Array.from(map.values());
        if (loaded.length > 0) {
          loaded.sort((a, b) => b.id.localeCompare(a.id));
          setNewsItems(loaded);
          setReligiousEvents(prev => reconcileHistoricalSpiritualEvents(prev, loaded));
        } else if (!defaultsNewsClearedRef.current) {
          setNewsItems(DEFAULT_GBAIRAI_NEWS.filter(n => !deletedRecordIdsRef.current.has(n.id)));
        } else {
          setNewsItems([]);
        }
      } catch (err) {
        console.warn('Erreur chargement Gbairai (cache actif):', err);
      }
    };

    // Cache partagé en mémoire pour consolider les documents de navette (info_requests + navettes)
    const updateNavetteState = () => {
      const combined = new Map<string, InfoRequest>();
      navettesMapRef.current.forEach((v, k) => {
        if (!deletedRecordIdsRef.current.has(k)) combined.set(k, v);
      });
      infoRequestsMapRef.current.forEach((v, k) => {
        if (!deletedRecordIdsRef.current.has(k)) combined.set(k, v);
      });
      const loaded = Array.from(combined.values());
      // Tri purement côté client par createdAt décroissant sans nécessiter d'index composite Firestore
      loaded.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setInfoRequests(loaded);
    };

    // Chargeur Navette (demandes d'information & navettes inter-admins)
    const loadNavette = async () => {
      try {
        const [infoReqsSnap, navettesSnap] = await Promise.allSettled([
          getDocs(collection(db, 'info_requests')),
          getDocs(collection(db, 'navettes')),
        ]);
        if (infoReqsSnap.status === 'fulfilled') {
          infoRequestsMapRef.current.clear();
          infoReqsSnap.value.forEach((d) => {
            if (deletedRecordIdsRef.current.has(d.id)) {
              deleteDoc(doc(db, 'info_requests', d.id)).catch(() => {});
              return;
            }
            infoRequestsMapRef.current.set(d.id, { id: d.id, ...(d.data() as any) });
          });
        }
        if (navettesSnap.status === 'fulfilled') {
          navettesMapRef.current.clear();
          navettesSnap.value.forEach((d) => {
            if (deletedRecordIdsRef.current.has(d.id)) {
              deleteDoc(doc(db, 'navettes', d.id)).catch(() => {});
              return;
            }
            navettesMapRef.current.set(d.id, { id: d.id, ...(d.data() as any) });
          });
        }
        updateNavetteState();
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

        const isExplicitlyReset = Boolean(mergedDoc?.resetAt && mergedDoc?.isRegistered === false && !cleanPin);
        const hasPaidAmount =
          (typeof mergedDoc?.totalPaid === 'number' && mergedDoc.totalPaid > 0) ||
          (typeof mergedDoc?.solde === 'number' && mergedDoc.solde > 0) ||
          (typeof mergedDoc?.montantPaye === 'number' && mergedDoc.montantPaye > 0) ||
          Boolean(official.totalPaid && official.totalPaid > 0);

        const isActive = isExplicitlyReset
          ? false
          : Boolean(
              (cleanPin !== '') ||
              mergedDoc.isRegistered === true ||
              mergedDoc.statut === 'Activé' ||
              official.isRegistered === true ||
              official.statut === 'Activé' ||
              hasPaidAmount
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
          statut: isActive ? 'Activé' : "En attente d'activation",
          isRegistered: isActive,
          resetAt: mergedDoc?.resetAt || undefined,
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

      membersRef.current = reconciledList;
      setMembers(reconciledList);

      setCurrentUser((prev: any) => {
        if (prev && prev.type === 'MEMBER' && prev.member) {
          const fresh = reconciledList.find((m) =>
            m.id === prev.member!.id ||
            normalizeRosterString(m.firstName) === normalizeRosterString(prev.member!.firstName) ||
            normalizeRosterString(m.nickname) === normalizeRosterString(prev.member!.nickname)
          );
          if (fresh) {
            const prevM = prev.member;
            const photo = fresh.photoUrl || fresh.avatar || prevM.photoUrl || prevM.avatar || '';
            const hasChanged =
              (prevM.photoUrl || '') !== photo ||
              (prevM.avatar || '') !== photo ||
              prevM.statut !== fresh.statut ||
              prevM.isRegistered !== fresh.isRegistered ||
              prevM.assignedRole !== fresh.assignedRole ||
              prevM.pin !== fresh.pin ||
              prevM.pinCode !== fresh.pinCode ||
              prevM.phone !== fresh.phone ||
              prevM.email !== fresh.email ||
              prevM.resetAt !== fresh.resetAt ||
              prevM.resteADevoir !== fresh.resteADevoir ||
              prevM.totalPaid !== fresh.totalPaid ||
              prevM.solde !== fresh.solde ||
              prevM.unpaidMonths !== fresh.unpaidMonths ||
              prevM.duesStatus !== fresh.duesStatus ||
              prevM.statutDemande !== fresh.statutDemande ||
              JSON.stringify(prevM.roles || []) !== JSON.stringify(fresh.roles || []) ||
              JSON.stringify(prevM.departments || []) !== JSON.stringify(fresh.departments || []);

            if (!hasChanged) {
              return prev;
            }

            const updatedMember = {
              ...prevM,
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

    // Chargeur unique pour les collections SANS écouteur temps réel (spiritualité, admins)
    // et vérification unique des drapeaux de migration non encore validés localement (économie stricte du quota Firestore)
    const COMPLETED_MIGRATIONS_CACHE_KEY = 'erouama_completed_migrations_v1';
    const readMigrationsCache = (): Record<string, boolean> => {
      try {
        const raw = localStorage.getItem(COMPLETED_MIGRATIONS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {}
      return {};
    };
    const saveMigrationsCache = (patch: Record<string, boolean>) => {
      try {
        const merged = { ...readMigrationsCache(), ...patch };
        localStorage.setItem(COMPLETED_MIGRATIONS_CACHE_KEY, JSON.stringify(merged));
      } catch {}
    };

    const loadStaticCollectionsAndFlags = async () => {
      try {
        const migCache = readMigrationsCache();
        const [
          verseSnap,
          intentSnap,
          adminSnap,
          resetFlagSnap,
          purgeTestBatchSnap,
          purgeCentralisationSnap,
          regularizeGilbertSnap,
        ] = await Promise.allSettled([
          getDoc(doc(db, 'spiritual', 'verse')),
          getDocs(collection(db, 'prayer_intentions')),
          getDocs(collection(db, 'admins')),
          migCache.workflow_reset_v3
            ? Promise.resolve({ exists: () => true } as any)
            : getDoc(doc(db, 'admin', 'workflow_reset_v3')),
          migCache.purge_test_batch_1794992532283
            ? Promise.resolve({ exists: () => true } as any)
            : getDoc(doc(db, 'admin', 'purge_test_batch_1794992532283')),
          migCache.purge_centralisation_v1
            ? Promise.resolve({ exists: () => true } as any)
            : getDoc(doc(db, 'admin', 'purge_centralisation_v1')),
          migCache.regularize_gilbert_v1
            ? Promise.resolve({ exists: () => true } as any)
            : getDoc(doc(db, 'admin', 'regularize_gilbert_v1')),
        ]);

        if (verseSnap.status === 'fulfilled' && verseSnap.value.exists()) {
          setVerseOfTheDay(verseSnap.value.data() as VerseOfTheDay);
        }

        if (intentSnap.status === 'fulfilled') {
          const loaded: PrayerIntention[] = [];
          intentSnap.value.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
          setPrayerIntentions(loaded);
        }

        if (adminSnap.status === 'fulfilled' && !adminSnap.value.empty) {
          setAdminUsers(prev => {
            const map = new Map<string, AdminUser>();
            ADMIN_USERS.forEach(a => map.set(a.id, a));
            prev.forEach(a => map.set(a.id, a));
            adminSnap.value.forEach((d: any) => {
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

        if (regularizeGilbertSnap.status === 'fulfilled') {
          if (regularizeGilbertSnap.value.exists()) {
            saveMigrationsCache({ regularize_gilbert_v1: true });
          } else {
            const nowIso = new Date().toISOString();
            const gilbertFixPayload = {
              id: '10',
              firstName: 'GILBERT',
              nickname: 'DOYEN',
              fullRosterName: 'GILBERT (DOYEN)',
              phone: '2250703567992',
              isRegistered: true,
              statut: 'Activé',
              resetAt: null,
              updatedAt: nowIso,
            };
            usersDocsMap.set('10', { ...(usersDocsMap.get('10') || {}), ...gilbertFixPayload, _docId: '10' });
            membersDocsMap.set('10', { ...(membersDocsMap.get('10') || {}), ...gilbertFixPayload, _docId: '10' });
            reconcileMembers();
            Promise.allSettled([
              setDoc(doc(db, 'users', '10'), gilbertFixPayload, { merge: true }),
              setDoc(doc(db, 'members', '10'), gilbertFixPayload, { merge: true }),
            ]).then(() => {
              setDoc(doc(db, 'admin', 'regularize_gilbert_v1'), {
                completedAt: nowIso,
                memberId: '10',
                phone: '2250703567992',
                version: '2026.11.18.12',
              })
                .then(() => saveMigrationsCache({ regularize_gilbert_v1: true }))
                .catch(() => {});
            });
          }
        }

        const needsWorkflowReset =
          resetFlagSnap.status === 'fulfilled' && !resetFlagSnap.value.exists();
        const needsTestBatchPurge =
          purgeTestBatchSnap.status === 'fulfilled' && !purgeTestBatchSnap.value.exists();
        const needsCentralisationPurge =
          purgeCentralisationSnap.status === 'fulfilled' && !purgeCentralisationSnap.value.exists();

        if (resetFlagSnap.status === 'fulfilled' && resetFlagSnap.value.exists()) {
          saveMigrationsCache({ workflow_reset_v3: true });
        }
        if (purgeTestBatchSnap.status === 'fulfilled' && purgeTestBatchSnap.value.exists()) {
          saveMigrationsCache({ purge_test_batch_1794992532283: true });
        }
        if (purgeCentralisationSnap.status === 'fulfilled' && purgeCentralisationSnap.value.exists()) {
          saveMigrationsCache({ purge_centralisation_v1: true });
        }

        if (needsWorkflowReset) {
          setDoc(doc(db, 'admin', 'workflow_reset_v3'), {
            completedAt: new Date().toISOString(),
            version: '2026.11.18.3',
          })
            .then(() => saveMigrationsCache({ workflow_reset_v3: true }))
            .catch(() => {});
        }
        if (needsTestBatchPurge) {
          setDoc(doc(db, 'admin', 'purge_test_batch_1794992532283'), {
            completedAt: new Date().toISOString(),
            purgedIds: ['PROJ-001', 'PROJ-002', 'BATCH-PROJ-1794992532283'],
            version: '2026.11.18.9',
          })
            .then(() => saveMigrationsCache({ purge_test_batch_1794992532283: true }))
            .catch(() => {});
        }
        if (needsCentralisationPurge) {
          setDoc(doc(db, 'admin', 'purge_centralisation_v1'), {
            completedAt: new Date().toISOString(),
            version: '2026.11.18.10',
          })
            .then(() => saveMigrationsCache({ purge_centralisation_v1: true }))
            .catch(() => {});
        }
      } catch (err) {
        console.warn('Erreur chargement collections statiques:', err);
      }
    };

    // Chargement initial optimisé (les collections avec onSnapshot ci-dessous reçoivent leur instantané initial directement sans double lecture)
    loadTreasury();
    loadStaticCollectionsAndFlags();

    // ÉCOUTEURS TEMPS RÉEL POUR GBAIRAI ET NAVETTE D'ÉCHANGE
    // Permet au Chargé au Suivi (SDP), aux administrateurs et aux membres de voir les messages et lectures en temps réel
    const updateGbairaiState = () => {
      const combined = new Map<string, NewsItem>();
      announcementsDocsMapRef.current.forEach((v, k) => {
        if (!deletedRecordIdsRef.current.has(k)) combined.set(k, v);
      });
      newsDocsMapRef.current.forEach((v, k) => {
        if (!deletedRecordIdsRef.current.has(k)) combined.set(k, v);
      });
      const loaded = Array.from(combined.values());
      if (loaded.length > 0) {
        loaded.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        setNewsItems(loaded);
        setReligiousEvents(prev => reconcileHistoricalSpiritualEvents(prev, loaded));
      } else if (defaultsNewsClearedRef.current) {
        setNewsItems([]);
      }
    };

    const handleGbairaiSnapshot = (snapshot: any, targetMap: Map<string, NewsItem>) => {
      targetMap.clear();
      snapshot.forEach((d: any) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
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
        targetMap.set(d.id, item);
      });
      updateGbairaiState();
    };

    const unsubGbairaiNews = onSnapshot(collection(db, 'news'), (snapshot) => {
      handleGbairaiSnapshot(snapshot, newsDocsMapRef.current);
    }, (err) => {
      console.warn('Erreur écouteur temps réel news Gbairai:', err);
    });

    const unsubGbairaiAnnouncements = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      handleGbairaiSnapshot(snapshot, announcementsDocsMapRef.current);
    }, (err) => {
      console.warn('Erreur écouteur temps réel announcements Gbairai:', err);
    });

    // Écouteur temps réel pour les navettes et demandes d'information (écoute simultanée et consolidée de info_requests et navettes)
    const unsubInfoRequests = onSnapshot(collection(db, 'info_requests'), (snapshot) => {
      infoRequestsMapRef.current.clear();
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        infoRequestsMapRef.current.set(d.id, { id: d.id, ...(d.data() as any) });
      });
      updateNavetteState();
    }, (err) => {
      console.warn('Erreur écouteur temps réel info_requests:', err);
    });

    const unsubNavettesCol = onSnapshot(collection(db, 'navettes'), (snapshot) => {
      navettesMapRef.current.clear();
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        navettesMapRef.current.set(d.id, { id: d.id, ...(d.data() as any) });
      });
      updateNavetteState();
    }, (err) => {
      console.warn('Erreur écouteur temps réel navettes:', err);
    });

    // Synchronisation temps réel des suppressions persistantes et des démos masquées
    const unsubDeletedRecords = onSnapshot(doc(db, 'admin', 'deleted_records_v1'), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data() as any;
      let changed = false;
      if (data?.deletedTimestamps && typeof data.deletedTimestamps === 'object') {
        Object.entries(data.deletedTimestamps).forEach(([id, ts]) => {
          if (id && typeof ts === 'number' && !isNaN(ts)) {
            if ((deletedTimestampsRef.current[id] || 0) < ts) {
              deletedTimestampsRef.current[id] = ts;
              changed = true;
            }
          }
        });
      }
      if (Array.isArray(data?.ids)) {
        data.ids.forEach((id: string) => {
          if (id && !deletedRecordIdsRef.current.has(id)) {
            deletedRecordIdsRef.current.add(id);
            infoRequestsMapRef.current.delete(id);
            navettesMapRef.current.delete(id);
            newsDocsMapRef.current.delete(id);
            announcementsDocsMapRef.current.delete(id);
            changed = true;
          }
        });
      }
      if (data?.defaultsNewsCleared && !defaultsNewsClearedRef.current) {
        defaultsNewsClearedRef.current = true;
        changed = true;
      }
      if (changed) {
        syncLocalDeletedStorage();
        updateNavetteState();
        updateGbairaiState();
        setActivities(prev => prev.filter(a => !deletedRecordIdsRef.current.has(a.id)));
        setProjectsSynced(prev =>
          prev.filter(p => {
            const v = evaluateProjectTombstone(p.id, p, false);
            return v === 'KEEP' || v === 'UNBLOCK';
          })
        );
        setFinancialEvents(prev => prev.filter(fe => !deletedRecordIdsRef.current.has(fe.id)));
        setReligiousEvents(prev => prev.filter(r => !deletedRecordIdsRef.current.has(r.id)));
        setPvs(prev => prev.filter(pv => !deletedRecordIdsRef.current.has(pv.id)));
        setBilans(prev => prev.filter(b => !deletedRecordIdsRef.current.has(b.id)));
        setProgrammeTasks(prev => prev.filter(t => !deletedRecordIdsRef.current.has(t.id)));
        setProgrammeAlerts(prev => prev.filter(a => !deletedRecordIdsRef.current.has(a.id)));
      }
    }, () => {});

    const unsubDismissedDemos = onSnapshot(doc(db, 'admin', 'dismissed_demo_requests'), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data() as any;
      const serverIds: string[] = Array.isArray(data?.ids) ? data.ids : [];
      const serverDisableAll = Boolean(data?.disableAll);
      setDismissedDemoRequestIds(prev => {
        const merged = Array.from(new Set([...prev, ...serverIds]));
        try {
          localStorage.setItem(
            EROUAMA_DISMISSED_DEMO_REQS_KEY,
            JSON.stringify({ ids: merged, disableAll: serverDisableAll })
          );
        } catch {}
        return merged;
      });
      if (serverDisableAll) setDemosDisabled(true);
    }, () => {});

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
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        const data = d.data() as any;
        const st = data.status || 'DRAFT';
        loaded.push({
          ...data,
          id: d.id,
          status: st,
          publishedToGbairai: Boolean(st === 'PUBLISHED' && (data.publishedToGbairai || data.publishedAt)),
        });
      });
      const currentNews = newsItemsRef.current || [];
      const reconciled = reconcileHistoricalSpiritualEvents(loaded, currentNews);
      setReligiousEvents(reconciled);
    }, (err) => {
      console.warn('Erreur écouteur temps réel religious_events:', err);
    });

    // Écouteur temps réel pour les soldes et régularisations de trésorerie
    const unsubTreasuryBalances = onSnapshot(doc(db, 'treasury', 'balances'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Record<string, any>;
        setFundBalances(prev => ({
          ...prev,
          COTISATION: typeof data.COTISATION === 'number' ? data.COTISATION : prev.COTISATION,
          ANNIVERSAIRE: typeof data.ANNIVERSAIRE === 'number' ? data.ANNIVERSAIRE : prev.ANNIVERSAIRE,
          SOIREE_ROUAMA: typeof data.SOIREE_ROUAMA === 'number' ? data.SOIREE_ROUAMA : prev.SOIREE_ROUAMA,
          LOISIRS: typeof data.LOISIRS === 'number' ? data.LOISIRS : prev.LOISIRS,
          AGR: typeof data.AGR === 'number' ? data.AGR : prev.AGR,
          CAS_SOCIAUX: typeof data.CAS_SOCIAUX === 'number' ? data.CAS_SOCIAUX : prev.CAS_SOCIAUX,
          EXTRA: typeof data.EXTRA === 'number' ? data.EXTRA : prev.EXTRA,
        }));
        if (data && data.regularizations && typeof data.regularizations === 'object') {
          setTreasuryRegularizations(data.regularizations);
          try {
            localStorage.setItem('erouama_treasury_regularizations', JSON.stringify(data.regularizations));
          } catch {}
        }
      }
    }, (err) => {
      console.warn('Erreur écouteur temps réel treasury/balances:', err);
    });

    // Écouteurs temps réel pour users et members (synchronisation instantanée des statuts et compteurs d'inscrits)
    const unsubUsersCol = onSnapshot(collection(db, 'users'), (snapshot) => {
      usersDocsMap.clear();
      snapshot.forEach((docSnap) => {
        if (['TRESORIER', 'CERVEAU', 'PAYOR', 'SDP', 'ORGANISATEUR', 'ORGANISATION', 'PROJET', 'COM', 'SECRETARIAT', 'SPIRITUALITE'].includes(docSnap.id)) return;
        usersDocsMap.set(docSnap.id, { ...docSnap.data(), _docId: docSnap.id });
      });
      reconcileMembers();
    }, (err) => {
      console.warn('Erreur écouteur temps réel users:', err);
    });

    const unsubMembersCol = onSnapshot(collection(db, 'members'), (snapshot) => {
      membersDocsMap.clear();
      snapshot.forEach((docSnap) => {
        membersDocsMap.set(docSnap.id, { ...docSnap.data(), _docId: docSnap.id });
      });
      reconcileMembers();
    }, (err) => {
      console.warn('Erreur écouteur temps réel members:', err);
    });

    // Écouteurs temps réel multi-appareils pour Projets AGR, Activités, Finances, Secrétariat, Archives et Suivi
    const unsubProjectsCol = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setCloudSyncError(null);
      setIsFirebaseConnected(true);
      const loaded: AgrProject[] = [];
      const unblockedIds: string[] = [];
      snapshot.forEach((d) => {
        const projItem: AgrProject = { id: d.id, ...(d.data() as any) };
        const verdict = evaluateProjectTombstone(d.id, projItem, false);
        if (verdict === 'TEST_PURGE' || verdict === 'DELETED') {
          return;
        }
        if (verdict === 'UNBLOCK') {
          unblockedIds.push(d.id);
        }
        loaded.push(projItem);
      });
      if (unblockedIds.length > 0) {
        unblockDeletedRecordIds(unblockedIds).catch(() => {});
      }
      setProjectsSynced(sortProjectsList(loaded));
    }, (err) => {
      const msg = formatFirestoreErrorMessage(err);
      console.warn('Erreur écouteur temps réel projects:', err);
      setCloudSyncError(msg);
    });

    const unsubActivitiesCol = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const rawLoaded: EventActivity[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        rawLoaded.push({ id: d.id, ...(d.data() as any) });
      });
      setActivities(reconcileActivitiesSnapshot(rawLoaded));
    }, (err) => {
      console.warn('Erreur écouteur temps réel activities:', err);
    });

    const unsubFinancialEventsCol = onSnapshot(collection(db, 'financial_events'), (snapshot) => {
      const loaded: FinancialEvent[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setFinancialEvents(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel financial_events:', err);
    });

    const unsubPvsCol = onSnapshot(collection(db, 'secretary_pvs'), (snapshot) => {
      const loaded: SecretaryPV[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setPvs(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel secretary_pvs:', err);
    });

    const unsubBilansCol = onSnapshot(collection(db, 'secretary_bilans'), (snapshot) => {
      const loaded: FinancialBilan[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setBilans(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel secretary_bilans:', err);
    });

    const unsubArchiveDocsCol = onSnapshot(collection(db, 'archive_docs'), (snapshot) => {
      const loaded: ArchiveDoc[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setArchiveDocs(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel archive_docs:', err);
    });

    const unsubProgrammeTasksCol = onSnapshot(collection(db, 'programme_tasks'), (snapshot) => {
      const loaded: ProgrammeTask[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setProgrammeTasks(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel programme_tasks:', err);
    });

    const unsubProgrammeAlertsCol = onSnapshot(collection(db, 'programme_alerts'), (snapshot) => {
      const loaded: ProgrammeAlert[] = [];
      snapshot.forEach((d) => {
        if (deletedRecordIdsRef.current.has(d.id)) {
          return;
        }
        loaded.push({ id: d.id, ...(d.data() as any) });
      });
      setProgrammeAlerts(loaded);
    }, (err) => {
      console.warn('Erreur écouteur temps réel programme_alerts:', err);
    });

    // Références pour rafraîchissements ponctuels après création ou validation
    treasuryLoaderRef.current = loadTreasury;
    gbairaiLoaderRef.current = loadGbairai;
    navetteLoaderRef.current = loadNavette;

    return () => {
      if (unsubGbairaiNews) unsubGbairaiNews();
      if (unsubGbairaiAnnouncements) unsubGbairaiAnnouncements();
      if (unsubInfoRequests) unsubInfoRequests();
      if (unsubNavettesCol) unsubNavettesCol();
      if (unsubDeletedRecords) unsubDeletedRecords();
      if (unsubDismissedDemos) unsubDismissedDemos();
      if (unsubAdminLogs) unsubAdminLogs();
      if (unsubReligiousEvents) unsubReligiousEvents();
      if (unsubTreasuryBalances) unsubTreasuryBalances();
      if (unsubUsersCol) unsubUsersCol();
      if (unsubMembersCol) unsubMembersCol();
      if (unsubProjectsCol) unsubProjectsCol();
      if (unsubActivitiesCol) unsubActivitiesCol();
      if (unsubFinancialEventsCol) unsubFinancialEventsCol();
      if (unsubPvsCol) unsubPvsCol();
      if (unsubBilansCol) unsubBilansCol();
      if (unsubArchiveDocsCol) unsubArchiveDocsCol();
      if (unsubProgrammeTasksCol) unsubProgrammeTasksCol();
      if (unsubProgrammeAlertsCol) unsubProgrammeAlertsCol();
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
                const prevM = prev.member;
                const nextPhoto = photo || prevM.photoUrl;
                const nextAvatar = photo || prevM.avatar;
                const nextReste = typeof data.resteADevoir === 'number' ? data.resteADevoir : prevM.resteADevoir;
                const nextTotal = typeof data.totalPaid === 'number' ? data.totalPaid : (typeof data.solde === 'number' ? data.solde : prevM.totalPaid);
                const nextSolde = typeof data.solde === 'number' ? data.solde : (typeof data.totalPaid === 'number' ? data.totalPaid : prevM.solde);
                const nextUnpaid = typeof data.unpaidMonths === 'number' ? data.unpaidMonths : (typeof data.moisRetard === 'number' ? data.moisRetard : prevM.unpaidMonths);
                const nextRetard = typeof data.moisRetard === 'number' ? data.moisRetard : (typeof data.unpaidMonths === 'number' ? data.unpaidMonths : prevM.moisRetard);
                const nextDues = data.duesStatus || data.statutCotisation || prevM.duesStatus;
                const nextStatutCot = data.statutCotisation || data.duesStatus || prevM.statutCotisation;
                const nextStatutDem = data.statutDemande || prevM.statutDemande;

                const hasChanged =
                  prevM.photoUrl !== nextPhoto ||
                  prevM.avatar !== nextAvatar ||
                  prevM.resteADevoir !== nextReste ||
                  prevM.totalPaid !== nextTotal ||
                  prevM.solde !== nextSolde ||
                  prevM.unpaidMonths !== nextUnpaid ||
                  prevM.moisRetard !== nextRetard ||
                  prevM.duesStatus !== nextDues ||
                  prevM.statutCotisation !== nextStatutCot ||
                  prevM.statutDemande !== nextStatutDem ||
                  prevM.statut !== (data.statut ?? prevM.statut) ||
                  prevM.isRegistered !== (data.isRegistered ?? prevM.isRegistered);

                if (!hasChanged) return prev;

                const updatedMember = {
                  ...prevM,
                  ...data,
                  id: currentUserId,
                  photoUrl: nextPhoto,
                  avatar: nextAvatar,
                  resteADevoir: nextReste,
                  totalPaid: nextTotal,
                  solde: nextSolde,
                  unpaidMonths: nextUnpaid,
                  moisRetard: nextRetard,
                  duesStatus: nextDues,
                  statutCotisation: nextStatutCot,
                  statutDemande: nextStatutDem,
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

  const refreshProjects = async (): Promise<{ ok: boolean; error?: string; count?: number }> => {
    setIsRefreshingData(true);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offlineMsg = 'Appareil hors-ligne : impossible d’actualiser les projets depuis le serveur.';
        setCloudSyncError(offlineMsg);
        return { ok: false, error: offlineMsg };
      }
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 6000);
      });
      const snap = await Promise.race([
        getDocsFromServer(collection(db, 'projects')),
        timeoutPromise,
      ]);
      if (!snap) {
        const restProbe = await probeFirestoreRestStatus('projects');
        const errMsg = !restProbe.ok && restProbe.message
          ? restProbe.message
          : 'Délai dépassé lors de la lecture des projets depuis le serveur Firestore.';
        setCloudSyncError(errMsg);
        return { ok: false, error: errMsg };
      }
      const loaded: AgrProject[] = [];
      const unblockedIds: string[] = [];
      snap.forEach((d) => {
        const projItem: AgrProject = { id: d.id, ...(d.data() as any) };
        const verdict = evaluateProjectTombstone(d.id, projItem, false);
        if (verdict === 'TEST_PURGE' || verdict === 'DELETED') return;
        if (verdict === 'UNBLOCK') unblockedIds.push(d.id);
        loaded.push(projItem);
      });
      if (unblockedIds.length > 0) {
        unblockDeletedRecordIds(unblockedIds).catch(() => {});
      }
      const sorted = sortProjectsList(loaded);
      setProjectsSynced(sorted);
      setCloudSyncError(null);
      setIsFirebaseConnected(true);
      return { ok: true, count: sorted.length };
    } catch (err: any) {
      let errMsg = formatFirestoreErrorMessage(err);
      if (!errMsg.includes('429') && !errMsg.includes('PERMISSION_DENIED')) {
        const restProbe = await probeFirestoreRestStatus('projects');
        if (!restProbe.ok && restProbe.message) errMsg = restProbe.message;
      }
      setCloudSyncError(errMsg);
      return { ok: false, error: errMsg };
    } finally {
      if (timer) clearTimeout(timer);
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
      resetAt: null,
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
          resetAt: null,
          lastLogin: nowIso
        });
      } catch {
        await setDoc(doc(db, "users", memberId), {
          pinCode: expectedPin,
          pin: expectedPin,
          isRegistered: true,
          statut: 'Activé',
          resetAt: null,
          lastLogin: nowIso
        }, { merge: true });
      }
      try {
        await setDoc(doc(db, "members", memberId), {
          pinCode: expectedPin,
          pin: expectedPin,
          isRegistered: true,
          statut: 'Activé',
          resetAt: null,
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

  // Enregistrement de l'activité/présence d'un administrateur (strictement dédupliqué pour éviter toute boucle d'écriture Firestore)
  const recordAdminActivity = useCallback(async (role: string, memberName?: string, userId?: string) => {
    if (!role || !role.trim()) return;
    const cleanRole = role.trim().toUpperCase().replace(/[\s-]/g, '_');
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.split('T')[0];

    const curUser = currentUserRef.current;
    const targetUserId = userId || (curUser?.type === 'MEMBER' ? curUser.member?.id : undefined);
    const presenceSyncKey = `erouama_presence_synced_${cleanRole}_${targetUserId || 'none'}_${todayStr}`;

    try {
      if (syncedPresenceKeysRef.current.has(presenceSyncKey) || sessionStorage.getItem(presenceSyncKey)) {
        return;
      }
    } catch {}
    syncedPresenceKeysRef.current.add(presenceSyncKey);
    try {
      sessionStorage.setItem(presenceSyncKey, nowIso);
    } catch {}

    try {
      // 1. Mise à jour Firestore du document admins/${cleanRole} (une fois par session/jour)
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

      // 2. Si userId ou memberId fourni, mise à jour ponctuelle dans users (sans boucle sur onSnapshot)
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

      // 3. Déduplication quotidienne pour admin_logs afin d'éviter le spamming
      const sessionDedupKey = `erouama_admin_activity_${cleanRole}_${todayStr}`;
      let alreadyLoggedToday: string | null = null;
      try {
        alreadyLoggedToday = sessionStorage.getItem(sessionDedupKey);
      } catch {}

      if (!alreadyLoggedToday) {
        try {
          sessionStorage.setItem(sessionDedupKey, nowIso);
        } catch {}
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
  }, []);

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
    const calculatedPaid = safeDeclarations
      .filter(d => 
        d &&
        String(d.memberId).trim() === String(memberId).trim() && 
        (d.fund === 'COTISATION' || (d as any).caisse === 'Cotisation Mensuelle' || (d as any).type === 'Cotisation Mensuelle') && 
        isPaymentValidated(d)
      )
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

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

  const getEffectiveLoisirsEvents = (): FinancialEvent[] => {
    const finLoisirs = financialEvents.filter(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
    const actLoisirs: FinancialEvent[] = activities
      .filter(a => a.status === 'PUBLISHED' && a.eventType === 'SIMPLE')
      .filter(a => !finLoisirs.some(fe => fe.id === `EVT-ACT-${a.id}` || fe.title.toLowerCase().trim() === (a.title || '').toLowerCase().trim()))
      .map(a => ({
        id: `EVT-ACT-${a.id}`,
        fund: 'LOISIRS' as const,
        subCategory: a.title,
        title: a.title,
        description: a.description || a.title,
        requiredAmountPerMember:
          a.requiredAmountPerMember && a.requiredAmountPerMember > 0
            ? a.requiredAmountPerMember
            : a.budget && a.budget > 0
            ? Math.round(a.budget / (members.length || 12))
            : 5000,
        totalTargetAmount: a.budget,
        eventDate: a.eventDate,
        paymentDeadline: a.paymentDeadline || a.eventDate,
        status: 'PUBLISHED' as const,
        createdAt: a.publishedAt || a.createdAt || new Date().toLocaleDateString('fr-FR'),
        createdBy: a.createdBy || 'COMMISSION ORGANISATION',
      }));
    return [...finLoisirs, ...actLoisirs];
  };

  const getActiveFinancialEvent = (fund: 'LOISIRS' | 'CAS_SOCIAUX'): FinancialEvent | undefined => {
    if (fund === 'LOISIRS') {
      return getEffectiveLoisirsEvents()[0];
    }
    return financialEvents.find(e => e.fund === fund && e.status === 'PUBLISHED');
  };

  const getActiveAgrProject = (): AgrProject | undefined => {
    return projects.find(p => p.status === 'PUBLISHED' || p.status === 'active');
  };

  const getRequiredAmountForRubric = (fund: FundType, subCategory?: string): number => {
    switch (fund) {
      case 'ANNIVERSAIRE': {
        const annivActs = activities.filter(
          a =>
            a.status === 'PUBLISHED' &&
            (a.fixedType === 'ANNIVERSAIRE' ||
              a.id === 'ACT-ANNIVERSAIRE-2027' ||
              a.title?.toUpperCase().includes('ANNIVERSAIRE'))
        );
        const annivAct = subCategory
          ? annivActs.find(a => a.id === subCategory || a.title === subCategory) || annivActs[0]
          : annivActs[0];
        if (!annivAct) return 0;
        if (annivAct.requiredAmountPerMember && annivAct.requiredAmountPerMember > 0) {
          return annivAct.requiredAmountPerMember;
        }
        return annivAct.budget && annivAct.budget > 0
          ? Math.round(annivAct.budget / (members.length || 12))
          : 10000;
      }
      case 'SOIREE_ROUAMA': {
        const soireeActs = activities.filter(
          a =>
            a.status === 'PUBLISHED' &&
            (a.fixedType === 'SOIREE_ROUAMA' ||
              a.title?.toLowerCase().includes('soirée') ||
              a.title?.toLowerCase().includes('soiree'))
        );
        const soireeAct = subCategory
          ? soireeActs.find(a => a.id === subCategory || a.title === subCategory) || soireeActs[0]
          : soireeActs[0];
        if (!soireeAct) return 0;
        if (soireeAct.requiredAmountPerMember && soireeAct.requiredAmountPerMember > 0) {
          return soireeAct.requiredAmountPerMember;
        }
        return soireeAct.budget && soireeAct.budget > 0
          ? Math.round(soireeAct.budget / (members.length || 12))
          : 10000;
      }
      case 'LOISIRS': {
        const activeEvts = getEffectiveLoisirsEvents();
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
        const activeEvts = getEffectiveLoisirsEvents();
        const specific = subCategory ? activeEvts.find(e => e.id === subCategory || e.title === subCategory || e.subCategory === subCategory) : activeEvts[0];
        if (specific) {
          title = specific.title;
        }
      } else if (fund === 'ANNIVERSAIRE') {
        const annivActs = activities.filter(
          a =>
            a.status === 'PUBLISHED' &&
            (a.fixedType === 'ANNIVERSAIRE' ||
              a.id === 'ACT-ANNIVERSAIRE-2027' ||
              a.title?.toUpperCase().includes('ANNIVERSAIRE'))
        );
        const specific = subCategory ? annivActs.find(a => a.id === subCategory || a.title === subCategory) : annivActs[0];
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
        const activeProjs = projects.filter(p => p.status === 'PUBLISHED' || p.status === 'active');
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

      // Synchroniser automatiquement le statut Activé du membre lors de tout paiement de cotisation/activité
      activateMemberAccount(String(activeMember.id)).catch(() => {});

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
        const totalSum = (
          (Number(updatedBalances.COTISATION) || 0) +
          (Number(updatedBalances.ANNIVERSAIRE) || 0) +
          (Number(updatedBalances.SOIREE_ROUAMA) || 0) +
          (Number(updatedBalances.LOISIRS) || 0) +
          (Number(updatedBalances.AGR) || 0) +
          (Number(updatedBalances.CAS_SOCIAUX) || 0) +
          (Number(updatedBalances.EXTRA) || 0)
        );
        (updatedBalances as any).total = totalSum;
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
      const fallbackTotalSum = (
        (Number(finalBalances.COTISATION) || 0) +
        (Number(finalBalances.ANNIVERSAIRE) || 0) +
        (Number(finalBalances.SOIREE_ROUAMA) || 0) +
        (Number(finalBalances.LOISIRS) || 0) +
        (Number(finalBalances.AGR) || 0) +
        (Number(finalBalances.CAS_SOCIAUX) || 0) +
        (Number(finalBalances.EXTRA) || 0)
      );
      (finalBalances as any).total = fallbackTotalSum;
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
    if (treasuryLoaderRef.current) {
      treasuryLoaderRef.current().catch(console.warn);
    }

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
        relatedId: targetId,
        declarationId: targetId,
        isAuditMirror: true,
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
        isRegistered: true,
        statut: 'Activé',
        resetAt: null,
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

      const updateData: Record<string, any> = {
        totalPaid,
        solde: totalPaid,
        montantPaye: totalPaid,
        unpaidMonths,
        moisRetard: unpaidMonths,
        resteADevoir,
        duesStatus,
        statutCotisation: duesStatus,
        statutDemande: 'valide',
        ...(totalPaid > 0 ? { isRegistered: true, statut: 'Activé', resetAt: null } : {}),
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
    await persistDeletedRecordIds([targetId]);

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
    await persistDeletedRecordIds([targetId]);

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
    setTransactions(prev => prev.filter(t => t.id !== targetId));
    try {
      await persistDeletedRecordIds([targetId]);
      await Promise.allSettled([
        deleteDoc(doc(db, 'transactions', targetId)),
        deleteDoc(doc(db, 'payments', targetId)),
      ]);
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

    // Déclenchement automatique de la notification push FCM / Web Push pour toute publication sur le Gbaïraï
    dispatchPushNotification({
      title: `E-ROUAMA • Gbaïraï : ${title}`,
      body: content.length > 140 ? content.substring(0, 137) + '...' : content,
      senderRole: authorRole || 'COM',
      senderName: authorRole || 'Communication E-ROUAMA',
      targetRole: targetAudience === 'TOUS' ? 'ALL' : targetAudience,
      type: 'GENERAL',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      url: linkTab ? `/#tab=${linkTab}` : '/#tab=NOUVELLES',
      metadata: {
        newsId: item.id,
        linkTab,
        targetDocId,
      },
    }).catch(console.warn);
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
    if (!specificMemberId && targetMember && (!targetMember.isRegistered || targetMember.statut !== 'Activé')) {
      activateMemberAccount(String(targetMemberId)).catch(() => {});
    }
  };

  const markAllGbairaiAsRead = useCallback(async (specificMemberId?: string): Promise<void> => {
    const curUser = currentUserRef.current;
    const targetMemberId = String(specificMemberId || curUser?.member?.id || (curUser as any)?.id || '').trim();
    if (!targetMemberId) return;

    const curMembers = membersRef.current || [];
    const targetMember = curMembers.find(m => String(m.id).trim() === targetMemberId);
    if (!specificMemberId && targetMember && (!targetMember.isRegistered || targetMember.statut !== 'Activé')) {
      activateMemberAccount(targetMemberId).catch(() => {});
    }
    const targetNick = targetMember?.nickname || (curUser?.member?.id === targetMemberId ? curUser?.member?.nickname : undefined);
    const toAdd = [targetMemberId];
    if (targetNick) toAdd.push(targetNick);

    const currentItems = newsItemsRef.current || [];

    // 1. Calcul synchrone immédiat des documents non lus à mettre à jour
    const docsToUpdate: { id: string; readBy: string[] }[] = [];
    currentItems.forEach(n => {
      const currentRead = (n.readBy || []).map(r => String(r).trim());
      const isAlreadyRead =
        currentRead.includes(targetMemberId) ||
        (targetNick && currentRead.some(r => r.toUpperCase() === targetNick.toUpperCase()));

      if (!isAlreadyRead) {
        const updatedRead = Array.from(new Set([...currentRead, ...toAdd]));
        docsToUpdate.push({ id: n.id, readBy: updatedRead });
      }
    });

    // RÈGLE ANTI-BOUCLE CRITIQUE : Si tous les documents sont déjà marqués comme lus, ne déclencher aucun setState
    if (docsToUpdate.length === 0) {
      return;
    }

    try {
      const readKey = `erouama_read_gbairai_${targetMemberId}`;
      const existingStored = JSON.parse(localStorage.getItem(readKey) || '[]');
      const newStored = Array.from(new Set([...existingStored, ...currentItems.map(n => n.id)]));
      localStorage.setItem(readKey, JSON.stringify(newStored));
    } catch {}

    // 2. Mise à jour de l'état local pour remise instantanée du compteur visuel à 0
    setNewsItems(prev => {
      return prev.map(n => {
        const found = docsToUpdate.find(u => u.id === n.id);
        if (found) {
          return { ...n, readBy: found.readBy };
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
  }, []);

  const deleteNewsItem = async (newsId: string) => {
    newsDocsMapRef.current.delete(newsId);
    announcementsDocsMapRef.current.delete(newsId);
    setNewsItems(prev => prev.filter(n => n.id !== newsId));
    await persistDeletedRecordIds([newsId], { defaultsNewsCleared: true });
    await Promise.allSettled([
      deleteDoc(doc(db, 'news', newsId)),
      deleteDoc(doc(db, 'announcements', newsId)),
    ]);
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
  const createActivity = (activity: Omit<EventActivity, 'id' | 'status' | 'budgetStatus'> & { status?: EventActivity['status'] }) => {
    // Vérification stricte des droits de création par rôle
    // Commission ORGANISATION a les droits exclusifs sur les Événements Fixes et Sorties & Loisirs
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['ORGANISATION', 'PAYOR', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        console.warn(`[RBAC] Création d'activité refusée pour le rôle ${currentUser.adminRole}. Rôle ORGANISATION requis.`);
        alert(`Action non autorisée : Seule la Commission Organisation (ou Payor) est habilitée à créer et enregistrer des Événements Fixes ou Sorties & Loisirs.`);
        return;
      }
    }

    // Numérotation séquentielle automatique basée sur le dernier document existant (ORG-001, ORG-002, ...)
    let maxActSeq = 0;
    activities.forEach(a => {
      if (!a.id) return;
      const m = a.id.match(/^ORG-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxActSeq) maxActSeq = num;
      }
    });
    let nextActSeq = maxActSeq > 0 ? maxActSeq + 1 : (activities.length + 1);
    let seqActId = `ORG-${String(nextActSeq).padStart(3, '0')}`;
    while (activities.some(a => a.id === seqActId) || deletedRecordIdsRef.current.has(seqActId)) {
      nextActSeq++;
      seqActId = `ORG-${String(nextActSeq).padStart(3, '0')}`;
    }

    const newAct: EventActivity = {
      ...activity,
      id: seqActId,
      status: 'DRAFT',
      budgetStatus: (activity.budget && activity.budget > 0) ? 'PENDING_TRESORIER' : 'NONE',
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      sentToSecretariat: false,
      sentToPayor: false,
      sentToCom: false,
      ackByCom: false,
      gbairaiAlertSentByCom: false,
      archivedBySecretariat: false,
    };
    setDoc(doc(db, 'activities', newAct.id), sanitizeFirestore(newAct)).catch(console.warn);
    setActivities(prev => [newAct, ...prev]);
  };

  const publishActivity = (activityId: string) => {
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['ORGANISATION', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        console.warn(`[Workflow] Publication refusée pour ${currentUser.adminRole}. Seule la Commission Organisation peut publier dans SHOW.`);
        return;
      }
    }

    const act = activities.find(a => a.id === activityId);
    if (!act) return;
    if (act.status !== 'APPROVED' && !act.payorSignature?.signedBy) {
      console.warn(`[Workflow] Publication refusée : l'activité ${activityId} n'a pas encore reçu le visa du Payor.`);
      return;
    }

    const nowDisplay = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const updates = {
      status: 'PUBLISHED' as const,
      publishedAt: nowDisplay,
      publishedByDeptAt: new Date().toISOString(),
      sentToCom: true,
      gbairaiAlertSentByCom: false,
    };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    // Liaison automatique avec l'espace DJAI pour les activités Sorties & Loisirs (SIMPLE)
    if (act.eventType === 'SIMPLE') {
      const linkedFinId = `EVT-ACT-${act.id}`;
      const reqAmt =
        act.requiredAmountPerMember && act.requiredAmountPerMember > 0
          ? act.requiredAmountPerMember
          : act.budget && act.budget > 0
          ? Math.round(act.budget / (members.length || 12))
          : 5000;
      const linkedEvent: FinancialEvent = {
        id: linkedFinId,
        fund: 'LOISIRS',
        subCategory: act.title,
        title: act.title,
        description: act.description || act.title,
        requiredAmountPerMember: reqAmt,
        totalTargetAmount: act.budget,
        eventDate: act.eventDate,
        paymentDeadline: act.paymentDeadline || act.eventDate,
        status: 'PUBLISHED',
        createdAt: new Date().toLocaleDateString('fr-FR'),
        createdBy: 'COMMISSION ORGANISATION',
      };
      setDoc(doc(db, 'financial_events', linkedFinId), sanitizeFirestore(linkedEvent), { merge: true }).catch(console.warn);
      setFinancialEvents(prev => [linkedEvent, ...prev.filter(e => e.id !== linkedFinId)]);
    }

    // Alerte automatique vers la Commission Communication (COM / BIC) pour notification globale sur Gbairai
    dispatchPushNotification({
      title: '🔔 Nouveau programme publié (SHOW)',
      body: `La Commission Organisation a publié "${act.title}". Prêt pour l'envoi de l'alerte globale sur le Gbairai.`,
      senderRole: 'ORGANISATION',
      senderName: 'Commission Organisation',
      targetRole: 'COM',
      targetDepartment: 'com',
      type: 'INFO_REQUEST',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivityToSecretariat = (activityId: string) => {
    const act = activities.find(a => a.id === activityId);
    const updates = { status: 'SENT_TO_SECRETARIAT' as const, sentToSecretariat: true, sentToSuivi: false };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    dispatchPushNotification({
      title: 'E-ROUAMA • Commission Organisation 🎪',
      body: `Fiche d'activité transmise au Secrétariat : "${act?.title || activityId}".`,
      senderRole: 'ORGANISATION',
      senderName: 'Commission Organisation',
      targetRole: 'SECRETARIAT',
      targetDepartment: 'secretariat',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivitiesBatchToSecretariat = (activityIds: string[]) => {
    const batchId = 'BATCH-ACT-' + Date.now();
    activityIds.forEach(id => {
      const updates = { status: 'SENT_TO_SECRETARIAT' as const, sentToSecretariat: true, sentToSuivi: false, batchId, isConsolidated: true };
      setDoc(doc(db, 'activities', id), updates, { merge: true }).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a => (activityIds.includes(a.id) ? { ...a, status: 'SENT_TO_SECRETARIAT', sentToSecretariat: true, sentToSuivi: false, batchId, isConsolidated: true } : a))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Global d\'Activités 🎪',
      body: `La Commission Organisation a transmis le Programme Global (${activityIds.length} activités) au Secrétariat Général.`,
      senderRole: 'ORGANISATION',
      senderName: 'Commission Organisation',
      targetRole: 'SECRETARIAT',
      targetDepartment: 'secretariat',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivityFromSecretariatToSuivi = (activityId: string) => {
    const act = activities.find(a => a.id === activityId);
    const updates = { status: 'SENT_TO_SUIVI' as const, sentToSecretariat: true, sentToSuivi: true };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis l'activité "${act?.title || activityId}" au Chargé de Suivi pour instruction avant la réunion de cadrage.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivitiesBatchFromSecretariatToSuivi = (activityIds: string[]) => {
    activityIds.forEach(id => {
      const updates = { status: 'SENT_TO_SUIVI' as const, sentToSecretariat: true, sentToSuivi: true };
      setDoc(doc(db, 'activities', id), updates, { merge: true }).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a => (activityIds.includes(a.id) ? { ...a, status: 'SENT_TO_SUIVI', sentToSecretariat: true, sentToSuivi: true } : a))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis le Programme Global (${activityIds.length} activités) au Chargé de Suivi pour instruction pré-réunion.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivityFromSecretariatToPayor = (activityId: string) => {
    const act = activities.find(a => a.id === activityId);
    const updates = { status: 'PENDING_PAYOR' as const, sentToPayor: true, sentToSuivi: false, suiviReviewed: true };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    dispatchPushNotification({
      title: 'E-ROUAMA • Transmission Payor ⚖️',
      body: `L'activité "${act?.title || activityId}" a été transmise pour visa officiel du Payor.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendActivitiesBatchFromSecretariatToPayor = (activityIds: string[]) => {
    activityIds.forEach(id => {
      const updates = { status: 'PENDING_PAYOR' as const, sentToPayor: true, sentToSuivi: false, suiviReviewed: true };
      setDoc(doc(db, 'activities', id), updates, { merge: true }).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a => (activityIds.includes(a.id) ? { ...a, status: 'PENDING_PAYOR', sentToPayor: true, sentToSuivi: false, suiviReviewed: true } : a))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Transmission Payor ⚖️',
      body: `Le Programme Global (${activityIds.length} activités) a été transmis pour visa officiel du Payor.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const approveActivityPayor = (activityId: string) => {
    const act = activities.find(a => a.id === activityId);
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
    const updates = {
      status: 'APPROVED' as const,
      payorSignature,
      payorFeedback: '',
      sentToSecretariat: true,
    };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    dispatchPushNotification({
      title: 'E-ROUAMA • Visa Payor Accordé ✅',
      body: `Le Payor (WOYA SYLAS) a validé et visé l'activité "${act?.title || activityId}".`,
      senderRole: 'PAYOR',
      senderName: 'WOYA SYLAS (LE PAYOR)',
      targetRole: 'ALL',
      type: 'GENERAL',
      url: '/',
    }).catch(console.warn);
  };

  const approveActivitiesBatchPayor = (activityIds: string[]) => {
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
    activityIds.forEach(id => {
      const updates = {
        status: 'APPROVED' as const,
        payorSignature,
        payorFeedback: '',
        sentToSecretariat: true,
      };
      setDoc(doc(db, 'activities', id), updates, { merge: true }).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a => (activityIds.includes(a.id) ? { ...a, status: 'APPROVED', payorSignature, payorFeedback: '', sentToSecretariat: true } : a))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Visa Payor Accordé ✅',
      body: `Le Payor (WOYA SYLAS) a validé et visé le Programme Global (${activityIds.length} activités).`,
      senderRole: 'PAYOR',
      senderName: 'WOYA SYLAS (LE PAYOR)',
      targetRole: 'ALL',
      type: 'GENERAL',
      url: '/',
    }).catch(console.warn);
  };

  const returnActivityForCorrectionPayor = (activityId: string, feedback: string) => {
    const act = activities.find(a => a.id === activityId);
    const updates = {
      status: 'returned_for_correction' as const,
      payorFeedback: feedback,
      sentToSecretariat: true,
      sentToSuivi: false,
      suiviReviewed: true,
      isPostMeetingRevision: true,
    };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));

    dispatchPushNotification({
      title: 'E-ROUAMA • Activité Retournée pour Correction ⚠️',
      body: `Le Payor a retourné l'activité "${act?.title || activityId}" avec observations : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'ORGANISATION',
      targetDepartment: 'organisation',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const returnActivitiesBatchForCorrectionPayor = (activityIds: string[], feedback: string) => {
    activityIds.forEach(id => {
      const updates = {
        status: 'returned_for_correction' as const,
        payorFeedback: feedback,
        sentToSecretariat: true,
        sentToSuivi: false,
        suiviReviewed: true,
        isPostMeetingRevision: true,
      };
      setDoc(doc(db, 'activities', id), updates, { merge: true }).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a =>
        activityIds.includes(a.id)
          ? {
              ...a,
              status: 'returned_for_correction',
              payorFeedback: feedback,
              sentToSecretariat: true,
              sentToSuivi: false,
              suiviReviewed: true,
              isPostMeetingRevision: true,
            }
          : a
      )
    );
    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Global Retourné pour Correction ⚠️',
      body: `Le Payor a retourné le Programme Global (${activityIds.length} activités) : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'ORGANISATION',
      targetDepartment: 'organisation',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const splitActivitiesBatchToIndividual = (activityIds: string[]) => {
    activityIds.forEach(id => {
      setDoc(
        doc(db, 'activities', id),
        {
          isConsolidated: false,
          batchId: deleteField(),
          batchTitle: deleteField(),
        },
        { merge: true }
      ).catch(console.warn);
    });
    setActivities(prev =>
      prev.map(a =>
        activityIds.includes(a.id)
          ? { ...a, isConsolidated: false, batchId: undefined, batchTitle: undefined }
          : a
      )
    );
  };

  const sendActivityNoteToCom = (activityId: string) => {
    const updates = { sentToCom: true };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
  };

  const ackActivityCOM = (activityId: string) => {
    const updates = { ackByCom: true };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
  };

  const archiveActivitySecretariat = (activityId: string) => {
    const updates = { archivedBySecretariat: true, status: 'ARCHIVED' as const };
    setDoc(doc(db, 'activities', activityId), updates, { merge: true }).catch(console.warn);
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
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
    if (!activityId) return;
    setActivities(prev => prev.filter(a => a.id !== activityId));
    await Promise.allSettled([
      persistDeletedRecordIds([activityId]),
      cleanupLinkedActivityReferences(activityId),
      runWithTimeout(deleteDoc(doc(db, 'activities', activityId)), 4500, `deleteActivity:${activityId}`),
    ]);
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

  const deleteFinancialEvent = async (eventId: string) => {
    if (!eventId) return;
    setFinancialEvents(prev => prev.filter(e => e.id !== eventId));
    await Promise.allSettled([
      persistDeletedRecordIds([eventId]),
      cleanupLinkedActivityReferences(eventId),
      runWithTimeout(deleteDoc(doc(db, 'financial_events', eventId)), 4500, `deleteFinancialEvent:${eventId}`),
    ]);
  };

  const verifyProjectOnServer = async (
    projectId: string,
    requireSentToSecretariat = false
  ): Promise<{ ok: boolean; error?: string }> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 4500);
      });
      const snap = await Promise.race([
        getDocFromServer(doc(db, 'projects', projectId)),
        timeoutPromise,
      ]);
      if (!snap) {
        const restProbe = await probeFirestoreRestStatus('projects', projectId);
        const errMsg = !restProbe.ok && restProbe.message
          ? restProbe.message
          : `Vérification serveur non confirmée pour le projet ${projectId}.`;
        setCloudSyncError(errMsg);
        return { ok: false, error: errMsg };
      }
      if (!snap.exists()) {
        const errMsg = `Le projet (${projectId}) est absent du serveur Firestore après sauvegarde.`;
        setCloudSyncError(errMsg);
        return { ok: false, error: errMsg };
      }
      if (requireSentToSecretariat && snap.data()?.sentToSecretariat !== true) {
        const errMsg = `La transmission au Secrétariat (${projectId}) n’a pas été validée sur le serveur.`;
        setCloudSyncError(errMsg);
        return { ok: false, error: errMsg };
      }
      setCloudSyncError(null);
      return { ok: true };
    } catch (err: any) {
      const errMsg = formatFirestoreErrorMessage(err);
      setCloudSyncError(errMsg);
      return { ok: false, error: errMsg };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // Projets AGR
  const createProject = async (
    project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'> & { status?: AgrProject['status'] }
  ): Promise<{ ok: boolean; error?: string }> => {
    // Vérification stricte des droits : Responsable Projets (PROJET), Payor ou Super Admin
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['PROJET', 'PAYOR', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        return {
          ok: false,
          error: 'Action non autorisée : Seul le Responsable Projets (AGR) est habilité à initier des projets AGR / investissements.',
        };
      }
    }

    const realDate = project.dateRealisation || project.eventDate || '';
    const currentProjects = projectsRef.current;

    // Numérotation séquentielle sans collision (en évitant les IDs existants et les IDs purgés/supprimés)
    let maxProjSeq = 0;
    currentProjects.forEach(p => {
      if (!p.id) return;
      const m = p.id.match(/^PROJ-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxProjSeq) maxProjSeq = num;
      }
    });
    let nextProjSeq = maxProjSeq > 0 ? maxProjSeq + 1 : (currentProjects.length + 1);
    let seqProjId = `PROJ-${String(nextProjSeq).padStart(3, '0')}`;
    while (
      currentProjects.some(p => p.id === seqProjId) ||
      deletedRecordIdsRef.current.has(seqProjId) ||
      seqProjId === 'PROJ-001' ||
      seqProjId === 'PROJ-002'
    ) {
      nextProjSeq++;
      seqProjId = `PROJ-${String(nextProjSeq).padStart(3, '0')}`;
    }

    const nowMs = Date.now();
    const newProj: AgrProject = {
      ...project,
      id: seqProjId,
      dateRealisation: realDate,
      eventDate: realDate,
      status: project.status || 'DRAFT',
      officialDocGenerated: true,
      tresorierFeasibility: 'PENDING',
      currentReturn: 0,
      sentToSecretariat: false,
      sentToPayor: false,
      sentToCom: false,
      ackByCom: false,
      archivedBySecretariat: false,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const persisted = await persistFirestoreDoc('projects', newProj.id, newProj, false, `createProject:${newProj.id}`);
    if (!persisted.ok) {
      return persisted;
    }
    const verified = await verifyProjectOnServer(newProj.id, false);
    if (!verified.ok) {
      return verified;
    }

    setProjectsSynced(prev => sortProjectsList([newProj, ...prev.filter(p => p.id !== newProj.id)]));

    if (newProj.status === 'PUBLISHED' || newProj.status === 'active') {
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
    }
    return { ok: true };
  };

  const updateProject = async (
    projectId: string,
    updates: Partial<AgrProject>
  ): Promise<{ ok: boolean; error?: string }> => {
    const existing = projectsRef.current.find(p => p.id === projectId);
    const nowMs = Date.now();
    const mergedPayload = {
      ...(existing || {}),
      ...updates,
      id: projectId,
      updatedAtMs: nowMs,
    };
    const persisted = await persistFirestoreDoc('projects', projectId, mergedPayload, true, `updateProject:${projectId}`);
    if (!persisted.ok) {
      return persisted;
    }
    const verified = await verifyProjectOnServer(projectId, false);
    if (!verified.ok) {
      return verified;
    }
    setProjectsSynced(prev =>
      prev.map(p => (p.id === projectId ? { ...p, ...updates, updatedAtMs: nowMs } : p))
    );
    return { ok: true };
  };

  const sendProjectToSecretariat = async (projectId: string): Promise<{ ok: boolean; error?: string }> => {
    const proj = projectsRef.current.find(p => p.id === projectId);
    const nowMs = Date.now();
    const updates = {
      status: 'SENT_TO_SECRETARIAT' as const,
      sentToSecretariat: true,
      sentToSuivi: false,
      updatedAtMs: nowMs,
    };
    const fullPayload = {
      ...(proj || {}),
      id: projectId,
      ...updates,
    };
    const persisted = await persistFirestoreDoc('projects', projectId, fullPayload, true, `sendProjectToSecretariat:${projectId}`);
    if (!persisted.ok) {
      return persisted;
    }
    const verified = await verifyProjectOnServer(projectId, true);
    if (!verified.ok) {
      return verified;
    }
    if (deletedRecordIdsRef.current.has(projectId)) {
      unblockDeletedRecordIds([projectId]).catch(() => {});
    }
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));

    dispatchPushNotification({
      title: 'E-ROUAMA • Commission Projets 🚀',
      body: `Fiche Projet transmise au Secrétariat Général : "${proj?.title || projectId}".`,
      senderRole: 'PROJET',
      senderName: 'Commission Projets (AGR)',
      targetRole: 'SECRETARIAT',
      targetDepartment: 'secretariat',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
    return { ok: true };
  };

  const sendProjectsBatchToSecretariat = async (projectIds: string[]): Promise<{ ok: boolean; error?: string }> => {
    const nowMs = Date.now();
    const batchId = 'BATCH-PROJ-' + nowMs;
    const results = await Promise.all(
      projectIds.map(id => {
        const proj = projectsRef.current.find(p => p.id === id);
        const updates = {
          status: 'SENT_TO_SECRETARIAT' as const,
          sentToSecretariat: true,
          sentToSuivi: false,
          batchId,
          isConsolidated: true,
          updatedAtMs: nowMs,
        };
        return persistFirestoreDoc(
          'projects',
          id,
          { ...(proj || {}), id, ...updates },
          true,
          `sendProjectsBatchToSecretariat:${id}`
        );
      })
    );
    const failedWrite = results.find(r => !r.ok);
    if (failedWrite) {
      return failedWrite;
    }
    const verifications = await Promise.all(
      projectIds.map(id => verifyProjectOnServer(id, true))
    );
    const failedVerify = verifications.find(v => !v.ok);
    if (failedVerify) {
      return failedVerify;
    }

    const blockedIds = projectIds.filter(id => deletedRecordIdsRef.current.has(id));
    if (blockedIds.length > 0) {
      unblockDeletedRecordIds(blockedIds).catch(() => {});
    }
    setProjectsSynced(prev =>
      prev.map(p =>
        projectIds.includes(p.id)
          ? {
              ...p,
              status: 'SENT_TO_SECRETARIAT',
              sentToSecretariat: true,
              sentToSuivi: false,
              batchId,
              isConsolidated: true,
              updatedAtMs: nowMs,
            }
          : p
      )
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Dossier Global Projets 🚀',
      body: `Dossier consolidé de ${projectIds.length} projets transmis au Secrétariat Général.`,
      senderRole: 'PROJET',
      senderName: 'Commission Projets (AGR)',
      targetRole: 'SECRETARIAT',
      targetDepartment: 'secretariat',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
    return { ok: true };
  };

  const sendProjectFromSecretariatToSuivi = (projectId: string) => {
    const proj = projectsRef.current.find(p => p.id === projectId);
    const updates = { status: 'SENT_TO_SUIVI' as const, sentToSecretariat: true, sentToSuivi: true, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), sanitizeFirestore({ ...(proj || {}), id: projectId, ...updates }), { merge: true }).catch(err => {
      setCloudSyncError(formatFirestoreErrorMessage(err));
    });
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));

    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis le projet "${proj?.title || projectId}" au Chargé de Suivi pour instruction avant la réunion de cadrage.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendProjectsBatchFromSecretariatToSuivi = (projectIds: string[]) => {
    const nowMs = Date.now();
    projectIds.forEach(id => {
      const proj = projectsRef.current.find(p => p.id === id);
      const updates = { status: 'SENT_TO_SUIVI' as const, sentToSecretariat: true, sentToSuivi: true, updatedAtMs: nowMs };
      setDoc(doc(db, 'projects', id), sanitizeFirestore({ ...(proj || {}), id, ...updates }), { merge: true }).catch(err => {
        setCloudSyncError(formatFirestoreErrorMessage(err));
      });
    });
    setProjectsSynced(prev =>
      prev.map(p => (projectIds.includes(p.id) ? { ...p, status: 'SENT_TO_SUIVI', sentToSecretariat: true, sentToSuivi: true, updatedAtMs: nowMs } : p))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis le Dossier Global (${projectIds.length} projets) au Chargé de Suivi pour instruction pré-réunion.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendProjectFromSecretariatToPayor = (projectId: string) => {
    const proj = projectsRef.current.find(p => p.id === projectId);
    const updates = { status: 'PENDING_PAYOR' as const, sentToPayor: true, sentToSuivi: false, suiviReviewed: true, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), sanitizeFirestore({ ...(proj || {}), id: projectId, ...updates }), { merge: true }).catch(err => {
      setCloudSyncError(formatFirestoreErrorMessage(err));
    });
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));

    dispatchPushNotification({
      title: 'E-ROUAMA • Transmission Payor ⚖️',
      body: `Le projet "${proj?.title || projectId}" a été transmis pour visa officiel du Payor.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const sendProjectsBatchFromSecretariatToPayor = (projectIds: string[]) => {
    const nowMs = Date.now();
    projectIds.forEach(id => {
      const proj = projectsRef.current.find(p => p.id === id);
      const updates = { status: 'PENDING_PAYOR' as const, sentToPayor: true, sentToSuivi: false, suiviReviewed: true, updatedAtMs: nowMs };
      setDoc(doc(db, 'projects', id), sanitizeFirestore({ ...(proj || {}), id, ...updates }), { merge: true }).catch(err => {
        setCloudSyncError(formatFirestoreErrorMessage(err));
      });
    });
    setProjectsSynced(prev =>
      prev.map(p => (projectIds.includes(p.id) ? { ...p, status: 'PENDING_PAYOR', sentToPayor: true, sentToSuivi: false, suiviReviewed: true, updatedAtMs: nowMs } : p))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Transmission Payor ⚖️',
      body: `Le Dossier Global (${projectIds.length} projets) a été transmis pour visa officiel du Payor.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const approveProjectPayor = (projectId: string) => {
    const proj = projectsRef.current.find(p => p.id === projectId);
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
    const nowMs = Date.now();

    setDoc(
      doc(db, 'projects', projectId),
      sanitizeFirestore({
        ...(proj || {}),
        id: projectId,
        status: 'approved_by_payor',
        payorSignature,
        payorFeedback: '',
        sentToSecretariat: true,
        updatedAtMs: nowMs,
      }),
      { merge: true }
    ).catch(console.warn);

    setProjectsSynced(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              status: 'approved_by_payor',
              payorSignature,
              payorFeedback: '',
              sentToSecretariat: true,
              updatedAtMs: nowMs,
            }
          : p
      )
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Visa Payor Accordé ✅',
      body: `Le Payor (WOYA SYLAS) a validé et visé le projet "${proj?.title || projectId}".`,
      senderRole: 'PAYOR',
      senderName: 'WOYA SYLAS (LE PAYOR)',
      targetRole: 'ALL',
      type: 'GENERAL',
      url: '/',
    }).catch(console.warn);
  };

  const approveProjectsBatchPayor = (projectIds: string[]) => {
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
    const nowMs = Date.now();

    projectIds.forEach(id => {
      const proj = projectsRef.current.find(p => p.id === id);
      setDoc(
        doc(db, 'projects', id),
        sanitizeFirestore({
          ...(proj || {}),
          id,
          status: 'approved_by_payor',
          payorSignature,
          payorFeedback: '',
          sentToSecretariat: true,
          updatedAtMs: nowMs,
        }),
        { merge: true }
      ).catch(console.warn);
    });

    setProjectsSynced(prev =>
      prev.map(p =>
        projectIds.includes(p.id)
          ? {
              ...p,
              status: 'approved_by_payor',
              payorSignature,
              payorFeedback: '',
              sentToSecretariat: true,
              updatedAtMs: nowMs,
            }
          : p
      )
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Visa Payor Accordé ✅',
      body: `Le Payor (WOYA SYLAS) a validé et visé le Dossier Global (${projectIds.length} projets).`,
      senderRole: 'PAYOR',
      senderName: 'WOYA SYLAS (LE PAYOR)',
      targetRole: 'ALL',
      type: 'GENERAL',
      url: '/',
    }).catch(console.warn);
  };

  const returnProjectForCorrectionPayor = (projectId: string, feedback: string) => {
    const proj = projectsRef.current.find(p => p.id === projectId);
    const nowMs = Date.now();
    setDoc(
      doc(db, 'projects', projectId),
      sanitizeFirestore({
        ...(proj || {}),
        id: projectId,
        status: 'returned_for_correction',
        payorFeedback: feedback,
        sentToSecretariat: true,
        sentToSuivi: false,
        suiviReviewed: true,
        isPostMeetingRevision: true,
        updatedAtMs: nowMs,
      }),
      { merge: true }
    ).catch(console.warn);

    setProjectsSynced(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              status: 'returned_for_correction',
              payorFeedback: feedback,
              sentToSecretariat: true,
              sentToSuivi: false,
              suiviReviewed: true,
              isPostMeetingRevision: true,
              updatedAtMs: nowMs,
            }
          : p
      )
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Projet Retourné pour Correction ⚠️',
      body: `Le Payor a retourné le projet "${proj?.title || projectId}" avec observations : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'PROJET',
      targetDepartment: 'projet',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const returnProjectsBatchForCorrectionPayor = (projectIds: string[], feedback: string) => {
    const nowMs = Date.now();
    projectIds.forEach(id => {
      const proj = projectsRef.current.find(p => p.id === id);
      setDoc(
        doc(db, 'projects', id),
        sanitizeFirestore({
          ...(proj || {}),
          id,
          status: 'returned_for_correction',
          payorFeedback: feedback,
          sentToSecretariat: true,
          sentToSuivi: false,
          suiviReviewed: true,
          isPostMeetingRevision: true,
          updatedAtMs: nowMs,
        }),
        { merge: true }
      ).catch(console.warn);
    });
    setProjectsSynced(prev =>
      prev.map(p =>
        projectIds.includes(p.id)
          ? {
              ...p,
              status: 'returned_for_correction',
              payorFeedback: feedback,
              sentToSecretariat: true,
              sentToSuivi: false,
              suiviReviewed: true,
              isPostMeetingRevision: true,
              updatedAtMs: nowMs,
            }
          : p
      )
    );
    dispatchPushNotification({
      title: 'E-ROUAMA • Dossier Global Retourné pour Correction ⚠️',
      body: `Le Payor a retourné le Dossier Global (${projectIds.length} projets) : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'PROJET',
      targetDepartment: 'projet',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const splitProjectsBatchToIndividual = (projectIds: string[]) => {
    const nowMs = Date.now();
    projectIds.forEach(id => {
      setDoc(
        doc(db, 'projects', id),
        {
          isConsolidated: false,
          batchId: deleteField(),
          batchTitle: deleteField(),
          updatedAtMs: nowMs,
        },
        { merge: true }
      ).catch(console.warn);
    });
    setProjectsSynced(prev =>
      prev.map(p =>
        projectIds.includes(p.id)
          ? { ...p, isConsolidated: false, batchId: undefined, batchTitle: undefined, updatedAtMs: nowMs }
          : p
      )
    );
  };

  const sendProjectNoteToCom = (projectId: string) => {
    const updates = { sentToCom: true, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), updates, { merge: true }).catch(console.warn);
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));
  };

  const ackProjectCOM = (projectId: string) => {
    const updates = { ackByCom: true, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), updates, { merge: true }).catch(console.warn);
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));
  };

  const archiveProjectSecretariat = (projectId: string) => {
    const updates = { archivedBySecretariat: true, status: 'archived' as const, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), updates, { merge: true }).catch(console.warn);
    setProjectsSynced(prev => prev.map(p => (p.id === projectId ? { ...p, ...updates } : p)));
  };

  const assessProjectTresorier = (projectId: string, feasible: boolean) => {
    const status = feasible ? 'APPROVED' : 'REJECTED';
    const nowMs = Date.now();
    setDoc(doc(db, 'projects', projectId), { tresorierFeasibility: status, updatedAtMs: nowMs }, { merge: true }).catch(console.warn);
    setProjectsSynced(prev =>
      prev.map(p => (p.id === projectId ? { ...p, tresorierFeasibility: status, updatedAtMs: nowMs } : p))
    );
  };

  const publishProject = (projectId: string) => {
    // Vérification stricte des droits : seul le Responsable Projets (ou Super Admin) publie dans Gagne-Pain
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['PROJET', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        console.warn(`[Workflow] Publication projet refusée pour ${currentUser.adminRole}.`);
        return;
      }
    }

    const proj = projectsRef.current.find(p => p.id === projectId);
    if (!proj) return;
    const isPayorSigned =
      proj.status === 'approved_by_payor' ||
      proj.status === 'APPROVED_PAYOR' ||
      Boolean(proj.payorSignature?.signedBy);
    if (!isPayorSigned) {
      console.warn(`[Workflow] Publication refusée : le projet ${projectId} n'a pas encore reçu le visa du Payor.`);
      return;
    }

    const nowDisplay = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const updates = {
      status: 'PUBLISHED' as const,
      publishedAt: nowDisplay,
      publishedByDeptAt: new Date().toISOString(),
      sentToCom: true,
      gbairaiAlertSentByCom: false,
      updatedAtMs: Date.now(),
    };

    setDoc(doc(db, 'projects', projectId), sanitizeFirestore({ ...proj, ...updates }), { merge: true }).catch(console.warn);
    setProjectsSynced(prev =>
      prev.map(p => (p.id === projectId ? { ...p, ...updates } : p))
    );

    // Alerte automatique vers la Commission Communication (COM / BIC) pour notification globale sur Gbairai
    dispatchPushNotification({
      title: '🔔 Nouveau projet AGR publié (Gagne-Pain)',
      body: `La Commission Projets a publié "${proj.title}" (cotisations DJAI ouvertes). Prêt pour l'alerte globale sur le Gbairai.`,
      senderRole: 'PROJET',
      senderName: 'Responsable Projets',
      targetRole: 'COM',
      targetDepartment: 'com',
      type: 'INFO_REQUEST',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      url: '/',
    }).catch(console.warn);
  };

  const archiveProject = (projectId: string) => {
    const updates = { status: 'archived' as const, updatedAtMs: Date.now() };
    setDoc(doc(db, 'projects', projectId), updates, { merge: true }).catch(console.warn);
    setProjectsSynced(prev =>
      prev.map(p => (p.id === projectId ? { ...p, ...updates } : p))
    );
  };

  const deleteProject = async (projectId: string) => {
    if (!projectId) return;
    setProjectsSynced(prev => prev.filter(p => p.id !== projectId));
    await Promise.allSettled([
      persistDeletedRecordIds([projectId]),
      cleanupLinkedActivityReferences(projectId),
      runWithTimeout(deleteDoc(doc(db, 'projects', projectId)), 4500, `deleteProject:${projectId}`),
    ]);
  };

  // Secrétariat, PVs et Bilans
  const generateSequentialPvId = (): string => {
    // Format incrémentiel normé officiel : PV-001, PV-002, ...
    let maxSeq = 0;
    pvs.forEach(p => {
      if (!p.id) return;
      const match = p.id.match(/^PV-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else {
        const mLegacy = p.id.match(/\/(\d+)$/);
        if (mLegacy) {
          const num = parseInt(mLegacy[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    });

    let nextSeq = maxSeq > 0 ? maxSeq + 1 : (pvs.length + 1);
    let candidateId = `PV-${String(nextSeq).padStart(3, '0')}`;
    while (pvs.some(p => p.id === candidateId) || deletedRecordIdsRef.current.has(candidateId)) {
      nextSeq++;
      candidateId = `PV-${String(nextSeq).padStart(3, '0')}`;
    }
    return candidateId;
  };

  const createSecretaryPV = (pv: Omit<SecretaryPV, 'id' | 'status'> & { status?: SecretaryPV['status'] }) => {
    const generatedId = generateSequentialPvId();
    const newPv: SecretaryPV = {
      ...pv,
      id: generatedId,
      status: pv.status || 'DRAFT',
      sentToPayor: false,
      createdAt: new Date().toISOString(),
    };
    setDoc(doc(db, 'secretary_pvs', newPv.id), sanitizeFirestore(newPv)).catch(console.warn);
    setPvs(prev => [newPv, ...prev]);

    // Notification interne Secrétariat
    dispatchPushNotification({
      title: 'E-ROUAMA • Secrétariat Général 📝',
      body: `Procès-Verbal "${newPv.title}" enregistré sous la référence ${newPv.id}.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SECRETARIAT',
      type: 'PV_PUBLISHED',
      url: '/',
    }).catch(console.warn);
  };

  const sendPVFromSecretariatToPayor = (pvId: string) => {
    const targetPv = pvs.find(p => p.id === pvId);
    const updates = { status: 'SENT_TO_PAYOR' as const, sentToPayor: true };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));

    dispatchPushNotification({
      title: 'E-ROUAMA • Transmission Payor ⚖️',
      body: `Le Secrétariat a transmis le Procès-Verbal "${targetPv?.title || pvId}" pour visa officiel du Payor.`,
      senderRole: 'SECRÉTARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const approvePVPayor = (pvId: string) => {
    const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const payorSig = {
      role: 'PAYOR',
      signedBy: 'WOYA SYLAS (LE PAYOR)',
      signedAt: nowStr,
      stampUrl: '/SS.png',
    };
    const updates = {
      status: 'APPROVED_PAYOR' as const,
      payorSignature: payorSig,
      payorSignatureDate: nowStr,
      archivedBySecretariat: false,
      sentToCom: false,
      ackByCom: false,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev =>
      prev.map(p => (p.id === pvId ? { ...p, ...updates } : p))
    );
    const pv = pvs.find(p => p.id === pvId);
    if (pv) {
      dispatchPushNotification({
        title: 'E-ROUAMA : Décision Payor',
        body: `Procès-Verbal validé par le Payor : "${pv.title}". En attente d'archivage par le Secrétariat.`,
        senderRole: 'PAYOR',
        senderName: 'Espace Payor',
        targetRole: 'SECRETAIRE',
        type: 'PV_PUBLISHED',
        url: '/',
      }).catch(console.warn);
    }
  };

  const archivePVSecretariat = (pvId: string) => {
    const pv = pvs.find(p => p.id === pvId);
    if (!pv) return;
    const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const updates = {
      archivedBySecretariat: true,
      archivedAt: nowStr,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));

    const detailsHeader = [
      (pv.startTime || pv.endTime) ? `⏱️ Horaires : ${pv.startTime || '--:--'} à ${pv.endTime || '--:--'}` : null,
      pv.attendeesCount !== undefined && pv.attendeesCount !== null ? `👥 Participants : ${pv.attendeesCount} personne(s)` : null,
    ].filter(Boolean).join(' | ');

    const fullArchiveContent = detailsHeader
      ? `${detailsHeader}\n\n${pv.content}`
      : pv.content;

    const archiveDocId = 'ARCH-PV-' + pvId;
    const archiveItem: ArchiveDoc = {
      id: archiveDocId,
      title: pv.title,
      type: 'PV',
      content: fullArchiveContent,
      author: 'SECRÉTARIAT',
      date: pv.meetingDate,
      status: 'ARCHIVED',
      ackByCom: false,
      sentToComBySecretariat: false,
      archivedBySecretariat: true,
      metadata: {
        pvId: pv.id,
        refNumber: pv.refNumber,
        startTime: pv.startTime,
        endTime: pv.endTime,
        attendeesCount: pv.attendeesCount,
        agenda: pv.agenda,
        decisions: pv.decisions,
        secretarySignature: pv.secretarySignature,
        payorSignature: pv.payorSignature,
      },
    };
    setDoc(doc(db, 'archive_docs', archiveItem.id), sanitizeFirestore(archiveItem)).catch(console.warn);
    setArchiveDocs(prev => [archiveItem, ...prev.filter(a => a.id !== archiveDocId)]);
  };

  const sendPVNoteToCom = (pvId: string) => {
    const pv = pvs.find(p => p.id === pvId);
    if (!pv) return;
    const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const updates = {
      sentToCom: true,
      sentToComAt: nowStr,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));

    dispatchPushNotification({
      title: 'E-ROUAMA : Secrétariat Général',
      body: 'Un nouveau procès-verbal de réunion a été mis au grenier. Prière informer tous les membres',
      senderRole: 'SECRETAIRE',
      senderName: 'Secrétariat Général',
      targetRole: 'COM',
      type: 'PV_PUBLISHED',
      url: '/archives',
    }).catch(console.warn);
  };

  const ackPVCOM = (pvId: string) => {
    const pv = pvs.find(p => p.id === pvId);
    const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const updates = {
      ackByCom: true,
      ackByComAt: nowStr,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));

    if (pv) {
      dispatchPushNotification({
        title: 'Communication (BIC) : Accusé de Réception',
        body: `Accusé de réception (ACK) confirmé pour le PV "${pv.title}".`,
        senderRole: 'COM',
        senderName: 'Commission Communication',
        targetRole: 'SECRETAIRE',
        type: 'PV_ACK',
        url: '/',
      }).catch(console.warn);
    }
  };

  const publishPVCOM = (pvId: string) => {
    const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const updates = {
      publishedByCom: true,
      publishedByComAt: nowStr,
    };
    setDoc(doc(db, 'secretary_pvs', pvId), updates, { merge: true }).catch(console.warn);
    setPvs(prev => prev.map(p => (p.id === pvId ? { ...p, ...updates } : p)));

    const pv = pvs.find(p => p.id === pvId);
    if (pv) {
      publishNews(
        `📢 PV AU GRENIER : ${pv.title}`,
        `Le Procès-Verbal officiel de séance « ${pv.title} » (${pv.refNumber || pv.id}) du ${pv.meetingDate} est désormais disponible en consultation intégrale au Grenier des Archives.`,
        'ANNONCE',
        'TOUS',
        'COMMISSION COMMUNICATION (BIC)'
      );

      dispatchPushNotification({
        title: 'E-ROUAMA : Flash Communication',
        body: `Nouveau PV consultable au Grenier : "${pv.title}".`,
        senderRole: 'COM',
        senderName: 'Commission Communication',
        targetRole: 'ALL',
        type: 'PV_PUBLISHED',
        url: '/archives',
      }).catch(console.warn);
    }
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

  const deleteSecretaryPV = async (pvId: string) => {
    if (!pvId) return;
    setPvs(prev => prev.filter(p => p.id !== pvId));
    await Promise.allSettled([
      persistDeletedRecordIds([pvId]),
      runWithTimeout(deleteDoc(doc(db, 'secretary_pvs', pvId)), 4500, `deleteSecretaryPV:${pvId}`),
    ]);
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
      status: 'DRAFT',
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

    const targetBilan = bilans.find(b => b.id === bilanId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Bilan Financier Approuvé ✅',
      body: `Le Payor a visé et approuvé le bilan financier "${targetBilan?.period || bilanId}".`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'TRESORIER',
      targetDepartment: 'tresorerie',
      type: 'APPROVAL',
      url: '/',
    }).catch(console.warn);
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
      sentToSecretariat: true,
    };
    setDoc(doc(db, 'secretary_bilans', bilanId), updates, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b)));

    const targetBilan = bilans.find(b => b.id === bilanId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Bilan Retourné pour Correction ⚠️',
      body: `Le Payor a retourné le bilan "${targetBilan?.period || bilanId}" avec remarques : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'TRESORIER',
      targetDepartment: 'tresorerie',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const deleteFinancialBilan = async (bilanId: string) => {
    if (!bilanId) return;
    setBilans(prev => prev.filter(b => b.id !== bilanId));
    await Promise.allSettled([
      persistDeletedRecordIds([bilanId]),
      runWithTimeout(deleteDoc(doc(db, 'secretary_bilans', bilanId)), 4500, `deleteFinancialBilan:${bilanId}`),
    ]);
  };

  const sendBilanToSecretariat = (bilanId: string) => {
    const updates = { sentToSecretariat: true, status: 'SENT_TO_SECRETARIAT' as const };
    setDoc(doc(db, 'secretary_bilans', bilanId), updates, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b)));

    const targetBilan = bilans.find(b => b.id === bilanId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Bilan Transmis au Secrétariat 📄',
      body: `Le Trésorier a transmis le bilan "${targetBilan?.period || bilanId}" au Secrétariat Général.`,
      senderRole: 'TRESORIER',
      senderName: 'Trésorerie Générale',
      targetRole: 'SECRETAIRE',
      targetDepartment: 'secretariat',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendBilanFromSecretariatToPayor = (bilanId: string) => {
    const updates = { status: 'PENDING_PAYOR' as const };
    setDoc(doc(db, 'secretary_bilans', bilanId), updates, { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b)));

    const targetBilan = bilans.find(b => b.id === bilanId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Bilan Soumis au Payor ⚖️',
      body: `Le Secrétariat Général a transmis le bilan "${targetBilan?.period || bilanId}" pour approbation au Payor.`,
      senderRole: 'SECRETAIRE',
      senderName: 'Secrétariat Général',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
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
    const nowIso = new Date().toISOString();
    const resetPayload = { pin: '', pinCode: '', isRegistered: false, statut: "En attente d'activation", resetAt: nowIso, updatedAt: nowIso };
    setDoc(doc(db, 'users', memberId), resetPayload, { merge: true }).catch(console.warn);
    setDoc(doc(db, 'members', memberId), resetPayload, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, pin: undefined, pinCode: undefined, isRegistered: false, statut: "En attente d'activation", resetAt: nowIso } : m))
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
    const linkedAlertIds = programmeAlerts.filter(a => a.taskId === taskId).map(a => a.id);
    setProgrammeTasks(prev => prev.filter(t => t.id !== taskId));
    setProgrammeAlerts(prev => prev.filter(a => a.taskId !== taskId));
    try {
      await persistDeletedRecordIds([taskId, ...linkedAlertIds]);
      await Promise.allSettled([
        deleteDoc(doc(db, 'programme_tasks', taskId)),
        ...linkedAlertIds.map(aId => deleteDoc(doc(db, 'programme_alerts', aId))),
      ]);
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
      infoRequestsMapRef.current.set(id, newReq);
      setInfoRequests(prev => [newReq, ...prev.filter(r => r.id !== id)]);
      dismissDemoInfoRequests([], true).catch(() => {});

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

      const [r1, r2] = await Promise.allSettled([
        updateDoc(doc(db, 'info_requests', id), sanitizeFirestore(updates)),
        updateDoc(doc(db, 'navettes', id), sanitizeFirestore(updates)),
      ]);
      if (r1.status === 'rejected' && r2.status === 'rejected') {
        throw r1.reason;
      }
      if (infoRequestsMapRef.current.has(id)) {
        infoRequestsMapRef.current.set(id, { ...infoRequestsMapRef.current.get(id)!, ...updates });
      }
      if (navettesMapRef.current.has(id)) {
        navettesMapRef.current.set(id, { ...navettesMapRef.current.get(id)!, ...updates });
      }
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

      const [r1, r2] = await Promise.allSettled([
        updateDoc(doc(db, 'info_requests', id), sanitizeFirestore(updates)),
        updateDoc(doc(db, 'navettes', id), sanitizeFirestore(updates)),
      ]);
      if (r1.status === 'rejected' && r2.status === 'rejected') {
        throw r1.reason;
      }
      if (infoRequestsMapRef.current.has(id)) {
        infoRequestsMapRef.current.set(id, { ...infoRequestsMapRef.current.get(id)!, ...updates });
      }
      if (navettesMapRef.current.has(id)) {
        navettesMapRef.current.set(id, { ...navettesMapRef.current.get(id)!, ...updates });
      }
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
      const readUpdates = { isRead: true, updatedAt: new Date().toISOString() };
      const [r1, r2] = await Promise.allSettled([
        updateDoc(doc(db, 'info_requests', id), readUpdates),
        updateDoc(doc(db, 'navettes', id), readUpdates),
      ]);
      if (r1.status === 'rejected' && r2.status === 'rejected') {
        throw r1.reason;
      }
      if (infoRequestsMapRef.current.has(id)) {
        infoRequestsMapRef.current.set(id, { ...infoRequestsMapRef.current.get(id)!, isRead: true });
      }
      if (navettesMapRef.current.has(id)) {
        navettesMapRef.current.set(id, { ...navettesMapRef.current.get(id)!, isRead: true });
      }
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
    infoRequestsMapRef.current.delete(id);
    navettesMapRef.current.delete(id);
    setInfoRequests(prev => prev.filter(r => r.id !== id));
    try {
      await Promise.all([
        persistDeletedRecordIds([id]),
        dismissDemoInfoRequests([], true),
      ]);
      await Promise.allSettled([
        deleteDoc(doc(db, 'info_requests', id)),
        deleteDoc(doc(db, 'navettes', id)),
      ]);
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
    // Numérotation séquentielle automatique basée sur le dernier document existant (SPI-001, SPI-002, ...)
    let maxSpiSeq = 0;
    religiousEvents.forEach(e => {
      if (!e.id) return;
      const m = e.id.match(/^SPI-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSpiSeq) maxSpiSeq = num;
      }
    });
    let nextSpiSeq = maxSpiSeq > 0 ? maxSpiSeq + 1 : (religiousEvents.length + 1);
    let seqSpiId = `SPI-${String(nextSpiSeq).padStart(3, '0')}`;
    while (religiousEvents.some(e => e.id === seqSpiId) || deletedRecordIdsRef.current.has(seqSpiId)) {
      nextSpiSeq++;
      seqSpiId = `SPI-${String(nextSpiSeq).padStart(3, '0')}`;
    }

    const newEvt: ReligiousEvent = {
      ...eventData,
      id: seqSpiId,
      status: 'DRAFT',
      publishedToGbairai: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    await setDoc(doc(db, 'religious_events', newEvt.id), sanitizeFirestore(newEvt)).catch(console.warn);
    setReligiousEvents(prev => [newEvt, ...prev.filter(e => e.id !== newEvt.id)]);
    return newEvt.id;
  };

  const publishReligiousEventToGbairai = async (
    eventId: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'GENERAL'
  ) => {
    if (currentUser?.type === 'ADMIN') {
      const allowedRoles = ['SPIRITUALITE', 'SUPER_ADMIN'];
      if (!allowedRoles.includes(currentUser.adminRole || '')) {
        console.warn(`[Workflow] Publication spirituelle refusée pour ${currentUser.adminRole}.`);
        return;
      }
    }

    const evt = religiousEvents.find(e => e.id === eventId);
    if (!evt) return;
    if (evt.status !== 'APPROVED' && evt.status !== 'APPROVED_PAYOR' && !evt.payorSignature?.signedBy) {
      console.warn(`[Workflow] Publication refusée : l'événement spirituel ${eventId} n'a pas encore reçu le visa du Payor.`);
      return;
    }

    const publishedDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const updatedEvt: ReligiousEvent = {
      ...evt,
      status: 'PUBLISHED',
      publishedAt: publishedDate,
      publishedByDeptAt: new Date().toISOString(),
      dispatchChannel,
      publishedToGbairai: true,
      sentToCom: true,
      gbairaiAlertSentByCom: false,
    };

    await setDoc(doc(db, 'religious_events', eventId), sanitizeFirestore(updatedEvt), { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? updatedEvt : e));

    // Alerte automatique vers la Commission Communication (COM / BIC) pour notification globale sur Gbairai
    dispatchPushNotification({
      title: '🔔 Nouvel événement spirituel publié (Prière Rouama)',
      body: `La Commission Spiritualité a publié "${evt.title}" (${evt.eventDate}). Prêt pour l'alerte globale sur le Gbairai.`,
      senderRole: 'SPIRITUALITE',
      senderName: 'Commission Spiritualité',
      targetRole: 'COM',
      targetDepartment: 'com',
      type: 'INFO_REQUEST',
      rawTitle: true,
      priority: 'high',
      sound: 'default',
      url: '/',
    }).catch(console.warn);
  };

  const sendComGbairaiAlert = (type: 'ACTIVITY' | 'PROJECT' | 'RELIGIOUS_EVENT', id: string) => {
    if (type === 'ACTIVITY') {
      const act = activities.find(a => a.id === id);
      if (!act || act.status !== 'PUBLISHED') return;
      const contribTxt = act.requiredAmountPerMember
        ? ` Cotisation par membre : ${act.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA (rubrique DJAI ouverte).`
        : '';
      publishNews(
        `🎪 PROGRAMME OFFICIEL PUBLIÉ : ${act.title}`,
        `L'événement « ${act.title} » (${act.eventDate}${act.location ? ` • Lieu : ${act.location}` : ''}) a été validé par le Payor et officiellement publié par la Commission Organisation dans la rubrique SHOW !${contribTxt}`,
        'ANNONCE',
        'TOUS',
        'BIC / COMMUNICATION',
        'GENERAL',
        'ACTIVITES',
        act.id
      );
      dispatchPushNotification({
        title: '📢 Alerte Officielle • SHOW & DJAI',
        body: `${act.title} (${act.eventDate}) est officiellement publié !`,
        senderRole: 'COM',
        senderName: 'Communication (BIC)',
        targetRole: 'ALL',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
      setDoc(doc(db, 'activities', id), { gbairaiAlertSentByCom: true }, { merge: true }).catch(console.warn);
      setActivities(prev => prev.map(a => (a.id === id ? { ...a, gbairaiAlertSentByCom: true } : a)));
      return;
    }

    if (type === 'PROJECT') {
      const proj = projects.find(p => p.id === id);
      if (!proj || (proj.status !== 'PUBLISHED' && proj.status !== 'active')) return;
      publishNews(
        `🚀 PROJET AGR OUVERT AUX COTISATIONS : ${proj.title}`,
        `Le projet AGR "${proj.title}" a été validé par le Payor et officiellement publié par la Commission Projets ! Budget : ${(proj.estimatedCost || 0).toLocaleString('fr-FR')} F CFA. Contribution par membre : ${(proj.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA. Consultez GAGNE-PAIN et l'espace DJAI.`,
        'ANNONCE',
        'TOUS',
        'BIC / COMMUNICATION',
        'GENERAL',
        'FINANCES',
        proj.id
      );
      dispatchPushNotification({
        title: '📢 Alerte Officielle • Projet AGR & DJAI',
        body: `Le projet "${proj.title}" est publié et ouvert aux cotisations !`,
        senderRole: 'COM',
        senderName: 'Communication (BIC)',
        targetRole: 'ALL',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
      setDoc(doc(db, 'projects', id), { gbairaiAlertSentByCom: true }, { merge: true }).catch(console.warn);
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, gbairaiAlertSentByCom: true } : p)));
      return;
    }

    if (type === 'RELIGIOUS_EVENT') {
      const evt = religiousEvents.find(e => e.id === id);
      if (!evt || evt.status !== 'PUBLISHED') return;
      const title = `[ÉVÉNEMENT RELIGIEUX] ${evt.title}`;
      const content = `Date: ${evt.eventDate} à ${evt.eventTime}\nLieu: ${evt.location}${evt.theme ? `\nThème: ${evt.theme}` : ''}`;
      publishNews(
        title,
        content,
        'ANNONCE',
        'TOUS',
        'BIC / COMMUNICATION',
        evt.dispatchChannel || 'GENERAL',
        'PRIERE_ROUAMA',
        evt.id
      );
      dispatchPushNotification({
        title: '📢 Alerte Officielle • Prière Rouama',
        body: `${evt.title} — ${evt.eventDate} à ${evt.location}`,
        senderRole: 'COM',
        senderName: 'Communication (BIC)',
        targetRole: 'ALL',
        type: 'GENERAL',
        rawTitle: true,
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        url: '/',
      }).catch(console.warn);
      setDoc(doc(db, 'religious_events', id), { gbairaiAlertSentByCom: true }, { merge: true }).catch(console.warn);
      setReligiousEvents(prev => prev.map(e => (e.id === id ? { ...e, gbairaiAlertSentByCom: true } : e)));
    }
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
    if (!eventId) return;
    setReligiousEvents(prev => prev.filter(e => e.id !== eventId));
    await Promise.allSettled([
      persistDeletedRecordIds([eventId]),
      cleanupLinkedActivityReferences(eventId),
      runWithTimeout(deleteDoc(doc(db, 'religious_events', eventId)), 4500, `deleteReligiousEvent:${eventId}`),
    ]);
  };

  const createReligiousEvent = (
    eventData: Omit<ReligiousEvent, 'id' | 'publishedAt'>,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'GENERAL'
  ) => {
    let maxSpiSeq = 0;
    religiousEvents.forEach(e => {
      if (!e.id) return;
      const m = e.id.match(/^SPI-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSpiSeq) maxSpiSeq = num;
      }
    });
    let nextSpiSeq = maxSpiSeq > 0 ? maxSpiSeq + 1 : (religiousEvents.length + 1);
    let seqSpiId = `SPI-${String(nextSpiSeq).padStart(3, '0')}`;
    while (religiousEvents.some(e => e.id === seqSpiId) || deletedRecordIdsRef.current.has(seqSpiId)) {
      nextSpiSeq++;
      seqSpiId = `SPI-${String(nextSpiSeq).padStart(3, '0')}`;
    }

    const newEvt: ReligiousEvent = {
      ...eventData,
      id: seqSpiId,
      status: 'DRAFT',
      publishedToGbairai: false,
      gbairaiAlertSentByCom: false,
      sentToSecretariat: false,
      sentToPayor: false,
      sentToCom: false,
      ackByCom: false,
      createdAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      dispatchChannel,
    };
    setDoc(doc(db, 'religious_events', newEvt.id), sanitizeFirestore(newEvt)).catch(console.warn);
    setReligiousEvents(prev => [newEvt, ...prev]);
  };

  const sendReligiousEventToSecretariat = (eventId: string) => {
    const updates = {
      status: 'SENT_TO_SECRETARIAT' as const,
      sentToSecretariat: true,
      sentToSuivi: false,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const ev = religiousEvents.find(e => e.id === eventId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Fiche Spiritualité Transmise 📄',
      body: `Le département Spiritualité a transmis l'activité "${ev?.title || eventId}" au Secrétariat Général.`,
      senderRole: 'SPIRITUALITE',
      senderName: 'Département Spiritualité',
      targetRole: 'SECRETAIRE',
      targetDepartment: 'secretariat',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendReligiousEventsBatchToSecretariat = (eventIds: string[]) => {
    const batchId = 'BATCH-REL-' + Date.now();
    eventIds.forEach(id => {
      const updates = {
        status: 'SENT_TO_SECRETARIAT' as const,
        sentToSecretariat: true,
        sentToSuivi: false,
        batchId,
        isConsolidated: true,
      };
      setDoc(doc(db, 'religious_events', id), updates, { merge: true }).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e => (eventIds.includes(e.id) ? { ...e, status: 'SENT_TO_SECRETARIAT', sentToSecretariat: true, sentToSuivi: false, batchId, isConsolidated: true } : e))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Global Spiritualité Transmis 📋',
      body: `Le département Spiritualité a transmis un programme consolidé de ${eventIds.length} activités au Secrétariat Général.`,
      senderRole: 'SPIRITUALITE',
      senderName: 'Département Spiritualité',
      targetRole: 'SECRETAIRE',
      targetDepartment: 'secretariat',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendReligiousEventFromSecretariatToSuivi = (eventId: string) => {
    const updates = {
      status: 'SENT_TO_SUIVI' as const,
      sentToSecretariat: true,
      sentToSuivi: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const ev = religiousEvents.find(e => e.id === eventId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis l'activité spirituelle "${ev?.title || eventId}" au Chargé de Suivi pour instruction avant la réunion de cadrage.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendReligiousEventsBatchFromSecretariatToSuivi = (eventIds: string[]) => {
    eventIds.forEach(id => {
      const updates = {
        status: 'SENT_TO_SUIVI' as const,
        sentToSecretariat: true,
        sentToSuivi: true,
      };
      setDoc(doc(db, 'religious_events', id), updates, { merge: true }).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e => (eventIds.includes(e.id) ? { ...e, status: 'SENT_TO_SUIVI', sentToSecretariat: true, sentToSuivi: true } : e))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Instruction Chargé de Suivi 🕵️',
      body: `Le Secrétariat a transmis le programme spirituel consolidé (${eventIds.length} activités) au Chargé de Suivi pour instruction pré-réunion.`,
      senderRole: 'SECRETARIAT',
      senderName: 'Secrétariat Général',
      targetRole: 'SDP',
      targetDepartment: 'sdp',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendReligiousEventFromSecretariatToPayor = (eventId: string) => {
    const updates = {
      status: 'PENDING_PAYOR' as const,
      sentToPayor: true,
      sentToSuivi: false,
      suiviReviewed: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const ev = religiousEvents.find(e => e.id === eventId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Fiche Spiritualité Soumise au Payor ⚖️',
      body: `L'activité spirituelle "${ev?.title || eventId}" a été transmise au Payor pour validation.`,
      senderRole: 'SECRETAIRE',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const sendReligiousEventsBatchFromSecretariatToPayor = (eventIds: string[]) => {
    eventIds.forEach(id => {
      const updates = {
        status: 'PENDING_PAYOR' as const,
        sentToPayor: true,
        sentToSuivi: false,
        suiviReviewed: true,
      };
      setDoc(doc(db, 'religious_events', id), updates, { merge: true }).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e => (eventIds.includes(e.id) ? { ...e, status: 'PENDING_PAYOR', sentToPayor: true, sentToSuivi: false, suiviReviewed: true } : e))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Global Spiritualité Soumis au Payor ⚖️',
      body: `Le programme spirituel consolidé (${eventIds.length} activités) a été transmis pour validation au Payor.`,
      senderRole: 'SECRETAIRE',
      senderName: 'Secrétariat / Suivi',
      targetRole: 'PAYOR',
      targetDepartment: 'payor',
      type: 'DOCUMENT_TRANSMITTED',
      url: '/',
    }).catch(console.warn);
  };

  const approveReligiousEventPayor = (eventId: string) => {
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
    const updates = {
      status: 'APPROVED' as const,
      payorSignature,
      payorFeedback: '',
      sentToSecretariat: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const ev = religiousEvents.find(e => e.id === eventId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Activité Spirituelle Approuvée ✅',
      body: `Le Payor a visé et approuvé l'activité "${ev?.title || eventId}".`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'SPIRITUALITE',
      targetDepartment: 'spiritualite',
      type: 'APPROVAL',
      url: '/',
    }).catch(console.warn);
  };

  const approveReligiousEventsBatchPayor = (eventIds: string[]) => {
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
    eventIds.forEach(id => {
      const updates = {
        status: 'APPROVED' as const,
        payorSignature,
        payorFeedback: '',
        sentToSecretariat: true,
      };
      setDoc(doc(db, 'religious_events', id), updates, { merge: true }).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e => (eventIds.includes(e.id) ? { ...e, status: 'APPROVED', payorSignature, payorFeedback: '', sentToSecretariat: true } : e))
    );

    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Global Spirituel Approuvé ✅',
      body: `Le Payor a visé et validé le programme global consolidé comprenant ${eventIds.length} activités.`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'SPIRITUALITE',
      targetDepartment: 'spiritualite',
      type: 'APPROVAL',
      url: '/',
    }).catch(console.warn);
  };

  const returnReligiousEventForCorrectionPayor = (eventId: string, feedback: string) => {
    const updates = {
      status: 'returned_for_correction' as const,
      payorFeedback: feedback,
      sentToSecretariat: true,
      sentToSuivi: false,
      suiviReviewed: true,
      isPostMeetingRevision: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const ev = religiousEvents.find(e => e.id === eventId);
    dispatchPushNotification({
      title: 'E-ROUAMA • Activité Spirituelle Retournée ⚠️',
      body: `Le Payor a retourné l'activité "${ev?.title || eventId}" avec observations : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'SPIRITUALITE',
      targetDepartment: 'spiritualite',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const returnReligiousEventsBatchForCorrectionPayor = (eventIds: string[], feedback: string) => {
    eventIds.forEach(id => {
      const updates = {
        status: 'returned_for_correction' as const,
        payorFeedback: feedback,
        sentToSecretariat: true,
        sentToSuivi: false,
        suiviReviewed: true,
        isPostMeetingRevision: true,
      };
      setDoc(doc(db, 'religious_events', id), updates, { merge: true }).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e =>
        eventIds.includes(e.id)
          ? {
              ...e,
              status: 'returned_for_correction',
              payorFeedback: feedback,
              sentToSecretariat: true,
              sentToSuivi: false,
              suiviReviewed: true,
              isPostMeetingRevision: true,
            }
          : e
      )
    );
    dispatchPushNotification({
      title: 'E-ROUAMA • Programme Spirituel Global Retourné ⚠️',
      body: `Le Payor a retourné le Programme Spirituel Global (${eventIds.length} événements) : ${feedback.substring(0, 100)}`,
      senderRole: 'PAYOR',
      senderName: 'Espace Payor',
      targetRole: 'SPIRITUALITE',
      targetDepartment: 'spiritualite',
      type: 'INFO_REQUEST',
      url: '/',
    }).catch(console.warn);
  };

  const splitReligiousEventsBatchToIndividual = (eventIds: string[]) => {
    eventIds.forEach(id => {
      setDoc(
        doc(db, 'religious_events', id),
        {
          isConsolidated: false,
          batchId: deleteField(),
          batchTitle: deleteField(),
        },
        { merge: true }
      ).catch(console.warn);
    });
    setReligiousEvents(prev =>
      prev.map(e =>
        eventIds.includes(e.id)
          ? { ...e, isConsolidated: false, batchId: undefined, batchTitle: undefined }
          : e
      )
    );
  };

  const sendReligiousEventNoteToCom = (eventId: string) => {
    const updates = {
      sentToCom: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
  };

  const ackReligiousEventCOM = (eventId: string) => {
    const updates = {
      ackByCom: true,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
  };

  const archiveReligiousEventSecretariat = (eventId: string) => {
    const updates = {
      archivedBySecretariat: true,
      status: 'ARCHIVED' as const,
    };
    setDoc(doc(db, 'religious_events', eventId), updates, { merge: true }).catch(console.warn);
    setReligiousEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
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
        cloudSyncError,
        clearCloudSyncError,
        treasuryRegularizations,
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
        dismissedDemoRequestIds,
        demosDisabled,
        dismissDemoInfoRequests,
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
        sendReligiousEventToSecretariat,
        sendReligiousEventsBatchToSecretariat,
        sendReligiousEventFromSecretariatToSuivi,
        sendReligiousEventsBatchFromSecretariatToSuivi,
        sendReligiousEventFromSecretariatToPayor,
        sendReligiousEventsBatchFromSecretariatToPayor,
        approveReligiousEventPayor,
        approveReligiousEventsBatchPayor,
        returnReligiousEventForCorrectionPayor,
        returnReligiousEventsBatchForCorrectionPayor,
        splitReligiousEventsBatchToIndividual,
        sendReligiousEventNoteToCom,
        ackReligiousEventCOM,
        archiveReligiousEventSecretariat,
        setCurrentUser,
        switchWorkspace,
        activateMemberAccount,
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
        publishActivity,
        sendActivityToSecretariat,
        sendActivitiesBatchToSecretariat,
        sendActivityFromSecretariatToSuivi,
        sendActivitiesBatchFromSecretariatToSuivi,
        sendActivityFromSecretariatToPayor,
        sendActivitiesBatchFromSecretariatToPayor,
        approveActivityPayor,
        approveActivitiesBatchPayor,
        returnActivityForCorrectionPayor,
        returnActivitiesBatchForCorrectionPayor,
        splitActivitiesBatchToIndividual,
        sendActivityNoteToCom,
        ackActivityCOM,
        archiveActivitySecretariat,
        approveActivityBudgetTresorier,
        createFinancialEvent,
        archiveFinancialEvent,
        deleteFinancialEvent,
        createProject,
        updateProject,
        deleteProject,
        sendProjectToSecretariat,
        sendProjectsBatchToSecretariat,
        sendProjectFromSecretariatToSuivi,
        sendProjectsBatchFromSecretariatToSuivi,
        sendProjectFromSecretariatToPayor,
        sendProjectsBatchFromSecretariatToPayor,
        approveProjectPayor,
        approveProjectsBatchPayor,
        returnProjectForCorrectionPayor,
        returnProjectsBatchForCorrectionPayor,
        splitProjectsBatchToIndividual,
        sendProjectNoteToCom,
        ackProjectCOM,
        archiveProjectSecretariat,
        assessProjectTresorier,
        publishProject,
        archiveProject,
        sendComGbairaiAlert,
        createSecretaryPV,
        updateSecretaryPV,
        sendPVFromSecretariatToPayor,
        returnPVForCorrectionPayor,
        deleteSecretaryPV,
        approvePVPayor,
        archivePVSecretariat,
        sendPVNoteToCom,
        ackPVCOM,
        publishPVCOM,
        createFinancialBilan,
        updateFinancialBilan,
        returnBilanForCorrectionPayor,
        deleteFinancialBilan,
        approveBilanPayor,
        sendBilanToSecretariat,
        sendBilanFromSecretariatToPayor,
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
        refreshProjects,
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
