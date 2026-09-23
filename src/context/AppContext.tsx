import React, { createContext, useContext, useState, useEffect } from 'react';
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
  AgrProject,
  FinancialEvent,
  ArchiveDoc,
  SecretaryPV,
  FinancialBilan,
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
} from '../types';
import { INITIAL_ROUAMA_MEMBERS, ADMIN_USERS } from '../data/membersData';
import { sendEmailBroadcastAsync } from '../utils/emailService';
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

  // Spiritualité
  verseOfTheDay: VerseOfTheDay | null;
  prayerIntentions: PrayerIntention[];
  religiousEvents: ReligiousEvent[];
  updateVerseOfTheDay: (verse: string, reference?: string) => void;
  addPrayerIntention: (intention: string, memberNickname?: string, isChain?: boolean) => void;
  createReligiousEvent: (event: Omit<ReligiousEvent, 'id' | 'publishedAt'>, dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL') => void;

  // Auth
  setCurrentUser: (userOrUpdater: any) => void;
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
  rejectPayment: (declarationId: string, reason?: string) => Promise<void> | void;
  hideReceipt: (declarationId: string) => Promise<void>;
  deleteReceipt: (declarationId: string) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;

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

  createFinancialBilan: (title: string, period: string, summary: string) => FinancialBilan;
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
  updateMemberProfile: (
    memberId: string,
    updates: { firstName?: string; nickname?: string; fullRosterName?: string; phone?: string; email?: string; pin?: string; isRegistered?: boolean }
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
              pin: found.pin || defaultAdmin.pin,
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
        userObj = { type: 'MEMBER', id: (resolved as RouamaMember).id, member: resolved as RouamaMember };
      } else {
        userObj = { ...resolved };
        if (userObj.type === 'MEMBER' && userObj.member?.id && !userObj.id) {
          userObj.id = userObj.member.id;
        }
      }
      return userObj;
    });
  };

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

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
  });
  const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [activities, setActivities] = useState<EventActivity[]>([]);
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

    // 0.bis Nettoyage proactif initial des 2 déclarations de test de Wilfried (CAPELO) des 09/09/2026 et 18/09/2026
    const purgeTestDocs = async () => {
      try {
        const snap = await getDocs(collection(db, 'receipts'));
        snap.forEach((d) => {
          const data = d.data() as any;
          const isWilfried =
            data.memberId === '1' ||
            data.memberName?.toUpperCase()?.includes('WILFRIED') ||
            data.memberNickname?.toUpperCase()?.includes('CAPELO');
          const dateStr = String(data.date || '');
          const isTestDate = dateStr.includes('09/09/2026') || dateStr.includes('18/09/2026');
          if (isWilfried && isTestDate && (data.status === 'REJECTED' || data.isTest || data.rejectionReason?.includes('test'))) {
            deleteDoc(d.ref).catch(() => {});
            deleteDoc(doc(db, 'payments', d.id)).catch(() => {});
            deleteDoc(doc(db, 'declarations', d.id)).catch(() => {});
            deleteDoc(doc(db, 'transactions', d.id)).catch(() => {});
          }
        });
      } catch (err) {
        // Ignore if offline
      }
    };
    purgeTestDocs();

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

      const computed: Record<FundType, number> = {
        COTISATION: cotisations,
        ANNIVERSAIRE: anniversaire,
        LOISIRS: sorties,
        AGR: agr,
        CAS_SOCIAUX: casSociaux,
        SOIREE_ROUAMA: 0,
      };

      setFundBalances(prev => ({
        ...prev,
        ...computed,
      }));

      // Synchronisation sur Firestore
      setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(computed), { merge: true }).catch(() => {});
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
            deleteDoc(docSnap.ref).catch(() => {});
            deleteDoc(doc(db, 'payments', docId)).catch(() => {});
            deleteDoc(doc(db, 'declarations', docId)).catch(() => {});
            deleteDoc(doc(db, 'transactions', docId)).catch(() => {});
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

    // 2. MEMBRES DE L'ASSOCIATION (Persistance stricte sans reset ni écrasement)
    const unsubMembers = onSnapshot(
      collection(db, 'members'),
      async (snapshot) => {
        setIsFirebaseConnected(true);

        // RÈGLE 1 : Si la collection est complètement vide (0 document),
        // SEULEMENT ALORS on amorce les 12 membres officiels par défaut.
        if (snapshot.empty) {
          console.log('🌱 Initialisation unique de la collection members (0 document détecté)');
          const initialList: RouamaMember[] = [];
          for (const official of INITIAL_ROUAMA_MEMBERS) {
            initialList.push(official);
            setDoc(doc(db, 'members', official.id), sanitizeFirestore(official)).catch(console.warn);
          }
          setMembers(initialList);
          return;
        }

        // RÈGLE 2 : Si des données existent déjà dans Firestore,
        // STRICTEMENT conserver les données en ligne sans les remplacer ni les supprimer.
        const firestoreDocsMap = new Map<string, RouamaMember>();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          // Lecture de TOUTES les variantes possibles de clés pour le code PIN et la photo
          const userPin = data.pin || data.password || data.code || data.accessCode || data.activationCode || undefined;
          const userAvatar = data.avatar || data.photoURL || data.photoUrl || data.profilePicture || data.avatarUrl || undefined;

          firestoreDocsMap.set(docSnap.id, {
            id: docSnap.id,
            firstName: data.firstName || '',
            fullRosterName: data.fullRosterName || data.firstName || '',
            nickname: data.nickname || '',
            phone: data.phone || '',
            email: data.email || '',
            assignedRole: data.assignedRole,
            avatar: userAvatar,
            photoUrl: userAvatar,
            isRegistered: Boolean(data.isRegistered || userPin),
            pin: userPin,
            ...data,
          });
        });

        // Reconstituer la liste avec conservation intégrale des données Firestore
        const reconciledList: RouamaMember[] = [];
        const orderMap = new Map(INITIAL_ROUAMA_MEMBERS.map((m, idx) => [m.id, idx]));

        for (const official of INITIAL_ROUAMA_MEMBERS) {
          let existing = firestoreDocsMap.get(official.id);
          if (!existing) {
            for (const m of firestoreDocsMap.values()) {
              if (
                normalizeRosterString(m.nickname) === normalizeRosterString(official.nickname) ||
                normalizeRosterString(m.firstName) === normalizeRosterString(official.firstName) ||
                (m.fullRosterName && normalizeRosterString(m.fullRosterName).includes(normalizeRosterString(official.firstName))) ||
                (official.fullRosterName && normalizeRosterString(official.fullRosterName).includes(normalizeRosterString(m.firstName))) ||
                (official.id === '2' && (
                  normalizeRosterString(m.firstName) === 'ORTINIEL' ||
                  normalizeRosterString(m.nickname) === 'ESPRIT'
                )) ||
                (official.id === '11' && (
                  normalizeRosterString(m.nickname) === 'CLEMSO' ||
                  normalizeRosterString(m.firstName) === 'LEGER' ||
                  normalizeRosterString(m.firstName) === 'LÉGER'
                )) ||
                (m.phone && official.phone && m.phone.replace(/\D/g, '') === official.phone.replace(/\D/g, '')) ||
                (m.email && official.email && m.email.toLowerCase().trim() === official.email.toLowerCase().trim())
              ) {
                existing = m;
                break;
              }
            }
          }

          if (existing) {
            // STRICTEMENT CONSERVER LES DONNÉES EN LIGNE (PIN, isRegistered, rôles, etc.)
            // Synchronisation du prénom et surnom si mise à jour dans les constantes officielles
            const effectiveFirstName = official.firstName;
            const effectiveNickname = official.nickname;
            const effectiveFullRosterName = official.fullRosterName;

            // Mise à jour de Firestore si le profil a été actualisé
            if (
              existing.firstName !== effectiveFirstName ||
              existing.nickname !== effectiveNickname ||
              existing.fullRosterName !== effectiveFullRosterName
            ) {
              setDoc(doc(db, 'members', existing.id || official.id), {
                firstName: effectiveFirstName,
                login: effectiveFirstName,
                nickname: effectiveNickname,
                surname: effectiveNickname,
                fullRosterName: effectiveFullRosterName,
              }, { merge: true }).catch(console.warn);
            }

            // Synchronisation de l'email si celui-ci a été mis à jour dans le code source
            const effectiveEmail = official.email || existing.email || '';
            if (official.email && existing.email !== official.email) {
              setDoc(doc(db, 'members', existing.id || official.id), { email: official.email }, { merge: true }).catch(console.warn);
            }

            // Variantes de photo et de code PIN réelles issues de Firestore
            const existingRaw = existing as any;
            const photo = existing.photoUrl || existing.avatar || existingRaw.photoURL || existingRaw.profilePicture || existingRaw.avatarUrl || existingRaw.profileImage || existingRaw.image || official.photoUrl || official.avatar || undefined;
            const effectivePin = existing.pin || existingRaw.password || existingRaw.code || existingRaw.userPin || existingRaw.accessCode || existingRaw.activationCode || undefined;

            reconciledList.push({
              ...official,
              ...existing,
              firstName: effectiveFirstName,
              nickname: effectiveNickname,
              fullRosterName: effectiveFullRosterName,
              avatar: photo,
              photoUrl: photo,
              email: effectiveEmail,
              id: existing.id || official.id,
              isRegistered: Boolean(existing.isRegistered === true && effectivePin && effectivePin !== 'Non défini'),
              pin: effectivePin || undefined,
            });
          } else {
            // Membre manquant individuel : initialisé sans écraser les autres
            const newMember: RouamaMember = { ...official };
            reconciledList.push(newMember);
            setDoc(doc(db, 'members', official.id), sanitizeFirestore(newMember)).catch(console.warn);
          }
        }

        // Conserver les autres membres s'il y en a pour ne rien perdre
        firestoreDocsMap.forEach((m, id) => {
          if (!reconciledList.some(r => r.id === id)) {
            reconciledList.push(m);
          }
        });

        // Conserver l'ordre fraternel officiel (1 à 12)
        reconciledList.sort((a, b) => {
          const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
          const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
          return orderA - orderB;
        });

        setMembers(reconciledList);

        // Mettre à jour l'utilisateur actif si c'est un membre et rafraîchir sa photo de profil
        setCurrentUser((prev) => {
          if (prev && prev.type === 'MEMBER' && prev.member) {
            const fresh = reconciledList.find(m =>
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
              } catch (e) {}
              return { ...prev, member: updatedMember };
            }
          }
          return prev;
        });
      },
      (err) => {
        console.warn('Firestore members listener notification:', err);
      }
    );
    unsubscribes.push(unsubMembers);

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
            setDoc(doc(db, 'projects', item.id), { status: 'archived' }, { merge: true }).catch(console.warn);
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
            deleteDoc(docSnap.ref).catch(() => {});
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
        loaded.sort((a, b) => {
          const timeA = (a as any).createdAt || 0;
          const timeB = (b as any).createdAt || 0;
          if (timeA && timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        });
        setWithdrawals(loaded);
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
          setAdminUsers(prev => {
            return data.list.map((item: any) => ({
              ...item,
              pin: item.password || item.pin,
              password: item.password || item.pin,
            }));
          });
        }
      }
    });
    unsubscribes.push(unsubAdmins);

    const unsubAdminsColl = onSnapshot(collection(db, 'admins'), (snapshot) => {
      if (!snapshot.empty) {
        setAdminUsers(prev => {
          const map = new Map<string, AdminUser>();
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
            }
          });
          return Array.from(map.values());
        });
      }
    });
    unsubscribes.push(unsubAdminsColl);

    return () => {
      unsubscribes.forEach(u => u());
    };
  }, []);

  // CHARGEMENT AUTOMATIQUE AU RECHARGEMENT / RECONNEXION DU MEMBRE DEPUIS FIRESTORE
  useEffect(() => {
    if (currentUser?.type === 'MEMBER' && currentUser.member?.id) {
      const currentUserId = currentUser.member.id;
      const memberRef = doc(db, 'members', currentUserId);
      getDoc(memberRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const photo = data.photoUrl || data.avatar;
            if (photo) {
              setCurrentUser((prev) => {
                if (prev && prev.type === 'MEMBER' && prev.member && prev.member.id === currentUserId) {
                  if (prev.member.photoUrl === photo && prev.member.avatar === photo) {
                    return prev;
                  }
                  const updatedMember = {
                    ...prev.member,
                    photoUrl: photo,
                    avatar: photo,
                  };
                  try {
                    localStorage.setItem(
                      EROUAMA_ACTIVE_SESSION_KEY,
                      JSON.stringify({ ...prev, member: updatedMember })
                    );
                  } catch (e) {}
                  return {
                    ...prev,
                    member: updatedMember,
                  };
                }
                return prev;
              });
            }
          }
        })
        .catch((err) => {
          console.warn('Erreur chargement photo profil membre depuis Firestore:', err);
        });
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

    const candidatePin = fsData.pin || fsData.password || fsData.code;
    const isAlreadyRegistered = Boolean(fsData.isRegistered === true && candidatePin && candidatePin !== 'Non défini');

    // Si le compte est déjà activé avec un autre PIN, informer le membre
    if (isAlreadyRegistered && candidatePin !== pin) {
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
    // - Mets à jour directement son document dans Firestore :
    try {
      await updateDoc(doc(db, "members", memberId), {
        isRegistered: true,
        pin: pin,              // Enregistre le vrai PIN saisi
        avatar: avatarUrl || "",    // Enregistre l'URL ou image si présente
        lastLogin: new Date().toISOString()
      });
    } catch (err) {
      try {
        await setDoc(doc(db, 'members', memberId), {
          id: memberId,
          firstName: matched.firstName,
          nickname: matched.nickname,
          fullRosterName: matched.fullRosterName,
          isRegistered: true,
          pin: pin,
          avatar: avatarUrl || "",
          lastLogin: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err2) {
        console.error('Erreur finale Firebase registerMember:', err2);
      }
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
      pin: pin,
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

    const cleanInput = normalizeRosterString(inputName);
    const matched = findRosterMember(inputName);

    if (!matched) {
      return { success: false, message: "Désolé mais ce prénom ne correspond à aucun membre officiel Rouama. Vérifiez l'orthographe de votre prénom officiel." };
    }

    const memberId = matched.id;
    let fsData: any = {};
    try {
      const docSnap = await getDoc(doc(db, "members", memberId));
      if (docSnap.exists()) {
        fsData = docSnap.data();
      }
    } catch (e) {
      console.warn('Erreur lecture Firestore dans loginMember:', e);
    }

    const expectedPin = fsData.pin || fsData.password || fsData.code || matched.pin;
    const isRegistered = Boolean(fsData.isRegistered === true && expectedPin && expectedPin !== 'Non défini');

    const avatarUrl = (typeof fsData.avatar === 'string' && fsData.avatar.trim()) ||
      (typeof fsData.photoUrl === 'string' && fsData.photoUrl.trim()) ||
      (typeof fsData.photoURL === 'string' && fsData.photoURL.trim()) ||
      matched.avatar ||
      matched.photoUrl ||
      "";

    // Si le membre n'est pas encore activé dans Firestore (ou réinitialisé)
    // S'il fournit un code PIN à 4 chiffres, activation automatique lors de la première connexion
    if (!isRegistered || !expectedPin) {
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return {
          success: false,
          message: `Le compte de ${matched.nickname} est en attente d'activation. Veuillez saisir un code PIN à 4 chiffres pour l'activer.`
        };
      }

      try {
        await updateDoc(doc(db, "members", memberId), {
          isRegistered: true,
          pin: pin,
          avatar: avatarUrl || "",
          lastLogin: new Date().toISOString()
        });
      } catch (err) {
        await setDoc(doc(db, "members", memberId), {
          id: memberId,
          firstName: matched.firstName,
          nickname: matched.nickname,
          fullRosterName: matched.fullRosterName,
          isRegistered: true,
          pin: pin,
          avatar: avatarUrl || "",
          lastLogin: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      const activatedMember: RouamaMember = {
        ...matched,
        isRegistered: true,
        pin: pin,
        avatar: avatarUrl || matched.avatar,
        photoUrl: avatarUrl || matched.photoUrl,
      };

      setMembers(prev => prev.map(m => m.id === memberId ? activatedMember : m));
      setCurrentUser({ type: 'MEMBER', member: activatedMember });
      return { success: true, message: `Première connexion réussie ! Bienvenue chez vous, ${matched.nickname} !` };
    }

    // Le membre est déjà activé -> vérification du PIN saisi
    if (expectedPin !== pin) {
      return { success: false, message: 'Code PIN incorrect.' };
    }

    // PIN correct -> Enregistrement de lastLogin dans Firestore
    try {
      await updateDoc(doc(db, "members", memberId), {
        isRegistered: true,
        pin: pin,
        avatar: avatarUrl || "",
        lastLogin: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Erreur updateDoc lastLogin Firestore:', err);
    }

    const connectedMember: RouamaMember = {
      ...matched,
      isRegistered: true,
      pin: pin,
      avatar: avatarUrl || matched.avatar,
      photoUrl: avatarUrl || matched.photoUrl,
    };

    setMembers(prev => prev.map(m => m.id === memberId ? connectedMember : m));
    setCurrentUser({ type: 'MEMBER', member: connectedMember });
    return { success: true, message: `Bienvenue chez vous, ${connectedMember.nickname} !` };
  };

  // Connexion Admin
  const loginAdmin = (inputRoleOrLogin: string, pin: string) => {
    if (!inputRoleOrLogin || !inputRoleOrLogin.trim()) {
      return { success: false, message: "Veuillez saisir le rôle ou l'identifiant administrateur." };
    }

    const storedAdmins = getStoredAdminCredentials();
    const currentAdmins = adminUsers && adminUsers.length > 0 ? adminUsers : storedAdmins;

    const cleanInput = inputRoleOrLogin.trim().toUpperCase();
    const adminDef = currentAdmins.find(
      a =>
        a.id.toUpperCase() === cleanInput ||
        (a.loginId && a.loginId.toUpperCase() === cleanInput) ||
        a.roleName.toUpperCase().includes(cleanInput)
    );
    if (!adminDef) {
      return { success: false, message: 'Identifiant Administrateur invalide.' };
    }

    const expectedPassword = adminDef.password || adminDef.pin;
    if (!pin || (expectedPassword !== pin && adminDef.pin !== pin)) {
      return { success: false, message: 'Mot de passe Administrateur incorrect.' };
    }

    setCurrentUser({ type: 'ADMIN', adminRole: adminDef.id });
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
    setCurrentUser(null);
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
        d.isValidated === true ||
        s === 'validated' ||
        s === 'validé' ||
        s === 'valide' ||
        s === 'approved'
      );
    };

    const totalPaid = declarations
      .filter(d => 
        String(d.memberId).trim() === String(memberId).trim() && 
        (d.fund === 'COTISATION' || (d as any).caisse === 'Cotisation Mensuelle' || (d as any).type === 'Cotisation Mensuelle') && 
        isPaymentValidated(d)
      )
      .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

    const monthsPaid = Math.floor(totalPaid / 500);
    const unpaidMonths = Math.max(0, totalRequiredMonths - monthsPaid);

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
      status: 'PENDING',
      paymentType: isFull ? 'TOTAL' : 'TRANCHE',
      subCategory,
      receiptImage: resolvedReceiptImage,
      createdAt: Date.now(),
    } as any;

    try {
      // 1. Écriture DIRECTE et EXCLUSIVE dans Firestore via addDoc (aucun localStorage utilisé)
      const docRef = await addDoc(collection(db, 'receipts'), sanitizeFirestore(newDeclData));
      await updateDoc(docRef, { id: docRef.id });

      const displayCategory = fund === 'COTISATION'
        ? (amount >= 500 && amount % 500 === 0
            ? `Cotisation Mensuelle (${Math.floor(amount / 500)} mois)`
            : `Cotisation Mensuelle (${amount.toLocaleString('fr-FR')} F)`)
        : isFull
        ? 'Règlement Totalité'
        : 'Acompte par tranche';

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

  // 2. Valider le reçu (Trésorier -> Met à jour Firestore via updateDoc)
  const approvePayment = async (declarationId: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();

    const targetDecl = declarations.find(d => d.id === targetId);
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

    // EXIGENCE 3 : NORMALISATION DU STATUT LORS DE LA VALIDATION :
    // { status: 'validated', isValidated: true, validatedAt: new Date() }
    const validationPayload = {
      status: 'validated',
      isValidated: true,
      validatedAt: new Date(),
    };

    // 1. Enregistrement direct et persistant dans 'payments'
    try {
      await setDoc(doc(db, 'payments', targetId), sanitizeFirestore({
        ...targetDecl,
        id: targetId,
        type: normalizedType || (targetDecl as any).type || 'Cotisation Mensuelle',
        caisse: normalizedCaisse || (targetDecl as any).caisse || 'Cotisation Mensuelle',
        ...validationPayload,
      }), { merge: true });
    } catch (err) {
      console.warn('Erreur setDoc payments approvePayment:', err);
    }

    // 2. Synchronisation dans 'receipts'
    try {
      await updateDoc(doc(db, 'receipts', targetId), sanitizeFirestore(validationPayload));
    } catch (err) {
      console.warn('Fallback setDoc pour receipts approvePayment:', err);
      await setDoc(doc(db, 'receipts', targetId), sanitizeFirestore(validationPayload), { merge: true });
    }

    // 3. Créditer la caisse sur Firestore
    const amountVal = Number(targetDecl.amount) || Number((targetDecl as any).montant) || 0;
    const updatedFundBalances = {
      ...fundBalances,
      [targetDecl.fund]: (fundBalances[targetDecl.fund] || 0) + amountVal,
    };
    await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedFundBalances), { merge: true }).catch(console.warn);
    setFundBalances(updatedFundBalances);

    // 4. Enregistrer la transaction sur Firestore via addDoc (ID unique généré par Firestore)
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

    // 5. Déclencher l'alerte fraternelle Cerveau (Imputation chronologique stricte et exclusion de l'auteur)
    try {
      const payerId = targetDecl.memberId;
      const payerMember = members.find(m => m.id === payerId);
      const memberName = targetDecl.memberNickname || payerMember?.nickname || targetDecl.memberName || payerMember?.firstName || 'Un membre';

      if (targetDecl.fund === 'COTISATION') {
        const nbMoisPayes = Math.max(1, Math.floor(amountVal / 500));

        // Détermine le premier mois impayé du membre (imputation chronologique depuis Janvier 2026) :
        // On cumule les versements cotisations déjà validés pour ce membre avant ce reçu
        const previousTotalPaid = declarations
          .filter(d => 
            String(d.memberId).trim() === String(targetDecl.memberId).trim() && 
            d.fund === 'COTISATION' && 
            !d.isHidden && 
            d.status !== 'deleted' && 
            d.status !== 'hidden' &&
            (
              d.status === 'validated' || 
              d.status === 'Validé' || 
              d.status === 'approved' || 
              d.status === 'APPROVED' || 
              (d as any).isValidated === true ||
              String(d.status || '').toLowerCase().trim() === 'validated' ||
              String(d.status || '').toLowerCase().trim() === 'approved' ||
              String(d.status || '').toLowerCase().trim() === 'validé'
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

    // 6. SYNCHRONISATION EN TEMPS RÉEL DU CHAMP resteADevoir DU MEMBRE
    try {
      const payerId = targetDecl.memberId;
      const now = new Date();
      const currentMonthNum = now.getMonth() + 1;
      const nbMoisDus = Math.max(0, currentMonthNum - 1);
      const montantTotalDuInitiale = nbMoisDus * 500;

      const isPaymentValid = (d: any) => {
        if (!d) return false;
        if (d.isHidden || d.status === 'hidden' || d.status === 'deleted' || d.status === 'REJECTED' || d.status === 'rejected') return false;
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

      const allPaidCotisations = declarations
        .filter(d => 
          String(d.memberId).trim() === String(payerId).trim() && 
          (d.fund === 'COTISATION' || (d as any).caisse === 'Cotisation Mensuelle' || (d as any).type === 'Cotisation Mensuelle') &&
          (isPaymentValid(d) || d.id === targetId)
        )
        .reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).montant) || 0), 0);

      const resteApresValidation = Math.max(0, montantTotalDuInitiale - allPaidCotisations);

      await setDoc(doc(db, 'members', String(payerId)), { resteADevoir: resteApresValidation }, { merge: true }).catch(console.warn);
      setMembers(prev => prev.map(m => m.id === payerId ? { ...m, resteADevoir: resteApresValidation } : m));
    } catch (recalcErr) {
      console.warn('Erreur mise à jour resteADevoir:', recalcErr);
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
  };

  // Décaissements (Sauvegarde addDoc avec identifiant unique Firestore)
  const createWithdrawalRequest = async (fund: FundType, amount: number, reason: string) => {
    try {
      const docRef = await addDoc(collection(db, 'withdrawals'), sanitizeFirestore({
        requestedBy: 'TRÉSORIER',
        fund,
        amount,
        reason,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'PENDING',
        createdAt: Date.now(),
      }));
      await updateDoc(docRef, { id: docRef.id }).catch(() => {});
    } catch (e) {
      console.warn('Erreur addDoc createWithdrawalRequest:', e);
    }
  };

  const approveWithdrawal = async (requestId: string) => {
    const req = withdrawals.find(w => w.id === requestId);
    if (!req) return;

    try {
      await updateDoc(doc(db, 'withdrawals', requestId), { status: 'APPROVED' });
    } catch (e) {
      await setDoc(doc(db, 'withdrawals', requestId), { status: 'APPROVED' }, { merge: true }).catch(console.warn);
    }

    const updatedBalances = {
      ...fundBalances,
      [req.fund]: Math.max(0, fundBalances[req.fund] - req.amount),
    };
    await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedBalances), { merge: true }).catch(console.warn);
    setFundBalances(updatedBalances);

    try {
      const txRef = await addDoc(collection(db, 'transactions'), sanitizeFirestore({
        type: 'DECAISSEMENT',
        fund: req.fund,
        amount: req.amount,
        description: `Décaissement approuvé (${req.fund}) - Motif: ${req.reason}`,
        date: new Date().toLocaleDateString('fr-FR'),
        createdBy: 'CERVEAU (Validation)',
        createdAt: Date.now(),
      }));
      await updateDoc(txRef, { id: txRef.id }).catch(() => {});
    } catch (txErr) {
      console.warn('Erreur addDoc décaissement transaction:', txErr);
    }
  };

  const rejectWithdrawal = (requestId: string) => {
    setDoc(doc(db, 'withdrawals', requestId), { status: 'REJECTED' }, { merge: true }).catch(console.warn);
    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'REJECTED' } : w));
  };

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
      await deleteDoc(doc(db, 'news', newsId));
    } catch (err) {
      console.warn('Erreur lors de la suppression Firestore du communiqué (news) :', err);
    }
    try {
      await deleteDoc(doc(db, 'announcements', newsId));
    } catch (_) {}
    setNewsItems(prev => prev.filter(n => n.id !== newsId));
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
      signedBy: 'PAYOR E-ROUAMA (Direction Générale)',
      signedAt,
      stampUrl: '/SIDEPO.png',
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
  };

  const approvePVPayor = (pvId: string) => {
    setDoc(doc(db, 'secretary_pvs', pvId), { status: 'APPROVED_PAYOR' }, { merge: true }).catch(console.warn);
    setPvs(prev =>
      prev.map(p => (p.id === pvId ? { ...p, status: 'APPROVED_PAYOR' } : p))
    );
    const pv = pvs.find(p => p.id === pvId);
    if (pv) {
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

  const createFinancialBilan = (title: string, period: string, summary: string): FinancialBilan => {
    const totalIn = transactions.filter(t => t.type === 'DEPOT').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === 'DECAISSEMENT').reduce((sum, t) => sum + t.amount, 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const fullDate = `${dateStr} à ${timeStr}`;

    const newBilan: FinancialBilan = {
      id: 'BILAN-' + Date.now(),
      title,
      period,
      totalIn,
      totalOut,
      balances: { ...fundBalances },
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
    setDoc(doc(db, 'secretary_bilans', bilanId), sanitizeFirestore(updates), { merge: true }).catch(console.warn);
    setBilans(prev => prev.map(b => (b.id === bilanId ? { ...b, ...updates } : b)));
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

  const updateMemberProfile = async (
    memberId: string,
    updates: { firstName?: string; nickname?: string; fullRosterName?: string; phone?: string; email?: string; pin?: string; isRegistered?: boolean }
  ): Promise<boolean> => {
    try {
      const memberRef = doc(db, 'members', memberId);
      const cleaned = sanitizeFirestore(updates);
      await setDoc(memberRef, cleaned, { merge: true });

      setMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, ...updates } : m))
      );

      // Si l'utilisateur connecté est ce membre, mettre à jour la session active
      setCurrentUser(prev => {
        if (prev?.type === 'MEMBER' && prev.member?.id === memberId) {
          const updatedMember = { ...prev.member, ...updates };
          try {
            localStorage.setItem(
              EROUAMA_ACTIVE_SESSION_KEY,
              JSON.stringify({ ...prev, member: updatedMember })
            );
          } catch (e) {}
          return { ...prev, member: updatedMember };
        }
        return prev;
      });

      return true;
    } catch (err) {
      console.error('Erreur updateMemberProfile dans Firestore:', err);
      return false;
    }
  };

  const assignMemberRole = (memberId: string, role?: AdminRole) => {
    setDoc(doc(db, 'members', memberId), { assignedRole: role || null }, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, assignedRole: role } : m))
    );
  };

  const resetMemberPin = (memberId: string) => {
    setDoc(doc(db, 'members', memberId), { pin: null, isRegistered: false }, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, pin: undefined, isRegistered: false } : m))
    );
    try {
      const currentList = getStoredRegisteredUsers();
      const filtered = currentList.filter(u => u.id !== memberId);
      localStorage.setItem(EROUAMA_REGISTERED_USERS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to reset member pin in localStorage', e);
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
        verseOfTheDay,
        prayerIntentions,
        religiousEvents,
        updateVerseOfTheDay,
        addPrayerIntention,
        createReligiousEvent,
        setCurrentUser,
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
        rejectPayment,
        hideReceipt,
        deleteReceipt,
        deleteTransaction,
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
