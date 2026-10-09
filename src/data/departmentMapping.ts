import { AdminRole } from '../types';

/**
 * Cartographie officielle des Départements et Responsables selon le Cahier des Charges E-ROUAMA :
 * 1. Suivi du Programme & Cerveau : Wilfried (Capelo)
 * 2. Trésorerie : Leger (L'Élu de Dieu)
 * 3. Projet : Ulrich (Le Surl) & Gilbert (Doyen) [Gestion Partagée]
 * 4. Secrétariat : Josiane (La Madre)
 * 5. Spiritualité : Marie (Souka) & Cyprien (Nade) [Gestion Partagée]
 * 6. Organisation : Emile (Dojon) & Otinel (Kilo Cartus) [Gestion Partagée]
 * 7. Communication : Désiré (Typo) & Esther (Nounours) [Gestion Partagée]
 * 8. Payor : Sylas [Flux de paiement et opérations du pôle Payor]
 */

export interface DepartmentMappingConfig {
  key: string;
  name: string;
  shortName: string;
  icon: string;
  adminRole: AdminRole;
  managerNames: string[]; // Noms/Surnoms des responsables
  managerMemberIds: string[]; // IDs des membres dans membersData / Firestore
  description: string;
  notificationScope: string;
}

export const OFFICIAL_DEPARTMENTS: DepartmentMappingConfig[] = [
  {
    key: 'suivi_programme',
    name: 'Suivi du Programme & Cerveau',
    shortName: 'Suivi & Cerveau',
    icon: '🕵️',
    adminRole: 'SDP',
    managerNames: ['Wilfried', 'Capelo'],
    managerMemberIds: ['1'],
    description: "Suivi des membres, rapports d'activités, navettes inter-départements et validations prioritaires des retraits (Cerveau)",
    notificationScope: 'Suivi des membres, rapports d’activités, navettes inter-départements et validations prioritaires des demandes de retrait',
  },
  {
    key: 'tresorerie',
    name: 'Trésorerie Générale',
    shortName: 'Trésorerie',
    icon: '💰',
    adminRole: 'TRESORIER',
    managerNames: ['Léger', 'Stanis', "L'Élu de Dieu"],
    managerMemberIds: ['11'],
    description: 'Validations de cotisations, alertes de caisse et bilans financiers',
    notificationScope: 'Validations de cotisations, alertes de caisse et bilans financiers',
  },
  {
    key: 'projet',
    name: 'Commission Projets (AGR)',
    shortName: 'Projets',
    icon: '🚀',
    adminRole: 'PROJET',
    managerNames: ['Ulrich', 'Gilbert', 'Le Surl', 'Doyen'],
    managerMemberIds: ['7', '10'], // Ulrich (7) & Gilbert (10) [Gestion partagée]
    description: 'Soumissions de nouveaux projets, validations budgétaires, suivi d’avancement',
    notificationScope: 'Soumissions de nouveaux projets, validations budgétaires, suivi d’avancement',
  },
  {
    key: 'secretariat',
    name: 'Secrétariat Général',
    shortName: 'Secrétariat',
    icon: '📝',
    adminRole: 'SECRETARIAT',
    managerNames: ['Josiane', 'La Madre'],
    managerMemberIds: ['3'],
    description: 'Nouvelles demandes d’adhésion, archivage de PV, communications officielles',
    notificationScope: 'Nouvelles demandes d’adhésion, archivage de PV, communications officielles',
  },
  {
    key: 'spiritualite',
    name: 'Département Spiritualité',
    shortName: 'Spiritualité',
    icon: '🕊️',
    adminRole: 'SPIRITUALITE',
    managerNames: ['Marie', 'Cyprien', 'Souka', 'Nade'],
    managerMemberIds: ['4', '9'], // Marie (4) & Cyprien (9) [Gestion partagée]
    description: 'Intentions de prière, calendrier des activités spirituelles',
    notificationScope: 'Intentions de prière, calendrier des activités spirituelles',
  },
  {
    key: 'organisation',
    name: 'Commission Organisation',
    shortName: 'Organisation',
    icon: '🎪',
    adminRole: 'ORGANISATION',
    managerNames: ['Emile', 'Otinel', 'Dojon', 'Kilo Cartus'],
    managerMemberIds: ['8', '2'], // Emile (8) & Otinel (2) [Gestion partagée]
    description: 'Inscriptions aux événements, logistique, alertes d’organisation',
    notificationScope: 'Inscriptions aux événements, logistique, alertes d’organisation',
  },
  {
    key: 'communication',
    name: "Base d'Information & Communication (BIC)",
    shortName: 'Communication',
    icon: '📢',
    adminRole: 'COM',
    managerNames: ['Désiré', 'Esther', 'Typo', 'Nounours'],
    managerMemberIds: ['6', '12'], // Désiré (6) & Esther (12) [Gestion partagée]
    description: 'Demandes de diffusion d’annonces, annonces générales, modération des publications',
    notificationScope: 'Demandes de diffusion d’annonces, annonces générales, modération des publications',
  },
  {
    key: 'payor',
    name: 'Espace Payor',
    shortName: 'Payor',
    icon: '⚖️',
    adminRole: 'PAYOR',
    managerNames: ['Sylas'],
    managerMemberIds: ['5'],
    description: 'Flux de paiement et opérations du pôle Payor',
    notificationScope: 'Flux de paiement et opérations du pôle Payor',
  },
];

