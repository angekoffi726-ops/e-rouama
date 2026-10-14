import { PaymentDeclaration, WithdrawalRequest, FundType, FinancialBilan } from '../types';

/**
 * Convertit toute chaîne de date (DD/MM/YYYY, YYYY-MM-DD, ISO) ou timestamp en millisecondes.
 */
export function parseDateToTimestamp(dateStr?: string | null, createdAt?: number | null): number {
  if (createdAt && typeof createdAt === 'number' && !isNaN(createdAt) && createdAt > 0) {
    return createdAt;
  }
  if (!dateStr || typeof dateStr !== 'string') return 0;

  const clean = dateStr.trim();

  // Format français : DD/MM/YYYY ou DD-MM-YYYY (avec éventuel horaire)
  const frenchMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const month = parseInt(frenchMatch[2], 10) - 1;
    const year = parseInt(frenchMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0).getTime();
  }

  // Format ISO : YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0).getTime();
  }

  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) return parsed;

  return 0;
}

/**
 * Parse une borne de date (Datepicker YYYY-MM-DD ou DD/MM/YYYY) au début ou fin de journée.
 */
export function parseBoundaryTimestamp(boundaryStr: string, type: 'START' | 'END'): number {
  if (!boundaryStr) return type === 'START' ? 0 : Number.MAX_SAFE_INTEGER;
  const clean = boundaryStr.trim();

  let year = 0;
  let month = 0;
  let day = 0;

  const iso = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (iso) {
    year = parseInt(iso[1], 10);
    month = parseInt(iso[2], 10) - 1;
    day = parseInt(iso[3], 10);
  } else {
    const french = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (french) {
      day = parseInt(french[1], 10);
      month = parseInt(french[2], 10) - 1;
      year = parseInt(french[3], 10);
    }
  }

  if (year > 0) {
    if (type === 'START') {
      return new Date(year, month, day, 0, 0, 0, 0).getTime();
    } else {
      return new Date(year, month, day, 23, 59, 59, 999).getTime();
    }
  }

  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    if (type === 'START') {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    } else {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    }
  }

  return type === 'START' ? 0 : Number.MAX_SAFE_INTEGER;
}

/**
 * Vérifie si la date d'une transaction est incluse dans l'intervalle [startDate, endDate].
 */
export function isDateWithinRange(
  dateStr?: string | null,
  createdAt?: number | null,
  startDateStr?: string | null,
  endDateStr?: string | null
): boolean {
  if (!startDateStr && !endDateStr) return true;

  const itemTs = parseDateToTimestamp(dateStr, createdAt);
  if (itemTs === 0) return true; // Si date introuvable, inclusion par précaution

  const startTs = startDateStr ? parseBoundaryTimestamp(startDateStr, 'START') : 0;
  const endTs = endDateStr ? parseBoundaryTimestamp(endDateStr, 'END') : Number.MAX_SAFE_INTEGER;

  return itemTs >= startTs && itemTs <= endTs;
}

/**
 * Identifie si une déclaration d'encaissement est formellement validée et active.
 */
export function isValidatedDeclaration(d: PaymentDeclaration): boolean {
  if (d.isHidden === true || d.status === 'deleted' || d.status === 'hidden') return false;
  if (d.status === 'REJECTED' || d.status === 'rejected') return false;

  const s = String(d.status || '').toLowerCase().trim();
  const isApproved =
    s === 'approved' ||
    s === 'validated' ||
    s === 'validé' ||
    s === 'valide' ||
    s === 'approuvé' ||
    d.isValidated === true ||
    d.isApproved === true;

  return isApproved;
}

/**
 * Identifie si un décaissement est formellement approuvé.
 */
export function isValidatedWithdrawal(w: WithdrawalRequest): boolean {
  const s = String(w.status || '').toLowerCase().trim();
  return s === 'approved' || s === 'approuvé' || s === 'validé' || s === 'validated';
}

/**
 * Extrait les paramètres de période (Mode, Date Début, Date Fin) d'un bilan quelconque.
 */
export function extractBilanPeriodParams(bilan: Partial<FinancialBilan>): {
  periodMode: 'GLOBAL' | 'PERIODIC';
  startDate?: string;
  endDate?: string;
} {
  if (bilan.periodType === 'PERIODIC' && bilan.startDate && bilan.endDate) {
    return {
      periodMode: 'PERIODIC',
      startDate: bilan.startDate,
      endDate: bilan.endDate,
    };
  }

  if (bilan.periodType === 'GLOBAL') {
    return { periodMode: 'GLOBAL' };
  }

  const p = bilan.period || '';
  // Détection format "Du YYYY-MM-DD au YYYY-MM-DD" ou "Du DD/MM/YYYY au DD/MM/YYYY"
  const match = p.match(/Du\s+([^\s]+)\s+au\s+([^\s]+)/i);
  if (match) {
    return {
      periodMode: 'PERIODIC',
      startDate: match[1],
      endDate: match[2],
    };
  }

  return { periodMode: 'GLOBAL' };
}

