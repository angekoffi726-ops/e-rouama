import { EventActivity } from '../types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Source de vérité unique pour déterminer si une activité est officiellement
 * validée et publiée pour les membres (ACCUEIL & SHOW).
 * Exclut strictement les brouillons, dossiers en cours de circuit, refusés ou archivés.
 */
export function isActivityOfficiallyPublished(act: EventActivity | null | undefined): boolean {
  if (!act) return false;
  if (act.archivedBySecretariat === true) return false;
  const normStatus = String(act.status || '').trim().toUpperCase();
  return normStatus === 'PUBLISHED' || normStatus === 'ACTIVE';
}

export function isAnniversaireActivity(act: EventActivity | null | undefined): boolean {
  if (!act) return false;
  return (
    act.fixedType === 'ANNIVERSAIRE' ||
    act.id === 'ACT-ANNIVERSAIRE-2027' ||
    Boolean(act.title?.toUpperCase().includes('ANNIVERSAIRE'))
  );
}

export function isSoireeRouamaActivity(act: EventActivity | null | undefined): boolean {
  if (!act) return false;
  return (
    act.fixedType === 'SOIREE_ROUAMA' ||
    act.id === 'ACT-SOIREE-2027' ||
    act.id === 'ACT-SOIREE-2026' ||
    Boolean(act.title?.toLowerCase().includes('soirée rouama')) ||
    Boolean(act.title?.toLowerCase().includes('soiree rouama'))
  );
}

