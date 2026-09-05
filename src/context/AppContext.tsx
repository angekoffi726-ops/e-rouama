import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
 import {
  MemberRubricProgress,
  FUND_LABELS
} from '../types';
import { INITIAL_ROUAMA_MEMBERS, ADMIN_USERS } from '../data/membersData';
import { sendEmailBroadcastAsync } from '../utils/emailService';

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
    subCategory?: string
  ) => { success: boolean; message: string };
  approvePayment: (declarationId: string) => void;
  rejectPayment: (declarationId: string, reason: string) => void;

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
    contentOrMonth: string,
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

const getStoredRegisteredUsers = (): RegisteredUserRecord[] => {
  try {
    const raw = localStorage.getItem(EROUAMA_REGISTERED_USERS_KEY);
    if (!raw) {
      localStorage.setItem(EROUAMA_REGISTERED_USERS_KEY, JSON.stringify([]));
      return [];
    }
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
        u.firstName.toUpperCase() === record.firstName.toUpperCase() ||
        u.nickname.toUpperCase() === record.nickname.toUpperCase()
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

export const ADMIN_CREDENTIALS_KEY = 'erouama_admin_credentials';

export function getStoredAdminCredentials(): AdminUser[] {
  try {
    const stored = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    if (stored) {
      const parsed: AdminUser[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all defined admin roles exist by merging with default ADMIN_USERS
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
  // CLEAN SLATE INITIAL STATES
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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

  // Chargement global (Membres, Déclarations, Transactions) depuis Supabase au démarrage
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Charger les membres
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('*');

        if (membersError) {
          console.error("Erreur membres Supabase :", membersError.message);
        } else if (membersData && membersData.length > 0) {
          setMembers(membersData);
        }

        // 2. Charger les déclarations
        const { data: declData, error: declError } = await supabase
          .from('declarations')
          .select('*');

        if (declError) {
          console.error("Erreur déclarations Supabase :", declError.message);
        } else if (declData) {
          setDeclarations(declData);
        }

        // 3. Charger les transactions
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*');

        if (txError) {
          console.error("Erreur transactions Supabase :", txError.message);
        } else if (txData) {
          setTransactions(txData);
        }

      } catch (err) {
        console.error("Erreur globale de connexion Supabase :", err);
      }
    };

    fetchInitialData();
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      saveStoredAdminCredentials(adminUsers);
      const payload = {
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
        verseOfTheDay,
        prayerIntentions,
        religiousEvents,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }, [members, adminUsers, fundBalances, declarations, transactions, withdrawals, newsItems, activities, projects, financialEvents, archiveDocs, pvs, bilans, verseOfTheDay, prayerIntentions, religiousEvents]);

  const resetAllData = () => {
    const registeredRecords = getStoredRegisteredUsers();
    const restoredMembers = INITIAL_ROUAMA_MEMBERS.map(m => {
      const regRecord = registeredRecords.find(
        r => r.id === m.id ||
          r.firstName.toUpperCase() === m.firstName.toUpperCase() ||
          r.nickname.toUpperCase() === m.nickname.toUpperCase()
      );
      if (regRecord) {
        return { ...m, isRegistered: true, pin: regRecord.pin };
      }
      return m;
    });

    setMembers(restoredMembers);
    setFundBalances({
      COTISATION: 0,
      ANNIVERSAIRE: 0,
      LOISIRS: 0,
      AGR: 0,
      CAS_SOCIAUX: 0,
    });
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
  };

  // Helper function to find a member by search string (First name, nickname, or full name)
  const findRosterMember = (search: string) => {
    const clean = search.trim().toUpperCase();
    return members.find(m =>
      m.firstName.toUpperCase() === clean ||
      m.nickname.toUpperCase() === clean ||
      m.fullRosterName.toUpperCase().includes(clean)
    );
  };

  // Registration logic
  const registerMember = async (inputName: string, pin: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return { success: false, message: 'Le code PIN doit comporter exactement 4 chiffres.' };
    }

    const matched = findRosterMember(inputName);
    if (!matched) {
      return { success: false, message: "Désolé mais vous n'êtes pas membre Rouama." };
    }

    if (matched.isRegistered) {
      return { success: false, message: `Le membre ${matched.nickname} est déjà inscrit. Connectez-vous avec votre PIN.` };
    }

    try {
      const { error } = await supabase
        .from('members')
        .update({ pin: pin, isRegistered: true })
        .eq('id', matched.id);

      if (error) {
        console.error("Erreur d'enregistrement Supabase :", error.message);
        return { success: false, message: "Erreur lors de l'enregistrement." };
      }

      const updatedMembers = members.map(m => {
        if (m.id === matched.id) {
          return { ...m, pin, isRegistered: true };
        }
        return m;
      });

      setMembers(updatedMembers);
      const registeredUser = updatedMembers.find(m => m.id === matched.id)!;
      setCurrentUser({ type: 'MEMBER', member: registeredUser });

      return { success: true, message: `Bienvenue chez vous, ${registeredUser.nickname} !` };
    } catch (err) {
      console.error("Erreur serveur :", err);
      return { success: false, message: "Erreur de connexion au serveur." };
    }
  };

  // Login Member avec Supabase
  const loginMember = async (inputName: string, pin: string) => {
    if (!inputName || !inputName.trim()) {
      return { success: false, message: 'Veuillez saisir votre prénom ou surnom fraternel.' };
    }

    const matched = findRosterMember(inputName);
    if (!matched) {
      return { success: false, message: "Désolé mais vous n'êtes pas membre Rouama. Vérifiez l'orthographe." };
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', matched.id)
        .single();

      if (error || !data) {
        return { success: false, message: "Erreur lors de la vérification du compte." };
      }

      if (!data.isRegistered) {
        return { success: false, message: `Le membre ${data.nickname} n'est pas encore inscrit. Allez sur l'onglet INSCRIPTION.` };
      }

      if (data.pin !== pin) {
        return { success: false, message: 'Code PIN incorrect.' };
      }

      setCurrentUser({ type: 'MEMBER', member: data });
      return { success: true, message: `Content de vous revoir, ${data.nickname} !` };
    } catch (err) {
      console.error("Erreur serveur :", err);
      return { success: false, message: "Erreur de connexion au serveur." };
    }
  };

  // Login Admin
  const loginAdmin = (inputRoleOrLogin: string, pin: string) => {
    if (!inputRoleOrLogin || !inputRoleOrLogin.trim()) {
      return { success: false, message: "Veuillez saisir le rôle ou l'identifiant administrateur." };
    }

    // Always fetch latest dynamic admin credentials from localStorage or state
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

    return { success: true, message: `Identifiants pour le poste ${roleId} mis à jour et enregistrés avec succès !` };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // Dues Status Calculation
  const getMemberDuesDetail = (memberId: string): MemberDuesDetail => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthNum = now.getMonth() + 1; // 1-12

    // RÈGLE DES RETARDS (Cotisations 500 F CFA/mois) :
    // - Du 28 au dernier jour du mois : fenêtre de relance active pour le mois en cours (mois M exigible).
    // - Dès le 05 du mois (et jusqu'au 27) : enregistrement automatique du mois précédent (M-1) comme dû ("RETARD") si non soldé.
    // - Du 01 au 04 du mois : fenêtre de relance active pour le mois précédent (M-1 exigible).
    const totalRequiredMonths = currentDay >= 28 ? currentMonthNum : Math.max(0, currentMonthNum - 1);
    const totalExpectedAmount = totalRequiredMonths * 500;

    // Total approved cotisations for this member
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

  // Helper: Required Amount per Rubric / Fund
  const getRequiredAmountForRubric = (fund: FundType, subCategory?: string): number => {
    switch (fund) {
      case 'ANNIVERSAIRE':
        // Anniversaire (21 Mars) : Toujours actif avec sa date fixe et son montant dédié (10 000 FCFA)
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
        // Les projets AGR n'ont PAS de montant fixe préétabli. Défini spécifiquement à la création
        const activeProj = projects.find(p => p.status === 'PUBLISHED');
        return activeProj ? (activeProj.requiredAmountPerMember || 0) : 0;
      }
      default:
        return 0;
    }
  };

  // Calculate detailed progress per rubric (Total Required, Total Advanced, Remaining, Status, History)
  const getMemberRubricProgress = (
    memberId: string,
    fund: FundType,
    subCategory?: string
  ): MemberRubricProgress => {
    const totalRequired = getRequiredAmountForRubric(fund, subCategory);

    // Filter declarations for this member and rubric
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

  // Summary of all members for a specific rubric
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

  // Declare Payment (supports Full Payment or Installments with minimum 1,000 FCFA rule)
  const declarePayment = (
    fund: FundType,
    amount: number,
    reference: string,
    month?: string,
    paymentType?: 'TOTAL' | 'TRANCHE',
    subCategory?: string
  ) => {
    let activeMember = currentUser?.member;
    if (!activeMember && currentUser?.type === 'ADMIN') {
      activeMember = members.find(m => m.assignedRole === currentUser.adminRole) || members.find(m => m.id === 'm1') || members[0];
    }

    if (!activeMember) {
      return { success: false, message: 'Vous devez être connecté en tant que membre.' };
    }

    let isFull = false;

    // 1. COTISATIONS MENSUELLES STATUTAIRES : Montant fixe 500 FCFA / mois (non soumis aux tranches libres)
    if (fund === 'COTISATION') {
      if (amount < 500 || amount % 500 !== 0) {
        return {
          success: false,
          message: 'La cotisation mensuelle est fixée à 500 F CFA par mois. Le montant doit être de 500 F CFA ou un multiple (ex: 500 F pour 1 mois, 1 000 F pour 2 mois, 1 500 F pour 3 mois, etc.).'
        };
      }
      isFull = true;
    } else {
      // 2. AUTRES RUBRIQUES (ANNIVERSAIRES, SORTIES, CAS SOCIAUX, AGR) : Tranches modulables (minimum 1 000 FCFA)
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

    const declarePayment = async (
    fund: FundType,
    amount: number,
    reference: string,
    isFull: boolean = false,
    subCategory?: string
  ) => {
    if (!currentUser || currentUser.type !== 'MEMBER') {
      return { success: false, message: 'Seuls les membres enregistrés peuvent effectuer des déclarations.' };
    }

    if (!amount || amount <= 0) {
      return { success: false, message: 'Le montant doit être supérieur à 0 F CFA.' };
    }

    if (!reference || !reference.trim()) {
      return { success: false, message: 'La référence de transaction Wave / Orange Money est obligatoire.' };
    }

    const activeMember = currentUser.member;
    const currentMonthStr = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

    const newDecl: PaymentDeclaration = {
      id: 'DECL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      memberId: activeMember.id,
      memberName: activeMember.firstName,
      memberNickname: activeMember.nickname,
      fund,
      amount,
      reference: reference.trim(),
      month: currentMonthStr,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING',
      paymentType: isFull ? 'TOTAL' : 'TRANCHE',
      subCategory,
    };

    try {
      const { error } = await supabase
        .from('declarations')
        .insert([newDecl]);

      if (error) {
        console.error("Erreur lors de l'enregistrement de la déclaration :", error.message);
        return { success: false, message: "Erreur lors de la transmission de la déclaration." };
      }

      setDeclarations(prev => [newDecl, ...prev]);

      const displayCategory = fund === 'COTISATION'
        ? `Cotisation Mensuelle (${Math.round(amount / 500)} mois)`
        : isFull
        ? 'Règlement Totalité'
        : 'Acompte par tranche';

      return {
        success: true,
        message: `Déclaration de versement (${displayCategory} de ${amount.toLocaleString('fr-FR')} F CFA) transmise au Trésorier pour validation.`
      };
    } catch (err) {
      console.error("Erreur réseau Supabase :", err);
      return { success: false, message: "Erreur de connexion au serveur." };
    }
  };

  // Approve Payment (Trésorier)
  const approvePayment = async (declarationId: string) => {
    const decl = declarations.find(d => d.id === declarationId);
    if (!decl || decl.status !== 'PENDING') return;

    try {
      // 1. Mise à jour du statut dans Supabase
      const { error: declError } = await supabase
        .from('declarations')
        .update({ status: 'APPROVED' })
        .eq('id', declarationId);

      if (declError) {
        console.error("Erreur de validation Supabase :", declError.message);
        return;
      }

      // 2. Création de la transaction dans Supabase
      const newTx: Transaction = {
        id: 'TX-' + Date.now(),
        type: 'DEPOT',
        fund: decl.fund,
        amount: decl.amount,
        description: `Dépôt validé (${decl.fund}) par ${decl.memberNickname} - Réf: ${decl.reference}`,
        memberNickname: decl.memberNickname,
        date: new Date().toLocaleDateString('fr-FR'),
        createdBy: 'TRÉSORIER',
      };

      await supabase.from('transactions').insert([newTx]);

      // 3. Mise à jour de l'état local
      setDeclarations(prev => prev.map(d => d.id === declarationId ? { ...d, status: 'APPROVED' } : d));
      setFundBalances(prev => ({
        ...prev,
        [decl.fund]: prev[decl.fund] + decl.amount,
      }));
      setTransactions(prev => [newTx, ...prev]);

      // Alerte Cerveau
      broadcastCerveauAlert(decl.memberNickname, decl.month);
    } catch (err) {
      console.error("Erreur serveur :", err);
    }
  };

  const rejectPayment = async (declarationId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('declarations')
        .update({ status: 'REJECTED', rejectionReason: reason })
        .eq('id', declarationId);

      if (error) {
        console.error("Erreur de rejet Supabase :", error.message);
        return;
      }

      setDeclarations(prev => prev.map(d => d.id === declarationId ? { ...d, status: 'REJECTED', rejectionReason: reason } : d));
    } catch (err) {
      console.error("Erreur serveur :", err);
    }
  };

  // Broadcast Alert from Cerveau
  const broadcastCerveauAlert = (
    titleOrMember: string,
    contentOrMonth: string,
    dispatchChannel: 'APP' | 'MAIL' | 'GENERAL' = 'APP'
  ) => {
    const isFormattedMonth = contentOrMonth.includes('-') && contentOrMonth.length === 7;
    const formattedDate = isFormattedMonth
      ? new Date(contentOrMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : contentOrMonth;

    const alertTitle = titleOrMember.startsWith('🟢') || titleOrMember.startsWith('🚨')
      ? titleOrMember
      : `🚨 ALERTE CERVEAU : ${titleOrMember}`;

    const alertContent = isFormattedMonth
      ? `${titleOrMember} vient de s'acquitter de sa cotisation pour le mois de ${formattedDate}. Bravo pour l'engagement fraternel !`
      : contentOrMonth || `Communication d'urgence du Cerveau.`;

    const alertNews: NewsItem = {
      id: 'NEWS-ALERT-' + Date.now(),
      title: alertTitle,
      content: alertContent,
      authorRole: 'CERVEAU',
      category: 'ALERTE',
      targetAudience: 'TOUS',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      readBy: [],
      dispatchChannel,
    };

    // Always record in central news items state so all dispatch options update global state
    setNewsItems(prev => [alertNews, ...prev]);

    // Execute actual email broadcast when MAIL or GENERAL option is selected
    if (dispatchChannel === 'MAIL' || dispatchChannel === 'GENERAL') {
      sendEmailBroadcastAsync(alertTitle, alertContent, members, 'CERVEAU', dispatchChannel);
    }
  };

  // Withdrawal Requests (Trésorier -> Cerveau)
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
    setWithdrawals(prev => [req, ...prev]);
  };

  const approveWithdrawal = (requestId: string) => {
    const req = withdrawals.find(w => w.id === requestId);
    if (!req) return;

    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'APPROVED' } : w));

    // Decrease fund balance
    setFundBalances(prev => ({
      ...prev,
      [req.fund]: Math.max(0, prev[req.fund] - req.amount),
    }));

    // Add Transaction
    const newTx: Transaction = {
      id: 'TX-OUT-' + Date.now(),
      type: 'DECAISSEMENT',
      fund: req.fund,
      amount: req.amount,
      description: `Décaissement approuvé (${req.fund}) - Motif: ${req.reason}`,
      date: new Date().toLocaleDateString('fr-FR'),
      createdBy: 'CERVEAU (Validation)',
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const rejectWithdrawal = (requestId: string) => {
    setWithdrawals(prev => prev.map(w => w.id === requestId ? { ...w, status: 'REJECTED' } : w));
  };

  // News publication by COM
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
    // Always record in central news items state so all dispatch options update global state
    setNewsItems(prev => [item, ...prev]);

    // Execute actual email broadcast when MAIL or GENERAL option is selected
    if (dispatchChannel === 'MAIL' || dispatchChannel === 'GENERAL') {
      sendEmailBroadcastAsync(title, content, members, authorRole, dispatchChannel);
    }
  };

  const markNewsAsRead = (newsId: string) => {
    if (!currentUser?.member) return;
    const memberId = currentUser.member.id;
    setNewsItems(prev =>
      prev.map(n => {
        if (n.id === newsId && !n.readBy.includes(memberId)) {
          return { ...n, readBy: [...n.readBy, memberId] };
        }
        return n;
      })
    );
  };

  // Activities (Organisation -> Payor -> COM & Trésorier)
  const createActivity = (activity: Omit<EventActivity, 'id' | 'status' | 'budgetStatus'>) => {
    const newAct: EventActivity = {
      ...activity,
      id: 'ACT-' + Date.now(),
      status: 'PENDING_PAYOR',
      budgetStatus: activity.budget > 0 ? 'PENDING_TRESORIER' : 'NONE',
    };
    setActivities(prev => [newAct, ...prev]);
  };

  const approveActivityPayor = (activityId: string) => {
    setActivities(prev =>
      prev.map(a => {
        if (a.id === activityId) {
          return { ...a, status: 'PUBLISHED' };
        }
        return a;
      })
    );

    const act = activities.find(a => a.id === activityId);
    if (act) {
      // Automatic broadcast to COM feed
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
    setActivities(prev =>
      prev.map(a => {
        if (a.id === activityId) {
          return { ...a, budgetStatus: 'APPROVED_TRESORIER' };
        }
        return a;
      })
    );
  };

  // Financial Events (Trésorier : Sorties & Loisirs, Cas Sociaux)
  const createFinancialEvent = (eventData: Omit<FinancialEvent, 'id' | 'createdAt' | 'status'>) => {
    const newEvent: FinancialEvent = {
      ...eventData,
      id: 'EVT-FIN-' + Date.now(),
      status: 'PUBLISHED',
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };
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
    setFinancialEvents(prev =>
      prev.map(e => (e.id === eventId ? { ...e, status: 'ARCHIVED' } : e))
    );
  };

  const deleteFinancialEvent = (eventId: string) => {
    setFinancialEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Projects (Projet -> Payor -> COM / Trésorier)
  const createProject = (project: Omit<AgrProject, 'id' | 'status' | 'tresorierFeasibility' | 'currentReturn'>) => {
    const newProj: AgrProject = {
      ...project,
      id: 'PROJ-' + Date.now(),
      status: 'PENDING_PAYOR',
      tresorierFeasibility: 'PENDING',
      currentReturn: 0,
    };
    setProjects(prev => [newProj, ...prev]);
  };

  const approveProjectPayor = (projectId: string) => {
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, status: 'APPROVED_PAYOR' } : p)
    );
  };

  const assessProjectTresorier = (projectId: string, feasible: boolean) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? { ...p, tresorierFeasibility: feasible ? 'APPROVED' : 'REJECTED' }
          : p
      )
    );
  };

  const publishProject = (projectId: string) => {
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, status: 'PUBLISHED' } : p)
    );
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      publishNews(
        `🚀 PROJET AGR OUVERT AUX COTISATIONS : ${proj.title}`,
        `Le projet ${proj.title} est officiellement ouvert aux cotisations ! Montant total : ${proj.estimatedCost.toLocaleString('fr-FR')} F CFA. Contribution requise par membre : ${(proj.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA. Date de réalisation : ${proj.eventDate || 'À préciser'}. Date limite de paiement : ${proj.paymentDeadline || 'À préciser'}.`,
        'ANNONCE',
        'TOUS',
        'COMMISSION PROJET',
        'APP',
        'FINANCES'
      );
    }
  };

  const archiveProject = (projectId: string) => {
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: 'ARCHIVED' } : p))
    );
  };

  // PVs (Secrétariat -> Payor -> COM)
  const createSecretaryPV = (pv: Omit<SecretaryPV, 'id' | 'status'>) => {
    const newPv: SecretaryPV = {
      ...pv,
      id: 'PV-' + Date.now(),
      status: 'SENT_TO_PAYOR',
    };
    setPvs(prev => [newPv, ...prev]);
  };

  const approvePVPayor = (pvId: string) => {
    setPvs(prev =>
      prev.map(p => p.id === pvId ? { ...p, status: 'APPROVED_PAYOR' } : p)
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

      // Auto add to ArchiveDocs for COM to confirm
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
      setArchiveDocs(prev => [archiveItem, ...prev]);
    }
  };

  const publishPVCOM = (pvId: string) => {
    setPvs(prev => prev.map(p => p.id === pvId ? { ...p, status: 'ARCHIVED' } : p));
  };

  // Financial Bilans (Trésorier -> Payor (Visa SIMAHO & SIDEPO) -> Secrétariat & COM)
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
    setBilans(prev => [newBilan, ...prev]);
    return newBilan;
  };

  const approveBilanPayor = (bilanId: string) => {
    const now = new Date();
    const fullDate = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    setBilans(prev =>
      prev.map(b => {
        if (b.id === bilanId) {
          return {
            ...b,
            status: 'APPROVED_PAYOR',
            payorSignatureDate: fullDate,
            sentToSecretariat: true, // Transmis UNIQUEMENT au Secrétariat
            sentToCom: false,        // Pas encore transmis à la COM
            ackByCom: false,
            archivedBySecretariat: false,
          };
        }
        return b;
      })
    );
  };

  const sendBilanToSecretariat = (bilanId: string) => {
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, sentToSecretariat: true } : b));
  };

  const sendBilanFromSecretariatToCom = (bilanId: string) => {
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, sentToCom: true } : b));
  };

  const ackBilanCOM = (bilanId: string) => {
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, ackByCom: true, status: 'ACK_COM_RECU' } : b));
    setArchiveDocs(prev =>
      prev.map(a => a.id.includes(bilanId) ? { ...a, ackByCom: true, status: 'SENT_TO_COM' } : a)
    );
  };

  const publishBilanNewsCOM = (bilanId: string) => {
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, publishedByCom: true } : b));
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
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, archivedBySecretariat: true, status: 'ARCHIVED' } : b));
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
      setArchiveDocs(prev => [...prev.filter(a => a.id !== arch.id), arch]);
    }
  };

  const updateMemberAvatar = (memberId: string, avatarDataUrl: string) => {
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

  const deleteNewsItem = (newsId: string) => {
    setNewsItems(prev => prev.filter(n => n.id !== newsId));
  };

  const assignMemberRole = (memberId: string, role?: AdminRole) => {
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, assignedRole: role } : m))
    );
  };

  const resetMemberPin = (memberId: string) => {
    setMembers(prev =>
      prev.map(m => (m.id === memberId ? { ...m, pin: undefined, isRegistered: false } : m))
    );
    // Also remove from EROUAMA_REGISTERED_USERS
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
    setReligiousEvents(prev => [newEvt, ...prev]);

    // Also publish as news item for members
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
        approvePayment,
        rejectPayment,
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
