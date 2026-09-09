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
  registerMember: (firstNameOrRosterName: string, pin: string) => { success: boolean; message: string };
  loginMember: (firstNameOrRosterName: string, pin: string) => { success: boolean; message: string };
  loginAdmin: (adminId: string, pin: string) => { success: boolean; message: string };
  updateAdminCredentials: (roleId: AdminRole, newLoginId: string, newPin: string) => { success: boolean; message: string };
  logout: () => void;

  // Helper
  getMemberDuesStatus: (memberId: string) => DuesStatus;
  getMemberDuesDetail: (memberId: string) => MemberDuesDetail;
  getMemberRubricProgress: (memberId: string, fund: FundType, subCategory?: string) => MemberRubricProgress;
  getActiveFinancialEvent: (fund: 'LOISIRS' | 'CAS_SOCIAUX') => FinancialEvent | undefined;
  getActiveAgrProject: () => AgrProject | undefined;
  getAllMembersRubricSummary: (fund: FundType, subCategory?: string) => {
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
  deleteReceipt: (declarationId: string) => Promise<void>;

  createWithdrawalRequest: (fund: FundType, amount: number, reason: string) => void;
  approveWithdrawal: (requestId: string) => void;
  rejectWithdrawal: (requestId: string) => void;

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
  approveActivityPayor: (activityId: string) => void;
  approveActivityBudgetTresorier: (activityId: string) => void;

  // Financial Events (Trésorier : Sorties & Cas Sociaux)
  createFinancialEvent: (event: Omit<FinancialEvent, 'id' | 'createdAt' | 'status'>) => void;
  archiveFinancialEvent: (eventId: string) => void;
  deleteFinancialEvent: (eventId: string) => void;

  // Projects AGR
  createProject: (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'>) => void;
  approveProjectPayor: (projectId: string) => void;
  assessProjectTresorier: (projectId: string, feasible: boolean) => void;
  publishProject: (projectId: string) => void;
  archiveProject: (projectId: string) => void;

  createSecretaryPV: (pv: Omit<SecretaryPV, 'id' | 'status'>) => void;
  approvePVPayor: (pvId: string) => void;
  publishPVCOM: (pvId: string) => void;

  createFinancialBilan: (title: string, period: string, summary: string) => FinancialBilan;
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
    dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL'
  ) => void;
  deleteNewsItem: (newsId: string) => void;
  assignMemberRole: (memberId: string, role?: AdminRole) => void;
  resetMemberPin: (memberId: string) => void;
  updateMemberAvatar: (memberId: string, avatarDataUrl: string) => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'erouama_app_state_v2';
const EROUAMA_REGISTERED_USERS_KEY = 'EROUAMA_REGISTERED_USERS';
const EROUAMA_ACTIVE_SESSION_KEY = 'erouama_active_session';
export const ADMIN_CREDENTIALS_KEY = 'erouama_admin_credentials';

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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const savedSession = localStorage.getItem(EROUAMA_ACTIVE_SESSION_KEY);
      if (savedSession) {
        return JSON.parse(savedSession);
      }
    } catch (e) {
      console.warn('Session locale non chargée:', e);
    }
    return null;
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // États applicatifs synchronisés en temps réel via Firestore
  const [members, setMembers] = useState<RouamaMember[]>(INITIAL_ROUAMA_MEMBERS);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(() => getStoredAdminCredentials());
  const [fundBalances, setFundBalances] = useState<Record<FundType, number>>({
    COTISATION: 0,
    ANNIVERSAIRE: 0,
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
      } else {
        localStorage.removeItem(EROUAMA_ACTIVE_SESSION_KEY);
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

    const unsubscribes: (() => void)[] = [];

    // 1. REÇUS DE PAIEMENT (Collection 'receipts' synchronisée EXCLUSIVEMENT en temps réel depuis Firestore)
    const unsubReceipts = onSnapshot(
      collection(db, 'receipts'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        const loaded: PaymentDeclaration[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));

        // Tri chronologique rigoureux : reçus les plus récents en premier
        loaded.sort((a, b) => {
          const timeA = (a as any).createdAt || 0;
          const timeB = (b as any).createdAt || 0;
          if (timeA && timeB) return timeB - timeA;
          return b.id.localeCompare(a.id);
        });

        // La liste affichée provient EXCLUSIVEMENT de Firestore pour tous les appareils
        setDeclarations(loaded);
      },
      (err) => {
        console.warn('Firestore receipts listener notification:', err);
      }
    );
    unsubscribes.push(unsubReceipts);

    // 2. MEMBRES DE L'ASSOCIATION (Synchronisation exacte des 12 membres officiels E-ROUAMA)
    const unsubMembers = onSnapshot(
      collection(db, 'members'),
      async (snapshot) => {
        setIsFirebaseConnected(true);
        const registeredRecords = getStoredRegisteredUsers();

        // 1. Détecter et supprimer les documents obsolètes ou non officiels de Firestore (ex: Habib/Nayou ou doublons)
        snapshot.forEach((docSnap) => {
          const dData = docSnap.data() as any;
          const docNick = normalizeRosterString(dData?.nickname || '');
          const docFirst = normalizeRosterString(dData?.firstName || '');
          const matchingOfficial = INITIAL_ROUAMA_MEMBERS.find(
            m => m.id === docSnap.id ||
                 normalizeRosterString(m.nickname) === docNick ||
                 normalizeRosterString(m.firstName) === docFirst
          );

          if (!matchingOfficial) {
            console.log('🗑️ Retrait membre non-officiel Firestore:', docSnap.id, dData?.nickname);
            deleteDoc(doc(db, 'members', docSnap.id)).catch(console.warn);
          } else if (docSnap.id !== matchingOfficial.id) {
            console.log('🔄 Migration id membre Firestore:', docSnap.id, 'vers id officiel:', matchingOfficial.id);
            deleteDoc(doc(db, 'members', docSnap.id)).catch(console.warn);
          }
        });

        // 2. Reconstituer la liste stricte des 12 membres officiels avec leurs statuts réels
        const reconciledList: RouamaMember[] = [];

        for (const official of INITIAL_ROUAMA_MEMBERS) {
          const matchedDoc = snapshot.docs.find(d => {
            if (d.id === official.id) return true;
            const data = d.data() as any;
            return normalizeRosterString(data?.nickname) === normalizeRosterString(official.nickname) ||
                   normalizeRosterString(data?.firstName) === normalizeRosterString(official.firstName);
          });

          const regRecord = registeredRecords.find(
            r => r.id === official.id ||
                 normalizeRosterString(r.firstName) === normalizeRosterString(official.firstName) ||
                 normalizeRosterString(r.nickname) === normalizeRosterString(official.nickname)
          );

          if (matchedDoc) {
            const firestoreData = matchedDoc.data() as any;
            const isReg = Boolean(firestoreData.isRegistered || regRecord);
            const userPin = firestoreData.pin || regRecord?.pin || undefined;
            const memberObj: RouamaMember = {
              ...official,
              ...firestoreData,
              id: official.id,
              firstName: official.firstName,
              fullRosterName: official.fullRosterName,
              nickname: official.nickname,
              isRegistered: isReg,
              pin: userPin,
              avatar: firestoreData.avatar || official.avatar,
              assignedRole: firestoreData.assignedRole || official.assignedRole,
              phone: firestoreData.phone || official.phone,
              email: firestoreData.email || official.email,
            };

            reconciledList.push(memberObj);

            // Mettre à jour si l'ID Firestore était incorrect ou si des champs doivent être alignés
            if (matchedDoc.id !== official.id || firestoreData.isRegistered !== isReg || firestoreData.pin !== userPin) {
              setDoc(doc(db, 'members', official.id), sanitizeFirestore(memberObj), { merge: true }).catch(console.warn);
            }
          } else {
            // Membre manquant sur Firestore, on l'initialise immédiatement
            const isReg = !!regRecord;
            const memberObj: RouamaMember = {
              ...official,
              isRegistered: isReg,
              pin: regRecord?.pin || undefined,
            };
            reconciledList.push(memberObj);
            setDoc(doc(db, 'members', official.id), sanitizeFirestore(memberObj)).catch(console.warn);
          }
        }

        // 3. Conserver l'ordre fraternel officiel (1 à 12)
        const orderMap = new Map(INITIAL_ROUAMA_MEMBERS.map((m, idx) => [m.id, idx]));
        reconciledList.sort((a, b) => {
          const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
          const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
          return orderA - orderB;
        });

        setMembers(reconciledList);

        // Mettre à jour l'utilisateur actif si c'est un membre
        setCurrentUser((prev) => {
          if (prev && prev.type === 'MEMBER' && prev.member) {
            const fresh = reconciledList.find(m =>
              m.id === prev.member!.id ||
              normalizeRosterString(m.firstName) === normalizeRosterString(prev.member!.firstName) ||
              normalizeRosterString(m.nickname) === normalizeRosterString(prev.member!.nickname)
            );
            if (fresh) {
              return { ...prev, member: fresh };
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
          setFundBalances(docSnap.data() as Record<FundType, number>);
        } else {
          const defaultBalances = {
            COTISATION: 0,
            ANNIVERSAIRE: 0,
            LOISIRS: 0,
            AGR: 0,
            CAS_SOCIAUX: 0,
          };
          setDoc(doc(db, 'treasury', 'balances'), defaultBalances).catch(console.warn);
          setFundBalances(defaultBalances);
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

    // 5. PROJETS AGR
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snapshot) => {
        const loaded: AgrProject[] = [];
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
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
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setNewsItems(loaded);
      },
      (err) => console.warn('News listener error:', err)
    );
    unsubscribes.push(unsubNews);

    // 7. TRANSACTIONS
    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const loaded: Transaction[] = [];
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
        loaded.sort((a, b) => b.id.localeCompare(a.id));
        setTransactions(loaded);
      },
      (err) => console.warn('Transactions listener error:', err)
    );
    unsubscribes.push(unsubTransactions);

    // 8. DÉCAISSEMENTS
    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawals'),
      (snapshot) => {
        const loaded: WithdrawalRequest[] = [];
        snapshot.forEach(d => loaded.push({ id: d.id, ...(d.data() as any) }));
        loaded.sort((a, b) => b.id.localeCompare(a.id));
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

    // 12. IDENTIFIANTS ADMINISTRATEURS
    const unsubAdmins = onSnapshot(doc(db, 'admin', 'credentials'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          setAdminUsers(data.list);
        }
      }
    });
    unsubscribes.push(unsubAdmins);

    return () => {
      unsubscribes.forEach(u => u());
    };
  }, []);

  // Réinitialisation globale de la base Firestore avec les 12 membres officiels
  const resetAllData = async () => {
    const registeredRecords = getStoredRegisteredUsers();

    // Nettoyer les membres obsolètes ou non officiels de Firestore
    for (const m of members) {
      if (!INITIAL_ROUAMA_MEMBERS.some(im => im.id === m.id)) {
        deleteDoc(doc(db, 'members', m.id)).catch(console.warn);
      }
    }

    const restoredMembers = INITIAL_ROUAMA_MEMBERS.map(m => {
      const regRecord = registeredRecords.find(
        r => r.id === m.id ||
          normalizeRosterString(r.firstName) === normalizeRosterString(m.firstName) ||
          normalizeRosterString(r.nickname) === normalizeRosterString(m.nickname)
      );
      if (regRecord) {
        return { ...m, isRegistered: true, pin: regRecord.pin };
      }
      return m;
    });

    for (const m of restoredMembers) {
      await setDoc(doc(db, 'members', m.id), sanitizeFirestore(m));
    }

    const defaultBalances = {
      COTISATION: 0,
      ANNIVERSAIRE: 0,
      LOISIRS: 0,
      AGR: 0,
      CAS_SOCIAUX: 0,
    };
    await setDoc(doc(db, 'treasury', 'balances'), defaultBalances);

    // Nettoyage reçus locaux & storage
    for (const d of declarations) {
      deleteDoc(doc(db, 'receipts', d.id)).catch(console.warn);
      deleteDoc(doc(db, 'declarations', d.id)).catch(console.warn);
    }
    for (const a of activities) {
      deleteDoc(doc(db, 'activities', a.id)).catch(console.warn);
    }
    for (const p of projects) {
      deleteDoc(doc(db, 'projects', p.id)).catch(console.warn);
    }

    setFundBalances(defaultBalances);
    setDeclarations([]);
    setTransactions([]);
    setWithdrawals([]);
    setNewsItems([]);
    setActivities([]);
    setProjects([]);
    setArchiveDocs([]);
    setPvs([]);
    setBilans([]);
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(EROUAMA_ACTIVE_SESSION_KEY);
  };

  // Helper pour trouver un membre (accent-insensible et casse-insensible pour les 12 membres officiels)
  const findRosterMember = (search: string) => {
    const clean = normalizeRosterString(search);
    if (!clean) return undefined;
    return members.find(m =>
      normalizeRosterString(m.firstName) === clean ||
      normalizeRosterString(m.nickname) === clean ||
      normalizeRosterString(m.fullRosterName).includes(clean)
    );
  };

  // Inscription d'un membre avec propagation immédiate sur Firebase
  const registerMember = (inputName: string, pin: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return { success: false, message: 'Le code PIN doit comporter exactement 4 chiffres.' };
    }

    const matched = findRosterMember(inputName);
    if (!matched) {
      return { success: false, message: "Désolé mais vous n'êtes pas Rouama. Vérifiez l'orthographe de votre prénom officiel." };
    }

    const registeredRecords = getStoredRegisteredUsers();
    const existingInStorage = registeredRecords.find(
      r => r.id === matched.id ||
        normalizeRosterString(r.firstName) === normalizeRosterString(matched.firstName) ||
        normalizeRosterString(r.nickname) === normalizeRosterString(matched.nickname)
    );

    if (matched.isRegistered || existingInStorage) {
      return { success: false, message: `Le membre ${matched.nickname} est déjà inscrit. Connectez-vous avec votre PIN.` };
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
    };

    // Mise à jour sur Firebase Firestore
    setDoc(doc(db, 'members', matched.id), sanitizeFirestore(updatedMember), { merge: true }).catch(err => {
      console.error('Erreur Firebase registerMember:', err);
    });

    setMembers(prev => prev.map(m => m.id === matched.id ? updatedMember : m));
    setCurrentUser({ type: 'MEMBER', member: updatedMember });
    return { success: true, message: `Bienvenue chez vous, ${updatedMember.nickname} !` };
  };

  // Connexion Membre (par prénom officiel ou surnom fraternel)
  const loginMember = (inputName: string, pin: string) => {
    if (!inputName || !inputName.trim()) {
      return { success: false, message: 'Veuillez saisir votre prénom ou surnom fraternel.' };
    }

    const cleanInput = normalizeRosterString(inputName);
    const matched = findRosterMember(inputName);

    const registeredRecords = getStoredRegisteredUsers();
    const storedRecord = registeredRecords.find(
      r => normalizeRosterString(r.firstName) === cleanInput ||
        normalizeRosterString(r.nickname) === cleanInput ||
        (matched && (
          r.id === matched.id ||
          normalizeRosterString(r.firstName) === normalizeRosterString(matched.firstName) ||
          normalizeRosterString(r.nickname) === normalizeRosterString(matched.nickname)
        ))
    );

    if (!matched && !storedRecord) {
      return { success: false, message: "Désolé mais vous n'êtes pas membre Rouama. Vérifiez l'orthographe de votre prénom officiel." };
    }

    const targetMember = matched || (storedRecord ? members.find(m => m.id === storedRecord.id) : undefined);
    const memberNickname = targetMember?.nickname || storedRecord?.nickname || cleanInput;
    const isRegistered = targetMember?.isRegistered || !!storedRecord;
    const expectedPin = targetMember?.pin || storedRecord?.pin;

    if (!isRegistered) {
      return { success: false, message: `Le membre ${memberNickname} n'est pas encore inscrit. Veuillez d'abord utiliser l'onglet INSCRIPTION pour créer votre code PIN (4 chiffres).` };
    }

    if (!pin || expectedPin !== pin) {
      return { success: false, message: 'Code PIN incorrect.' };
    }

    const baseMember = targetMember || {
      id: storedRecord?.id || 'm-' + Date.now(),
      firstName: storedRecord?.firstName || cleanInput,
      fullRosterName: storedRecord?.firstName || cleanInput,
      nickname: storedRecord?.nickname || cleanInput,
      phone: '',
      isRegistered: true,
    };

    const memberToLogin: RouamaMember = {
      ...baseMember,
      isRegistered: true,
      pin: expectedPin,
    };

    setCurrentUser({ type: 'MEMBER', member: memberToLogin });
    return { success: true, message: `Content de vous revoir, ${memberToLogin.nickname} !` };
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

    if (!pin || adminDef.pin !== pin) {
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

    const updatedAdmins = adminUsers.map(a =>
      a.id === roleId
        ? { ...a, loginId: newLoginId.trim(), pin: newPin.trim() }
        : a
    );

    setAdminUsers(updatedAdmins);
    saveStoredAdminCredentials(updatedAdmins);

    // Synchronisation Firestore
    setDoc(doc(db, 'admin', 'credentials'), { list: sanitizeFirestore(updatedAdmins) }, { merge: true }).catch(console.warn);

    return { success: true, message: `Identifiants pour le poste ${roleId} mis à jour et enregistrés avec succès !` };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // Calcul du statut des cotisations
  const getMemberDuesDetail = (memberId: string): MemberDuesDetail => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthNum = now.getMonth() + 1;

    const totalRequiredMonths = currentDay >= 28 ? currentMonthNum : Math.max(0, currentMonthNum - 1);
    const totalExpectedAmount = totalRequiredMonths * 500;

    const totalPaid = declarations
      .filter(d => d.memberId === memberId && d.fund === 'COTISATION' && d.status === 'APPROVED')
      .reduce((sum, d) => sum + d.amount, 0);

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
      case 'LOISIRS': {
        const activeEvt = financialEvents.find(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
        return activeEvt ? activeEvt.requiredAmountPerMember : 0;
      }
      case 'CAS_SOCIAUX': {
        const activeEvt = financialEvents.find(e => {
          if (e.fund !== 'CAS_SOCIAUX' || e.status !== 'PUBLISHED') return false;
          if (subCategory && e.subCategory && e.subCategory !== subCategory) return false;
          return true;
        });
        return activeEvt ? activeEvt.requiredAmountPerMember : 0;
      }
      case 'COTISATION': {
        const now = new Date();
        return Math.max(500, (now.getMonth() + 1) * 500);
      }
      case 'AGR': {
        const activeProj = projects.find(p => p.status === 'PUBLISHED');
        return activeProj ? (activeProj.requiredAmountPerMember || 0) : 0;
      }
      default:
        return 0;
    }
  };

  const getMemberRubricProgress = (
    memberId: string,
    fund: FundType,
    subCategory?: string
  ): MemberRubricProgress => {
    const totalRequired = getRequiredAmountForRubric(fund, subCategory);

    const memberDecls = declarations.filter(d => {
      if (d.memberId !== memberId || d.fund !== fund) return false;
      if (subCategory && d.subCategory && d.subCategory !== subCategory) return false;
      return true;
    });

    const totalAdvanced = memberDecls
      .filter(d => d.status === 'APPROVED')
      .reduce((sum, d) => sum + d.amount, 0);

    const pendingAmount = memberDecls
      .filter(d => d.status === 'PENDING')
      .reduce((sum, d) => sum + d.amount, 0);

    const remainingDue = totalRequired > 0 ? Math.max(0, totalRequired - totalAdvanced) : 0;

    let status: 'SOLDE' | 'EN_COURS' | 'NON_ENTAME' = 'NON_ENTAME';
    if (totalRequired > 0 && totalAdvanced >= totalRequired) {
      status = 'SOLDE';
    } else if (totalAdvanced > 0) {
      status = 'EN_COURS';
    } else {
      status = 'NON_ENTAME';
    }

    let title = FUND_LABELS[fund];
    if (fund === 'CAS_SOCIAUX') {
      const activeEvt = financialEvents.find(e => e.fund === 'CAS_SOCIAUX' && e.status === 'PUBLISHED');
      if (activeEvt) {
        title = activeEvt.title;
      } else if (subCategory) {
        title = `Cas Sociaux (${subCategory})`;
      }
    } else if (fund === 'LOISIRS') {
      const activeEvt = financialEvents.find(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
      if (activeEvt) {
        title = activeEvt.title;
      }
    } else if (fund === 'AGR') {
      const activeProj = projects.find(p => p.status === 'PUBLISHED');
      if (activeProj) {
        title = activeProj.title;
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

  const getAllMembersRubricSummary = (fund: FundType, subCategory?: string) => {
    const list = members.map(m => {
      const progress = getMemberRubricProgress(m.id, fund, subCategory);
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
      if (amount < 500 || amount % 500 !== 0) {
        return {
          success: false,
          message: 'La cotisation mensuelle est fixée à 500 F CFA par mois. Le montant doit être de 500 F CFA ou un multiple.'
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
        ? `Cotisation Mensuelle (${Math.round(amount / 500)} mois)`
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

    // 1. Mettre à jour le statut du reçu sur Firestore dans 'receipts' via updateDoc
    try {
      await updateDoc(doc(db, 'receipts', targetId), { status: 'APPROVED' });
    } catch (err) {
      console.warn('Fallback setDoc pour receipts approvePayment:', err);
      await setDoc(doc(db, 'receipts', targetId), { status: 'APPROVED' }, { merge: true });
    }

    // 2. Créditer la caisse sur Firestore
    const updatedFundBalances = {
      ...fundBalances,
      [targetDecl.fund]: (fundBalances[targetDecl.fund] || 0) + targetDecl.amount,
    };
    await setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedFundBalances), { merge: true }).catch(console.warn);
    setFundBalances(updatedFundBalances);

    // 3. Enregistrer la transaction sur Firestore
    const displayRef =
      typeof targetDecl.reference === 'string' && targetDecl.reference.startsWith('data:')
        ? 'Capture de reçu'
        : targetDecl.reference || 'Preuve validée';

    const newTx: Transaction = {
      id: 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: 'DEPOT',
      fund: targetDecl.fund,
      amount: targetDecl.amount,
      description: `Dépôt validé (${FUND_LABELS[targetDecl.fund] || targetDecl.fund}) par ${targetDecl.memberNickname} - Réf: ${displayRef}`,
      memberNickname: targetDecl.memberNickname,
      date: new Date().toLocaleDateString('fr-FR'),
      createdBy: 'TRÉSORIER',
    };
    await setDoc(doc(db, 'transactions', newTx.id), sanitizeFirestore(newTx)).catch(console.warn);

    // 4. Déclencher l'alerte fraternelle Cerveau
    try {
      if (targetDecl.memberNickname) {
        broadcastCerveauAlert(
          targetDecl.memberNickname,
          targetDecl.month || `${FUND_LABELS[targetDecl.fund] || targetDecl.fund} (${targetDecl.amount.toLocaleString('fr-FR')} F CFA)`
        );
      }
    } catch (e) {
      console.warn('Alerte Cerveau non émise:', e);
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

  // 4. Supprimer un reçu sur Firestore via deleteDoc (Trésorier)
  const deleteReceipt = async (declarationId: string) => {
    if (!declarationId) return;
    const targetId = declarationId.trim();
    try {
      await deleteDoc(doc(db, 'receipts', targetId));
    } catch (err) {
      console.error('Erreur deleteReceipt Firestore:', err);
    }
  };

  // Alerte Cerveau
  const broadcastCerveauAlert = (
    titleOrMember: string,
    contentOrMonth?: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'APP'
  ) => {
    const rawContent = contentOrMonth || '';
    const isFormattedMonth = typeof rawContent === 'string' && rawContent.includes('-') && rawContent.length === 7;
    const formattedDate = isFormattedMonth
      ? new Date(rawContent + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : rawContent;

    const alertTitle = titleOrMember.startsWith('🟢') || titleOrMember.startsWith('🚨')
      ? titleOrMember
      : `🚨 ALERTE CERVEAU : ${titleOrMember}`;

    const alertContent = isFormattedMonth
      ? `${titleOrMember} vient de s'acquitter de sa cotisation pour le mois de ${formattedDate}. Bravo pour l'engagement fraternel !`
      : rawContent
      ? `${titleOrMember} a effectué un versement pour ${rawContent}. Validé par le Trésorier.`
      : `Versement validé par le Trésorier pour ${titleOrMember}.`;

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
    };

    setDoc(doc(db, 'news', alertNews.id), sanitizeFirestore(alertNews)).catch(console.warn);
    setNewsItems(prev => [alertNews, ...prev]);

    if (dispatchChannel === 'MAIL' || dispatchChannel === 'GENERAL') {
      try {
        sendEmailBroadcastAsync(alertTitle, alertContent, members, 'CERVEAU', dispatchChannel);
      } catch (e) {
        console.warn('sendEmailBroadcastAsync non abouti:', e);
      }
    }
  };

  // Décaissements
  const createWithdrawalRequest = (fund: FundType, amount: number, reason: string) => {
    const req: WithdrawalRequest = {
      id: 'WITH-' + Date.now(),
      requestedBy: 'TRÉSORIER',
      fund,
      amount,
      reason,
      date: new Date().toLocaleDateString('fr-FR'),
      status: 'PENDING',
    };
    setDoc(doc(db, 'withdrawals', req.id), sanitizeFirestore(req)).catch(console.warn);
    setWithdrawals(prev => [req, ...prev]);
  };

  const approveWithdrawal = (requestId: string) => {
    const req = withdrawals.find(w => w.id === requestId);
    if (!req) return;

    setDoc(doc(db, 'withdrawals', requestId), { status: 'APPROVED' }, { merge: true }).catch(console.warn);
    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'APPROVED' } : w));

    const updatedBalances = {
      ...fundBalances,
      [req.fund]: Math.max(0, fundBalances[req.fund] - req.amount),
    };
    setDoc(doc(db, 'treasury', 'balances'), sanitizeFirestore(updatedBalances), { merge: true }).catch(console.warn);
    setFundBalances(updatedBalances);

    const newTx: Transaction = {
      id: 'TX-OUT-' + Date.now(),
      type: 'DECAISSEMENT',
      fund: req.fund,
      amount: req.amount,
      description: `Décaissement approuvé (${req.fund}) - Motif: ${req.reason}`,
      date: new Date().toLocaleDateString('fr-FR'),
      createdBy: 'CERVEAU (Validation)',
    };
    setDoc(doc(db, 'transactions', newTx.id), sanitizeFirestore(newTx)).catch(console.warn);
    setTransactions(prev => [newTx, ...prev]);
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
    const item: NewsItem = {
      id: 'NEWS-' + Date.now(),
      title,
      content,
      category,
      targetAudience,
      authorRole,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      readBy: [],
      dispatchChannel,
      linkTab,
      targetDocId,
    };
    setDoc(doc(db, 'news', item.id), sanitizeFirestore(item)).catch(console.warn);
    setNewsItems(prev => [item, ...prev]);

    if (dispatchChannel === 'MAIL' || dispatchChannel === 'GENERAL') {
      sendEmailBroadcastAsync(title, content, members, authorRole, dispatchChannel);
    }
  };

  const markNewsAsRead = (newsId: string) => {
    if (!currentUser?.member) return;
    const memberId = currentUser.member.id;
    const item = newsItems.find(n => n.id === newsId);
    if (item && !item.readBy.includes(memberId)) {
      const updatedReadBy = [...item.readBy, memberId];
      setDoc(doc(db, 'news', newsId), { readBy: updatedReadBy }, { merge: true }).catch(console.warn);
      setNewsItems(prev =>
        prev.map(n => n.id === newsId ? { ...n, readBy: updatedReadBy } : n)
      );
    }
  };

  const deleteNewsItem = (newsId: string) => {
    deleteDoc(doc(db, 'news', newsId)).catch(console.warn);
    setNewsItems(prev => prev.filter(n => n.id !== newsId));
  };

  // Activités & Sorties
  const createActivity = (activity: Omit<EventActivity, 'id' | 'status' | 'budgetStatus'>) => {
    const newAct: EventActivity = {
      ...activity,
      id: 'ACT-' + Date.now(),
      status: 'PENDING_PAYOR',
      budgetStatus: activity.budget > 0 ? 'PENDING_TRESORIER' : 'NONE',
    };
    setDoc(doc(db, 'activities', newAct.id), sanitizeFirestore(newAct)).catch(console.warn);
    setActivities(prev => [newAct, ...prev]);
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
  const createProject = (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'>) => {
    const newProj: AgrProject = {
      ...project,
      id: 'PROJ-' + Date.now(),
      status: 'PENDING_PAYOR',
      tresorierFeasibility: 'PENDING',
      currentReturn: 0,
    };
    setDoc(doc(db, 'projects', newProj.id), sanitizeFirestore(newProj)).catch(console.warn);
    setProjects(prev => [newProj, ...prev]);
  };

  const approveProjectPayor = (projectId: string) => {
    setDoc(doc(db, 'projects', projectId), { status: 'APPROVED_PAYOR' }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'APPROVED_PAYOR' } : p))
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
    setDoc(doc(db, 'projects', projectId), { status: 'PUBLISHED' }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'PUBLISHED' } : p))
    );
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      publishNews(
        `🚀 PROJET AGR OUVERT AUX COTISATIONS : ${proj.title}`,
        `Le projet ${proj.title} est officiellement ouvert aux cotisations ! Montant total : ${proj.estimatedCost.toLocaleString('fr-FR')} F CFA. Contribution requise par membre : ${(proj.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA.`,
        'ANNONCE',
        'TOUS',
        'COMMISSION PROJET',
        'APP',
        'FINANCES'
      );
    }
  };

  const archiveProject = (projectId: string) => {
    setDoc(doc(db, 'projects', projectId), { status: 'ARCHIVED' }, { merge: true }).catch(console.warn);
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'ARCHIVED' } : p))
    );
  };

  // Secrétariat, PVs et Bilans
  const createSecretaryPV = (pv: Omit<SecretaryPV, 'id' | 'status'>) => {
    const newPv: SecretaryPV = {
      ...pv,
      id: 'PV-' + Date.now(),
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

  const updateMemberAvatar = (memberId: string, avatarDataUrl: string) => {
    setDoc(doc(db, 'members', memberId), { avatar: avatarDataUrl }, { merge: true }).catch(console.warn);
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, avatar: avatarDataUrl } : m))
    );

    setCurrentUser(prev => {
      if (prev && prev.type === 'MEMBER' && prev.member && prev.member.id === memberId) {
        return {
          ...prev,
          member: {
            ...prev.member,
            avatar: avatarDataUrl,
          },
        };
      }
      return prev;
    });
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
        registerMember,
        loginMember,
        loginAdmin,
        updateAdminCredentials,
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
        deleteReceipt,
        createWithdrawalRequest,
        approveWithdrawal,
        rejectWithdrawal,
        publishNews,
        deleteNewsItem,
        markNewsAsRead,
        createActivity,
        approveActivityPayor,
        approveActivityBudgetTresorier,
        createFinancialEvent,
        archiveFinancialEvent,
        deleteFinancialEvent,
        createProject,
        approveProjectPayor,
        assessProjectTresorier,
        publishProject,
        archiveProject,
        createSecretaryPV,
        approvePVPayor,
        publishPVCOM,
        createFinancialBilan,
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
