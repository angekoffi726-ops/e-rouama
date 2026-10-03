import { RouamaMember, AdminUser } from '../types';

export const INITIAL_ROUAMA_MEMBERS: RouamaMember[] = [
  {
    id: '1',
    firstName: 'WILFRIED',
    fullRosterName: 'WILFRIED (CAPELO)',
    nickname: 'CAPELO',
    phone: '2250501948962',
    email: 'angekoffi726@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '2609',
    pinCode: '2609',
    avatar: '/PP-CAPELO.jpeg',
  },
  {
    id: '2',
    firstName: 'OTINEL',
    fullRosterName: 'OTINEL (KILO CARTUS)',
    nickname: 'KILO CARTUS',
    phone: '2250503643626',
    email: 'ortiniel.anane05@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '2016',
    pinCode: '2016',
  },
  {
    id: '3',
    firstName: 'JOSIANE',
    fullRosterName: 'JOSIANE (LA MADRE)',
    nickname: 'LA MADRE',
    phone: '2250757537785',
    email: 'josianekambou46@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '7618',
    pinCode: '7618',
  },
  {
    id: '4',
    firstName: 'MARIE',
    fullRosterName: 'MARIE / ROXANE (SOUKA)',
    nickname: 'SOUKA',
    phone: '2250747195076',
    email: 'marieroxanekouadio263@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '0611',
    pinCode: '0611',
  },
  {
    id: '5',
    firstName: 'SYLAS',
    fullRosterName: 'SYLAS (SYLAS)',
    nickname: 'SYLAS',
    phone: '2250564281013',
    email: 'sylastouali156@gmail.com',
    isRegistered: false,
    statut: 'En attente',
  },
  {
    id: '6',
    firstName: 'DESIRE',
    fullRosterName: 'DESIRE (TYPO)',
    nickname: 'TYPO',
    phone: '2250584346071',
    email: 'desiresc04@outlook.com',
    isRegistered: false,
    statut: 'En attente',
  },
  {
    id: '7',
    firstName: 'ULRICH',
    fullRosterName: 'ULRICH (LE SURL)',
    nickname: 'LE SURL',
    phone: '2250701137891',
    email: 'desonangeulrich@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '0000',
    pinCode: '0000',
  },
  {
    id: '8',
    firstName: 'EMILE',
    fullRosterName: 'EMILE / SEKA (DOJON)',
    nickname: 'DOJON',
    phone: '2250544996236',
    email: 'Sekandepo18@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '4444',
    pinCode: '4444',
  },
  {
    id: '9',
    firstName: 'CYPRIEN',
    fullRosterName: 'CYPRIEN (NADE)',
    nickname: 'NADE',
    phone: '2250172528869',
    email: 'Koffiyaocyprien620@gmail.com',
    isRegistered: false,
    statut: 'En attente',
  },
  {
    id: '10',
    firstName: 'GILBERT',
    fullRosterName: 'GILBERT (DOYEN)',
    nickname: 'DOYEN',
    phone: '2250703567992',
    isRegistered: false,
    statut: 'En attente',
  },
  {
    id: '11',
    firstName: 'LÉGER',
    fullRosterName: "LÉGER / STANIS / VENCESLAS (L'ÉLU DE DIEU)",
    nickname: "L'ÉLU DE DIEU",
    phone: '2250787154627',
    email: 'stanisleger@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '8717',
    pinCode: '8717',
  },
  {
    id: '12',
    firstName: 'ESTHER',
    fullRosterName: 'ESTHER / REINE (NOUNOURS)',
    nickname: 'NOUNOURS',
    phone: '2250704718939',
    email: 'reinetuo709@gmail.com',
    isRegistered: true,
    statut: 'Activé',
    pin: '1999',
    pinCode: '1999',
  },
];

