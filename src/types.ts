export type AdminRole = 'TRESORIER' | 'CERVEAU' | 'PAYOR' | 'SECRETARIAT' | 'COM' | 'ORGANISATION' | 'PROJET' | 'SPIRITUALITE';

export type TabType = 'DASHBOARD' | 'FINANCES' | 'NOUVELLES' | 'ACTIVITES' | 'PROJETS' | 'ARCHIVES';

export interface VerseOfTheDay {
  verse: string;
  reference?: string;
  date: string;
  updatedBy?: string;
}

export interface PrayerIntention {
  id: string;
  memberNickname: string;
  intention: string;
  date: string;
  isChain: boolean;
}

export interface ReligiousEvent {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
  theme?: string;
  publishedAt: string;
}

export interface RouamaMember {
  id: string;
  firstName: string;
  fullRosterName: string;
  nickname: string;
  phone: string;
  email?: string;
  pin?: string;
  isRegistered: boolean;
  avatar?: string;
  assignedRole?: AdminRole;
}

export interface AdminUser {
  id: AdminRole;
  roleName: string;
  pin: string;
  loginId: string;
  description: string;
}

export interface CurrentUser {
  type: 'MEMBER' | 'ADMIN';
  member?: RouamaMember;
  adminRole?: AdminRole;
}

export type FundType = 'COTISATION' | 'ANNIVERSAIRE' | 'LOISIRS' | 'AGR' | 'CAS_SOCIAUX';

export const FUND_LABELS: Record<FundType, string> = {
  COTISATION: 'Cotisation Mensuelle',
  ANNIVERSAIRE: 'Anniversaire 21 Mars',
  LOISIRS: 'Sorties & Loisirs',
  AGR: 'Projets AGR',
  CAS_SOCIAUX: 'Cas Sociaux',
};

export type DuesStatus = 'A_JOUR' | 'RETARD' | 'EN_AVANCE';

export interface MemberDuesDetail {
  status: DuesStatus;
  unpaidMonths: number;
  totalPaid: number;
  totalExpected: number;
}

export interface RegisteredUserRecord {
  id: string;
  firstName: string;
  nickname: string;
  pin: string;
  registrationDate: string;
}

export interface PaymentDeclaration {
  id: string;
  memberId: string;
  memberName: string;
  memberNickname: string;
  fund: FundType;
  amount: number;
  reference: string;
  month: string; // YYYY-MM
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  paymentType?: 'TOTAL' | 'TRANCHE';
  subCategory?: string;
}

export interface MemberRubricProgress {
  fund: FundType;
  subCategory?: string;
  title: string;
  totalRequired: number;
  totalAdvanced: number;
  pendingAmount: number;
  remainingDue: number;
  status: 'SOLDE' | 'EN_COURS' | 'NON_ENTAME';
  history: PaymentDeclaration[];
}

export interface Transaction {
  id: string;
  type: 'DEPOT' | 'DECAISSEMENT';
  fund: FundType;
  amount: number;
  description: string;
  memberNickname?: string;
  date: string;
  createdBy: string;
}

export interface WithdrawalRequest {
  id: string;
  requestedBy: string;
  fund: FundType;
  amount: number;
  reason: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export type TargetAudience = 'TOUS' | 'RETARD' | 'A_JOUR' | 'EN_AVANCE';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  authorRole: string;
  targetAudience: TargetAudience;
  date: string;
  category: 'ANNONCE' | 'RELANCE' | 'ALERTE' | 'AUTRE';
  readBy: string[];
  dispatchChannel?: 'APP' | 'MAIL' | 'GENERAL';
  linkTab?: TabType;
  targetDocId?: string;
}

export interface Committee {
  name: string;
  leaderNickname: string;
  memberNicknames: string[];
  description: string;
}

export interface EventActivity {
  id: string;
  title: string;
  eventDate: string;
  description: string;
  committees: Committee[];
  program: string;
  budget: number;
  status: 'DRAFT' | 'PENDING_PAYOR' | 'APPROVED' | 'PUBLISHED';
  createdBy: string;
  budgetStatus?: 'NONE' | 'PENDING_TRESORIER' | 'APPROVED_TRESORIER';
}

export interface FinancialEvent {
  id: string;
  fund: 'LOISIRS' | 'CAS_SOCIAUX';
  subCategory?: string; // e.g. "Sortie détente", "Mariage", "Décès", "Naissance", "Autre"
  title: string;
  description: string;
  requiredAmountPerMember: number; // Montant requis per capita (en FCFA)
  totalTargetAmount?: number;
  eventDate: string; // Date de réalisation / d'événement
  paymentDeadline: string; // Date limite de paiement
  status: 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  createdBy: string;
}

export interface AgrProject {
  id: string;
  title: string;
  category: string;
  estimatedCost: number; // Montant total du projet (en FCFA)
  requiredAmountPerMember: number; // Montant de contribution requis par membre (variable, défini à la création)
  eventDate?: string; // Date de réalisation
  paymentDeadline?: string; // Date limite de paiement
  expectedRoi?: string;
  description: string;
  pilotTeam?: string[];
  status: 'DRAFT' | 'PENDING_PAYOR' | 'APPROVED_PAYOR' | 'PUBLISHED' | 'ARCHIVED';
  tresorierFeasibility?: 'PENDING' | 'APPROVED' | 'REJECTED';
  currentReturn: number;
  date: string;
  createdBy: string;
}

export interface ArchiveDoc {
  id: string;
  title: string;
  type: 'PV' | 'REGLEMENT' | 'BILAN_FINANCIER';
  content: string;
  author: string;
  date: string;
  status: 'PENDING_PAYOR' | 'APPROVED_PAYOR' | 'SENT_TO_COM' | 'PUBLISHED_BY_COM' | 'ARCHIVED';
  ackByCom: boolean;
  sentToComBySecretariat: boolean;
  archivedBySecretariat: boolean;
  metadata?: Record<string, unknown>;
}

export interface SecretaryPV {
  id: string;
  title: string;
  meetingDate: string;
  startTime?: string;
  endTime?: string;
  attendeesCount?: number;
  content: string;
  attendance: { memberId: string; present: boolean }[];
  status: 'DRAFT' | 'SENT_TO_PAYOR' | 'APPROVED_PAYOR' | 'SENT_TO_COM' | 'ARCHIVED';
}

export interface FinancialBilan {
  id: string;
  title: string;
  period: string;
  totalIn: number;
  totalOut: number;
  balances: Record<FundType, number>;
  summary: string;
  date: string;
  status: 'PENDING_PAYOR' | 'APPROVED_PAYOR' | 'ACK_COM_RECU' | 'ARCHIVED';
  treasurerSignatureDate?: string;
  payorSignatureDate?: string;
  sentToSecretariat: boolean;
  sentToCom: boolean;
  ackByCom: boolean;
  archivedBySecretariat: boolean;
  publishedByCom?: boolean;
}