/**
 * Retourne la liste des rôles administratifs attribués par défaut à un membre selon son identifiant ou prénom
 */
export const getDefaultRolesForMember = (memberId: string | number, firstName?: string, nickname?: string): { roles: string[]; departments: string[]; adminRole?: AdminRole } => {
  const mId = String(memberId).trim();
  const fName = (firstName || '').toUpperCase().trim();
  const nName = (nickname || '').toUpperCase().trim();

  // 1. Wilfried (Capelo) -> Suivi du Programme & Cerveau
  if (mId === '1' || fName.includes('WILFRIED') || nName.includes('CAPELO')) {
    return {
      roles: ['membre', 'suivi_programme', 'cerveau'],
      departments: ['suivi_programme', 'cerveau'],
      adminRole: 'SDP',
    };
  }

  // 2. Otinel (Kilo Cartus) -> Organisation (Gestion partagée)
  if (mId === '2' || fName.includes('OTINEL') || nName.includes('KILO')) {
    return {
      roles: ['membre', 'organisation'],
      departments: ['organisation'],
      adminRole: 'ORGANISATION',
    };
  }

  // 3. Josiane (La Madre) -> Secrétariat
  if (mId === '3' || fName.includes('JOSIANE') || nName.includes('MADRE')) {
    return {
      roles: ['membre', 'secretariat'],
      departments: ['secretariat'],
      adminRole: 'SECRETARIAT',
    };
  }

  // 4. Marie (Souka) -> Spiritualité (Gestion partagée)
  if (mId === '4' || fName.includes('MARIE') || nName.includes('SOUKA')) {
    return {
      roles: ['membre', 'spiritualite'],
      departments: ['spiritualite'],
      adminRole: 'SPIRITUALITE',
    };
  }

  // 5. Sylas -> Payor
  if (mId === '5' || fName.includes('SYLAS')) {
    return {
      roles: ['membre', 'payor'],
      departments: ['payor'],
      adminRole: 'PAYOR',
    };
  }

  // 6. Désiré (Typo) -> Communication (Gestion partagée)
  if (mId === '6' || fName.includes('DESIRE') || fName.includes('DÉSIRÉ') || nName.includes('TYPO')) {
    return {
      roles: ['membre', 'communication'],
      departments: ['communication'],
      adminRole: 'COM',
    };
  }

  // 7. Ulrich (Le Surl) -> Projet (Gestion partagée)
  if (mId === '7' || fName.includes('ULRICH') || nName.includes('SURL')) {
    return {
      roles: ['membre', 'projet'],
      departments: ['projet'],
      adminRole: 'PROJET',
    };
  }

  // 8. Emile (Dojon) -> Organisation (Gestion partagée)
  if (mId === '8' || fName.includes('EMILE') || fName.includes('ÉMILE') || nName.includes('DOJON')) {
    return {
      roles: ['membre', 'organisation'],
      departments: ['organisation'],
      adminRole: 'ORGANISATION',
    };
  }

  // 9. Cyprien (Nade) -> Spiritualité (Gestion partagée)
  if (mId === '9' || fName.includes('CYPRIEN') || nName.includes('NADE')) {
    return {
      roles: ['membre', 'spiritualite'],
      departments: ['spiritualite'],
      adminRole: 'SPIRITUALITE',
    };
  }

  // 10. Gilbert (Doyen) -> Projet (Gestion partagée)
  if (mId === '10' || fName.includes('GILBERT') || nName.includes('DOYEN')) {
    return {
      roles: ['membre', 'projet'],
      departments: ['projet'],
      adminRole: 'PROJET',
    };
  }

  // 11. Léger (L'Élu de Dieu) -> Trésorerie
  if (mId === '11' || fName.includes('LEGER') || fName.includes('LÉGER') || nName.includes('ELU') || nName.includes('ÉLU')) {
    return {
      roles: ['membre', 'tresorerie'],
      departments: ['tresorerie'],
      adminRole: 'TRESORIER',
    };
  }

  // 12. Esther (Nounours) -> Communication (Gestion partagée)
  if (mId === '12' || fName.includes('ESTHER') || nName.includes('NOUNOURS')) {
    return {
      roles: ['membre', 'communication'],
      departments: ['communication'],
      adminRole: 'COM',
    };
  }

  return {
    roles: ['membre'],
    departments: [],
  };
};

/**
 * Normalise un nom ou clé de département vers le format Firestore standard
 * (ex: 'COMMUNICATION' -> 'communication', 'TRESORIER' -> 'tresorerie', 'SDP' -> 'suivi_programme')
 */
export const normalizeDepartmentKey = (rawDept?: string): string => {
  if (!rawDept) return '';
  const clean = rawDept.toLowerCase().trim().replace(/[\s-]/g, '_');
  if (clean.includes('com') || clean.includes('bic')) return 'communication';
  if (clean.includes('projet')) return 'projet';
  if (clean.includes('tresor') || clean.includes('caisse')) return 'tresorerie';
  if (clean.includes('secret')) return 'secretariat';
  if (clean.includes('spirit')) return 'spiritualite';
  if (clean.includes('organi')) return 'organisation';
  if (clean.includes('payor')) return 'payor';
  if (clean.includes('cerveau') || clean.includes('president')) return 'cerveau';
  if (clean.includes('programme') || clean.includes('sdp') || clean.includes('suivi')) return 'suivi_programme';
  return clean;
};