export const ADMIN_USERS: AdminUser[] = [
  {
    id: 'TRESORIER',
    loginId: 'TRESORIER',
    roleName: 'Trésorier Général',
    pin: '210300',
    description: 'Gestion des caisses, validation des dépôts, demandes de décaissement, relances WhatsApp et bilans',
  },
  {
    id: 'CERVEAU',
    loginId: 'CERVEAU',
    roleName: 'Le Cerveau (Président)',
    pin: '1234',
    description: 'Verrouillage des décaissements, validation des retraits et diffusion des alertes financières publiques',
  },
  {
    id: 'PAYOR',
    loginId: 'PAYOR',
    roleName: 'Espace Payor',
    pin: '2103',
    description: 'Validation administrative des PV, Règlements, Programmes et Projets avant transmission à la BIC',
  },
  {
    id: 'SECRETARIAT',
    loginId: 'SECRETARIAT',
    roleName: 'Secrétariat Général',
    pin: '4040',
    description: 'Rédaction des PV, présences, réception des bilans financiers et suivi du système d’accusé de réception (ACK)',
  },
  {
    id: 'COM',
    loginId: 'COM',
    roleName: "Base d'Information et de Communication (BIC)",
    pin: '1010',
    description: "Base d'information et de communication (BIC) pour la diffusion aux membres, validation avec accusé de réception (ACK) et ciblage d’audience",
  },
  {
    id: 'ORGANISATION',
    loginId: 'ORGANISATION',
    roleName: 'Commission Organisation',
    pin: '3030',
    description: 'Création d’événements, attribution des comités ad-hoc, dossier unifié programme & budget prévisionnel',
  },
  {
    id: 'PROJET',
    loginId: 'PROJET',
    roleName: 'Commission Projets (AGR)',
    pin: '2020',
    description: 'Montage des projets d’investissement rentables (AGR) et suivi des études de faisabilité',
  },
  {
    id: 'SPIRITUALITE',
    loginId: 'SPIRIT',
    roleName: 'Spiritualité',
    pin: '5050',
    description: 'Diffusion de la Prière ROUAMA, liturgie AELF, événements religieux et verset du jour',
  },
  {
    id: 'SDP',
    loginId: 'SDP',
    roleName: 'Chargé du Suivi du Programme',
    pin: '2626',
    password: '2626',
    description: 'Auditeur & Contrôleur interne : supervision des tâches, respect des résolutions et du calendrier annuel par tous les départements',
  },
  {
    id: 'SUPER_ADMIN',
    loginId: 'SUPER_ADMIN',
    roleName: 'Super Administrateur',
    pin: '7777',
    password: '7777',
    description: 'Présidence & Supervision Générale : accès souverain à l’ensemble des consoles décisionnelles',
  },
];

/**
 * DÉFINITION UNIQUE ET CLAIRE D'UN MEMBRE "INSCRIT / ACTIVÉ" :
 * Un membre est considéré comme "INSCRIT ET ACTIVÉ" dans TOUTE l'application si ET SEULEMENT SI :
 * - Son document Firestore possède un code PIN valide (non vide) : m.pinCode && String(m.pinCode).trim() !== ""
 * OU
 * - Son champ d'activation est vrai : m.isRegistered === true OU m.statut === "Activé".
 */
export const isMemberActive = (m: any): boolean => {
  if (!m) return false;
  const pin = m.pinCode !== undefined && m.pinCode !== null
    ? String(m.pinCode).trim()
    : (m.pin !== undefined && m.pin !== null ? String(m.pin).trim() : '');
  const hasValidPin = pin !== '' && pin !== 'Non défini';
  return Boolean(hasValidPin || m.isRegistered === true || m.statut === 'Activé');
};

/**
 * Calcul unifié et centralisé des membres inscrits / activés
 */
export const getRegisteredMembersCount = (membersList: any[]): number => {
  if (!Array.isArray(membersList)) return 0;
  const activeMembers = membersList.filter(
    (m) =>
      (m?.pinCode && String(m.pinCode).trim() !== '' && String(m.pinCode).trim() !== 'Non défini') ||
      (m?.pin && String(m.pin).trim() !== '' && String(m.pin).trim() !== 'Non défini') ||
      m?.isRegistered === true ||
      m?.statut === 'Activé'
  );
  return activeMembers.length;
};