export interface ComputeBilanArgs {
  declarations: PaymentDeclaration[];
  withdrawals: WithdrawalRequest[];
  periodMode: 'GLOBAL' | 'PERIODIC';
  startDate?: string;
  endDate?: string;
  maxDate?: string;
}

export interface ComputedBilanResult {
  filteredDeclarations: PaymentDeclaration[];
  filteredWithdrawals: WithdrawalRequest[];
  totalIn: number;
  totalOut: number;
  totalSolde: number;
  balances: Record<FundType, number>;
  periodMode: 'GLOBAL' | 'PERIODIC';
  startDate?: string;
  endDate?: string;
}

/**
 * Recalcule rigoureusement 100% des mouvements financiers (Entrées, Sorties, Solde Total, Sous-Soldes)
 * sans limitation de volume ni filtres parasites.
 */
export function computeBilanData({
  declarations,
  withdrawals,
  periodMode,
  startDate,
  endDate,
  maxDate,
}: ComputeBilanArgs): ComputedBilanResult {
  // 1. Filtrage strict des entrées validées
  const filteredDeclarations = declarations.filter(d => {
    if (!isValidatedDeclaration(d)) return false;

    if (periodMode === 'PERIODIC' && startDate && endDate) {
      return isDateWithinRange(d.date, (d as any).createdAt, startDate, endDate);
    }

    if (periodMode === 'GLOBAL' && maxDate) {
      // De l'origine jusqu'à la date maximale de génération
      return isDateWithinRange(d.date, (d as any).createdAt, null, maxDate);
    }

    return true;
  });

  // Tri chronologique décroissant des entrées
  filteredDeclarations.sort((a, b) => {
    const tsA = parseDateToTimestamp(a.date, (a as any).createdAt);
    const tsB = parseDateToTimestamp(b.date, (b as any).createdAt);
    return tsB - tsA;
  });

  // 2. Filtrage strict des sorties approuvées
  const filteredWithdrawals = withdrawals.filter(w => {
    if (!isValidatedWithdrawal(w)) return false;

    if (periodMode === 'PERIODIC' && startDate && endDate) {
      return isDateWithinRange(w.date, (w as any).createdAt, startDate, endDate);
    }

    if (periodMode === 'GLOBAL' && maxDate) {
      return isDateWithinRange(w.date, (w as any).createdAt, null, maxDate);
    }

    return true;
  });

  // Tri chronologique décroissant des sorties
  filteredWithdrawals.sort((a, b) => {
    const tsA = parseDateToTimestamp(a.date, (a as any).createdAt);
    const tsB = parseDateToTimestamp(b.date, (b as any).createdAt);
    return tsB - tsA;
  });

  // 3. Calcul dynamique des totaux
  const totalIn = filteredDeclarations.reduce(
    (sum, d) => sum + (Number(d.amount) || Number(d.montant) || 0),
    0
  );

  const totalOut = filteredWithdrawals.reduce(
    (sum, w) => sum + (Number(w.amount) || 0),
    0
  );

  const totalSolde = totalIn - totalOut;

  // 4. Calcul dynamique des 5 sous-caisses
  const balances: Record<FundType, number> = {
    COTISATION: 0,
    ANNIVERSAIRE: 0,
    SOIREE_ROUAMA: 0,
    LOISIRS: 0,
    AGR: 0,
    CAS_SOCIAUX: 0,
  };

  filteredDeclarations.forEach(d => {
    const fund = (d.fund || 'COTISATION') as FundType;
    const amount = Number(d.amount) || Number(d.montant) || 0;
    if (balances[fund] !== undefined) {
      balances[fund] += amount;
    }
  });

  filteredWithdrawals.forEach(w => {
    const fund = (w.fund || 'COTISATION') as FundType;
    const amount = Number(w.amount) || 0;
    if (balances[fund] !== undefined) {
      balances[fund] -= amount;
    }
  });

  return {
    filteredDeclarations,
    filteredWithdrawals,
    totalIn,
    totalOut,
    totalSolde,
    balances,
    periodMode,
    startDate,
    endDate,
  };
}