export function getActivityTargetDate(act: EventActivity): {
  targetDate: Date | null;
  isMonthYearOnly: boolean;
  isIndeterminate: boolean;
} {
  // Case 0: Specific Anniversaire event
  if (act.fixedType === 'ANNIVERSAIRE') {
    const yearMatch = act.eventDate ? act.eventDate.match(/\b(202\d|203\d)\b/) : null;
    const year =
      act.eventYear && act.eventYear !== 'LATER'
        ? parseInt(act.eventYear, 10)
        : yearMatch
        ? parseInt(yearMatch[1], 10)
        : 2027;
    return {
      targetDate: new Date(year, 2, 21, 0, 0, 0),
      isMonthYearOnly: false,
      isIndeterminate: false,
    };
  }

  // Case 0b: Specific Soirée Rouama event (Harmonisation 2027)
  if (isSoireeRouamaActivity(act)) {
    const yearMatch = act.eventDate ? act.eventDate.match(/\b(202\d|203\d)\b/) : null;
    let year =
      act.eventYear && act.eventYear !== 'LATER'
        ? parseInt(act.eventYear, 10)
        : yearMatch
        ? parseInt(yearMatch[1], 10)
        : 2027;
    if (year <= 2026) {
      year = 2027;
    }
    return {
      targetDate: new Date(year, 7, 1, 0, 0, 0), // 1er Août 2027 (0-indexed month 7)
      isMonthYearOnly: true,
      isIndeterminate: false,
    };
  }

  // Case 1: Structured fractional fields are present
  if (act.eventYear && act.eventYear !== 'LATER' && act.eventMonth && act.eventMonth !== 'LATER') {
    const year = parseInt(act.eventYear, 10);
    const monthIndex = parseInt(act.eventMonth, 10) - 1;
    const isDayPending = !act.eventDay || act.eventDay === 'LATER' || act.isDayPending;
    const day = isDayPending ? 1 : parseInt(act.eventDay!, 10);
    return {
      targetDate: new Date(year, monthIndex, day, 0, 0, 0),
      isMonthYearOnly: isDayPending,
      isIndeterminate: false,
    };
  }

  // Case 2: Attempt parsing standard YYYY-MM-DD
  if (act.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(act.eventDate)) {
    const [y, m, d] = act.eventDate.split('-').map(Number);
    return {
      targetDate: new Date(y, m - 1, d, 0, 0, 0),
      isMonthYearOnly: false,
      isIndeterminate: false,
    };
  }

  // Case 3: Attempt parsing formatted strings like "21 Mars 2027" or "Août 2027"
  if (act.eventDate) {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const mName = MONTH_NAMES[i];
      if (act.eventDate.toLowerCase().includes(mName.toLowerCase())) {
        const yearMatch = act.eventDate.match(/\b(202\d|203\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 2027;
        const dayMatch = act.eventDate.match(/\b(\d{1,2})\s+[A-Za-zÀ-ÿ]/);
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
        const isMonthOnly = !dayMatch;
        return {
          targetDate: new Date(year, i, day, 0, 0, 0),
          isMonthYearOnly: isMonthOnly,
          isIndeterminate: false,
        };
      }
    }
  }

  return { targetDate: null, isMonthYearOnly: false, isIndeterminate: true };
}

function getActivitySortTimestamp(act: EventActivity): { ts: number | null; isFutureOrToday: boolean } {
  const { targetDate } = getActivityTargetDate(act);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (targetDate && !isNaN(targetDate.getTime())) {
    return {
      ts: targetDate.getTime(),
      isFutureOrToday: targetDate.getTime() >= startOfToday.getTime(),
    };
  }

  // Fallback pour trier les événements sans mois/jour précis (ex: "Année 2027")
  const yearMatch = act.eventDate ? act.eventDate.match(/\b(202\d|203\d)\b/) : null;
  const fallbackYear =
    act.eventYear && act.eventYear !== 'LATER'
      ? parseInt(act.eventYear, 10)
      : yearMatch
      ? parseInt(yearMatch[1], 10)
      : null;

  if (fallbackYear && !isNaN(fallbackYear)) {
    const endOfYearTs = new Date(fallbackYear, 11, 31, 23, 59, 59).getTime();
    return {
      ts: endOfYearTs,
      isFutureOrToday: endOfYearTs >= startOfToday.getTime(),
    };
  }

  return { ts: null, isFutureOrToday: false };
}

/**
 * Retourne la liste consolidée et dédoublonnée des activités officiellement publiées,
 * triée de manière cohérente (événements à venir les plus proches d'abord).
 */
export function getPublishedActivities(activities: EventActivity[]): EventActivity[] {
  if (!Array.isArray(activities) || activities.length === 0) return [];

  const published = activities.filter(isActivityOfficiallyPublished);
  const deduped: EventActivity[] = [];
  let seenAnniv = false;
  let seenSoiree = false;

  for (const act of published) {
    if (isAnniversaireActivity(act)) {
      if (seenAnniv) continue;
      seenAnniv = true;
      deduped.push(act);
      continue;
    }
    if (isSoireeRouamaActivity(act)) {
      if (seenSoiree) continue;
      seenSoiree = true;
      deduped.push(act);
      continue;
    }
    if (!deduped.some(existing => existing.id === act.id)) {
      deduped.push(act);
    }
  }

  return deduped.sort((a, b) => {
    const aInfo = getActivitySortTimestamp(a);
    const bInfo = getActivitySortTimestamp(b);

    // 1. Événements à venir en priorité, du plus proche au plus lointain
    if (aInfo.isFutureOrToday !== bInfo.isFutureOrToday) {
      return aInfo.isFutureOrToday ? -1 : 1;
    }
    if (aInfo.isFutureOrToday && bInfo.isFutureOrToday && aInfo.ts !== null && bInfo.ts !== null) {
      if (aInfo.ts !== bInfo.ts) return aInfo.ts - bInfo.ts;
    }

    // 2. Événements avec date connue avant ceux sans date
    if ((aInfo.ts !== null) !== (bInfo.ts !== null)) {
      return aInfo.ts !== null ? -1 : 1;
    }
    if (aInfo.ts !== null && bInfo.ts !== null && aInfo.ts !== bInfo.ts) {
      return bInfo.ts - aInfo.ts;
    }

    // 3. Plus récemment publié / créé en dernier recours
    const aUpdated = a.updatedAtMs || a.createdAtMs || 0;
    const bUpdated = b.updatedAtMs || b.createdAtMs || 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;
    return (b.id || '').localeCompare(a.id || '');
  });
}

/**
 * Retourne le prochain événement officiellement publié pour la carte ACCUEIL.
 * Retourne null s'il n'existe aucun programme publié dans SHOW (jamais de brouillon).
 */
export function getNextPublishedActivity(activities: EventActivity[]): EventActivity | null {
  const published = getPublishedActivities(activities);
  return published.length > 0 ? published[0] : null;
}
