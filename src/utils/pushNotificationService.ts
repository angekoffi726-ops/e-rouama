// Service officiel de gestion des Notifications Push FCM (Web Push style Wave / WhatsApp)
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';
import { normalizeDepartmentKey, OFFICIAL_DEPARTMENTS, getDefaultRolesForMember } from '../data/departmentMapping';

// Helper pour jouer le carillon distinctif style Wave / WhatsApp avec Web Audio API
export const playWaveNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Première note (Mi - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Deuxième note plus haute (La - 880 Hz) - Style carillon Wave
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.debug('Notification sound note:', err);
  }
};

// Cache en mémoire pour le dédoublonnage strict des notifications
const handledNotificationIds = new Set<string>();

export const hasNotificationBeenHandled = (id: string): boolean => {
  if (!id) return false;
  return handledNotificationIds.has(id);
};

export const markNotificationAsHandled = (id: string): void => {
  if (!id) return;
  handledNotificationIds.add(id);
  if (handledNotificationIds.size > 300) {
    const oldest = handledNotificationIds.values().next().value;
    if (oldest) handledNotificationIds.delete(oldest);
  }
};

// Enregistrement du Service Worker
export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('✅ Service Worker E-ROUAMA enregistré avec succès:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('⚠️ Erreur enregistrement Service Worker:', error);
    return null;
  }
};

// Vérifie si les notifications push sont supportées
export const isPushNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

// Récupère l'état de la permission actuelle
export const getPushPermissionState = (): NotificationPermission | 'unsupported' => {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

// Obtention du token FCM et enregistrement dans Firestore
export const requestPushPermissionAndSaveToken = async (
  userId: string,
  userType: 'MEMBER' | 'ADMIN' = 'MEMBER',
  memberId?: string
): Promise<{ success: boolean; token?: string; message: string; permission: NotificationPermission }> => {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message: 'Les notifications Push ne sont pas supportées par ce navigateur.',
      permission: 'denied',
    };
  }

  try {
    // 1. Demande la permission du navigateur
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Permission de notification refusée. Veuillez l’activer dans les paramètres du navigateur.',
        permission,
      };
    }

    // 2. Enregistrement / récupération explicite du Service Worker (garantit la réception en arrière-plan)
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;

    // 3. Récupération du Token FCM officiel via SDK Firebase Messaging
    let fcmToken = '';
    try {
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
      const supported = await isSupported().catch(() => false);

      if (supported && registration) {
        const messaging = getMessaging(app);
        const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;
        const getTokenOptions: { serviceWorkerRegistration: ServiceWorkerRegistration; vapidKey?: string } = {
          serviceWorkerRegistration: registration,
        };
        if (vapidKey && typeof vapidKey === 'string' && vapidKey.trim()) {
          getTokenOptions.vapidKey = vapidKey.trim();
        }

        const token = await getToken(messaging, getTokenOptions).catch((err) => {
          console.warn('FCM getToken note (fallback client token):', err);
          return null;
        });

        if (token) {
          fcmToken = token;
        }
      }
    } catch (fcmErr) {
      console.warn('FCM module note:', fcmErr);
    }

    // Si pas de token FCM réseau direct, générer un identifiant de subscription WebPush persistant
    if (!fcmToken) {
      const stored = localStorage.getItem('erouama_fcm_token');
      if (stored) {
        fcmToken = stored;
      } else {
        fcmToken = `fcm_web_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      }
    }

    // 4. Enregistre le token dans Firestore dans users/{userId}/fcmToken ET users/{userId}/fcmTokens
    const nowIso = new Date().toISOString();
    const targetUserId = userId || (memberId || 'anonymous');
    const memberRolesMeta = getDefaultRolesForMember(targetUserId);

    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        fcmToken: fcmToken,
        fcmTokens: arrayUnion(fcmToken),
        roles: memberRolesMeta.roles,
        departments: memberRolesMeta.departments,
        pushNotificationsEnabled: true,
        pushTokenUpdatedAt: nowIso,
        devicePlatform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      });
    } catch {
      await setDoc(
        doc(db, 'users', targetUserId),
        {
          id: targetUserId,
          fcmToken: fcmToken,
          fcmTokens: [fcmToken],
          roles: memberRolesMeta.roles,
          departments: memberRolesMeta.departments,
          pushNotificationsEnabled: true,
          pushTokenUpdatedAt: nowIso,
          devicePlatform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        },
        { merge: true }
      );
    }

    // Enregistrement miroir dans members/{memberId} si membre
    const targetMemberId = memberId || (userType === 'MEMBER' ? targetUserId : null);
    if (targetMemberId) {
      try {
        await updateDoc(doc(db, 'members', targetMemberId), {
          fcmToken: fcmToken,
          fcmTokens: arrayUnion(fcmToken),
          pushNotificationsEnabled: true,
          pushTokenUpdatedAt: nowIso,
        });
      } catch {
        await setDoc(
          doc(db, 'members', targetMemberId),
          {
            id: targetMemberId,
            fcmToken: fcmToken,
            fcmTokens: [fcmToken],
            pushNotificationsEnabled: true,
            pushTokenUpdatedAt: nowIso,
          },
          { merge: true }
        );
      }
    }

    // Sauvegarde locale
    localStorage.setItem('erouama_fcm_token', fcmToken);
    localStorage.setItem('erouama_push_enabled', 'true');
    if (targetUserId) {
      localStorage.setItem('erouama_last_auth_user_id', targetUserId);
    }
    if (memberRolesMeta.adminRole) {
      localStorage.setItem('erouama_last_auth_role', memberRolesMeta.adminRole);
    }
    if (memberRolesMeta.departments && memberRolesMeta.departments.length > 0) {
      localStorage.setItem('erouama_last_auth_depts', JSON.stringify(memberRolesMeta.departments));
    }

    return {
      success: true,
      token: fcmToken,
      message: 'Notifications Push activées avec succès !',
      permission: 'granted',
    };
  } catch (error: any) {
    console.error('Erreur activation push FCM:', error);
    return {
      success: false,
      message: error?.message || 'Erreur lors de l’activation des notifications.',
      permission: Notification.permission || 'denied',
    };
  }
};

/**
 * Reconstitution et rafraîchissement automatique du token FCM au démarrage de l'appli.
 * Exécuté dès le chargement (y compris sur la page de connexion / Login ou hors session).
 * Vérifie l'état de la permission, rafraîchit le token via le SDK Firebase et s'assure
 * qu'il est synchronisé dans LocalStorage et Firestore pour l'appareil.
 */
export const refreshFcmTokenOnStartup = async (targetUserId?: string): Promise<string | null> => {
  if (typeof window === 'undefined' || !isPushNotificationSupported()) return null;

  try {
    // 1. Enregistre ou récupère le Service Worker
    const registration = await registerPushServiceWorker();
    if (!registration) return null;

    // 2. Détermine l'ID utilisateur cible (session active ou dernier utilisateur authentifié sur ce terminal)
    const effectiveUserId =
      targetUserId ||
      localStorage.getItem('erouama_last_auth_user_id') ||
      localStorage.getItem('erouama_current_user_id') ||
      '';

    let fcmToken = '';

    // Si permission accordée, obtenir ou rafraîchir le jeton FCM
    if (Notification.permission === 'granted') {
      try {
        const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
        const supported = await isSupported().catch(() => false);
        if (supported && registration) {
          const messaging = getMessaging(app);
          const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;
          const getTokenOptions: { serviceWorkerRegistration: ServiceWorkerRegistration; vapidKey?: string } = {
            serviceWorkerRegistration: registration,
          };
          if (vapidKey && typeof vapidKey === 'string' && vapidKey.trim()) {
            getTokenOptions.vapidKey = vapidKey.trim();
          }
          const token = await getToken(messaging, getTokenOptions).catch((err) => {
            console.debug('FCM startup getToken note:', err);
            return null;
          });
          if (token) {
            fcmToken = token;
          }
        }
      } catch (fcmErr) {
        console.debug('FCM startup import note:', fcmErr);
      }
    }

    // Si pas de jeton réseau direct, utiliser le jeton persisté localement
    if (!fcmToken) {
      fcmToken = localStorage.getItem('erouama_fcm_token') || '';
    }

    if (fcmToken) {
      localStorage.setItem('erouama_fcm_token', fcmToken);
      localStorage.setItem('erouama_push_enabled', 'true');

      // Mettre à jour dans Firestore pour que les notifications continuent à atteindre l'appareil même après déconnexion
      if (effectiveUserId) {
        const nowIso = new Date().toISOString();
        const memberRolesMeta = getDefaultRolesForMember(effectiveUserId);

        try {
          await updateDoc(doc(db, 'users', effectiveUserId), {
            fcmToken: fcmToken,
            fcmTokens: arrayUnion(fcmToken),
            roles: memberRolesMeta.roles,
            departments: memberRolesMeta.departments,
            pushNotificationsEnabled: true,
            pushTokenUpdatedAt: nowIso,
            devicePlatform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          });
        } catch {
          await setDoc(
            doc(db, 'users', effectiveUserId),
            {
              id: effectiveUserId,
              fcmToken: fcmToken,
              fcmTokens: [fcmToken],
              roles: memberRolesMeta.roles,
              departments: memberRolesMeta.departments,
              pushNotificationsEnabled: true,
              pushTokenUpdatedAt: nowIso,
              devicePlatform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            },
            { merge: true }
          );
        }

        try {
          await setDoc(
            doc(db, 'members', effectiveUserId),
            {
              id: effectiveUserId,
              fcmToken: fcmToken,
              fcmTokens: arrayUnion(fcmToken),
              pushNotificationsEnabled: true,
              pushTokenUpdatedAt: nowIso,
            },
            { merge: true }
          );
        } catch {
          // Ignorer si non-membre
        }
      }
      return fcmToken;
    }
  } catch (err) {
    console.debug('Erreur rafraîchissement token au démarrage:', err);
  }
  return null;
};

// Déclenchement direct d'une notification sur le système natif de l'appareil (Bannière / Volet Android)
export const triggerDirectNotification = async (options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  data?: any;
}) => {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const icon = options.icon || '/icon-192.png';
  const tag = options.tag || options.data?.messageId || options.data?.id || 'erouama-single-tag';

  // Tenter via le Service Worker registration en premier pour un affichage système natif dans le volet Android
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(options.title, {
          body: options.body,
          icon: icon,
          badge: '/icon-192.png',
          tag: tag,
          renotify: true,
          vibrate: [200, 100, 200],
          requireInteraction: true,
          silent: false,
          data: {
            url: options.url || '/',
            click_action: options.url || '/',
            priority: 'high',
            sound: 'default',
            requireInteraction: true,
            ...options.data,
          },
        } as NotificationOptions);
        playWaveNotificationSound();
        return;
      }
    }
  } catch (swErr) {
    console.debug('SW showNotification note, falling back to Notification constructor:', swErr);
  }

  // Fallback via le constructeur Notification
  try {
    const notif = new Notification(options.title, {
      body: options.body,
      icon: icon,
      badge: '/icon-192.png',
      tag: tag,
      renotify: true,
      requireInteraction: true,
      data: {
        url: options.url || '/',
        click_action: options.url || '/',
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
      },
    } as NotificationOptions);
    playWaveNotificationSound();
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (e) {
    console.warn('Direct notification error:', e);
  }
};

/**
 * Marque explicitement une notification push comme supprimée (deleted: true)
 * dans Firestore afin d'empêcher toute réémission ultérieure par les fonctions d'arrière-plan.
 */
export const markPushNotificationAsDeleted = async (messageOrNewsId: string): Promise<void> => {
  if (!messageOrNewsId) return;
  try {
    const notifsRef = collection(db, 'push_notifications');
    const q1 = query(notifsRef, where('messageId', '==', messageOrNewsId));
    const q2 = query(notifsRef, where('id', '==', messageOrNewsId));
    const [snap1, snap2] = await Promise.all([
      getDocs(q1).catch(() => ({ docs: [] } as any)),
      getDocs(q2).catch(() => ({ docs: [] } as any)),
    ]);

    const docsToUpdate = new Map();
    snap1.docs?.forEach((d: any) => docsToUpdate.set(d.id, d.ref));
    snap2.docs?.forEach((d: any) => docsToUpdate.set(d.id, d.ref));

    const promises: Promise<any>[] = [];
    docsToUpdate.forEach((ref) => {
      promises.push(updateDoc(ref, { deleted: true, status: 'deleted' }).catch(() => {}));
    });
    await Promise.allSettled(promises);
    console.log(`[pushNotificationService] Notification(s) ${messageOrNewsId} marquée(s) comme supprimée(s) (deleted: true)`);
  } catch (err) {
    console.warn('Erreur marquage notification supprimée:', err);
  }
};

// Émission d'une Notification Push (enregistrée dans Firestore et diffusée aux destinataires)
export interface PushDispatchOptions {
  title: string;
  body: string;
  senderRole?: string;
  senderName?: string;
  targetRole?: string; // ex: "TRESORIER", "CERVEAU", "ALL", etc.
  targetUserId?: string;
  targetUserIds?: string[];
  targetDepartment?: string; // ex: "cerveau", "tresorerie", "communication", "projet", "organisation", "spiritualite", etc.
  targetDepartments?: string[]; // Ciblage simultané de plusieurs départements (ex: ["secretariat", "organisation"])
  targetDuesStatus?: string; // Ciblage optionnel par statut de cotisation ("RETARD" | "A_JOUR" | "EN_AVANCE")
  fcmToken?: string; // Jeton FCM direct du destinataire ciblé
  fcmTokens?: string[]; // Liste de jetons FCM directs
  type: 'INFO_REQUEST' | 'PV_PUBLISHED' | 'BILAN_PUBLISHED' | 'PAYMENT' | 'GENERAL' | 'APPROVAL' | 'DOCUMENT_TRANSMITTED' | (string & {});
  url?: string;
  metadata?: Record<string, any>;
  rawTitle?: boolean; // When true, does not prefix title with E-ROUAMA : [sender]
  priority?: 'high' | 'normal';
  sound?: string;
  requireInteraction?: boolean;
}

// Cache mémoire court (5 min) des documents users/members pour éviter de multiplier les lectures Firestore à chaque notification
let cachedTokenDocs: { fetchedAt: number; entries: Array<{ docId: string; data: any }> } | null = null;
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Extrait tous les jetons FCM actifs des destinataires concernés dans Firestore
 * (Prend en compte les rôles, départements, gestion partagée et diffusion globale)
 */
export const extractRecipientFcmTokens = async (options: {
  targetRole?: string;
  targetDepartment?: string;
  targetDepartments?: string[];
  targetUserId?: string;
  targetUserIds?: string[];
  excludedUserId?: string;
  excludedUserIds?: string[];
}): Promise<string[]> => {
  const tokens: string[] = [];
  const targetRoleClean = (options.targetRole || '').toUpperCase().trim();
  const normalizedDepts = Array.from(
    new Set(
      [
        options.targetDepartment ? normalizeDepartmentKey(options.targetDepartment) : '',
        ...(Array.isArray(options.targetDepartments)
          ? options.targetDepartments.map(d => normalizeDepartmentKey(d))
          : []),
        options.targetRole ? normalizeDepartmentKey(options.targetRole) : '',
      ].filter(Boolean)
    )
  );

  const isBroadcastAll =
    targetRoleClean === 'ALL' ||
    targetRoleClean === 'TOUS' ||
    normalizedDepts.includes('all');

  const excludedIds = new Set<string>();
  if (options.excludedUserId) excludedIds.add(String(options.excludedUserId).trim());
  if (Array.isArray(options.excludedUserIds)) {
    options.excludedUserIds.forEach(id => id && excludedIds.add(String(id).trim()));
  }

  try {
    const directUserIds = new Set<string>();
    if (options.targetUserId) {
      directUserIds.add(String(options.targetUserId).trim());
    }
    if (Array.isArray(options.targetUserIds)) {
      options.targetUserIds.forEach(id => id && directUserIds.add(String(id).trim()));
    }

    const targetDeptManagers = new Set<string>();
    normalizedDepts.forEach((normDept) => {
      if (!normDept || normDept === 'all') return;
      const deptConfig = OFFICIAL_DEPARTMENTS.find(
        d =>
          d.key === normDept ||
          normalizeDepartmentKey(d.key) === normDept ||
          normalizeDepartmentKey(d.adminRole) === normDept
      );
      if (deptConfig) {
        deptConfig.managerMemberIds.forEach(id => targetDeptManagers.add(String(id).trim()));
      }
      if (normDept === 'cerveau') {
        targetDeptManagers.add('1');
        targetDeptManagers.add('CERVEAU');
      }
      if (normDept === 'tresorerie') {
        targetDeptManagers.add('11');
        targetDeptManagers.add('TRESORIER');
      }
    });

    const collectTokensFromDoc = (docId: string, u: any) => {
      const uId = String(u?.id || '').trim();

      if (excludedIds.has(docId) || (uId && excludedIds.has(uId))) {
        if (isBroadcastAll) {
          // Ne pas exclure les autres comptes sur broadcast général; exclure uniquement l'émetteur exact si spécifié
          return;
        }
        return;
      }

      if (isBroadcastAll) {
        if (Array.isArray(u?.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u?.fcmToken && typeof u.fcmToken === 'string' && u.fcmToken.trim()) tokens.push(u.fcmToken.trim());
        return;
      }

      const uDepts = Array.isArray(u?.departments) ? u.departments.map((x: any) => normalizeDepartmentKey(x)) : [];
      const uRoles = Array.isArray(u?.roles) ? u.roles.map((x: any) => normalizeDepartmentKey(x)) : [];
      const uRole = normalizeDepartmentKey(u?.role || u?.adminRole || '');

      const isDirectTarget =
        directUserIds.has(docId) ||
        (uId && directUserIds.has(uId)) ||
        directUserIds.has(docId.toUpperCase()) ||
        (uId && directUserIds.has(uId.toUpperCase()));

      const isManagerTarget =
        targetDeptManagers.has(docId) ||
        (uId && targetDeptManagers.has(uId)) ||
        targetDeptManagers.has(docId.toUpperCase()) ||
        (uId && targetDeptManagers.has(uId.toUpperCase()));

      const isDeptMatch = normalizedDepts.some(
        normDept =>
          normDept &&
          normDept !== 'all' &&
          (uDepts.includes(normDept) || uRoles.includes(normDept) || uRole === normDept)
      );

      if (isDirectTarget || isManagerTarget || isDeptMatch) {
        if (Array.isArray(u?.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u?.fcmToken && typeof u.fcmToken === 'string' && u.fcmToken.trim()) tokens.push(u.fcmToken.trim());
      }
    };

    const now = Date.now();
    if (!cachedTokenDocs || now - cachedTokenDocs.fetchedAt > TOKEN_CACHE_TTL_MS) {
      const usersRef = collection(db, 'users');
      const membersRef = collection(db, 'members');
      const [allUsersSnap, allMembersSnap] = await Promise.all([
        getDocs(usersRef).catch(() => null),
        getDocs(membersRef).catch(() => null),
      ]);
      const entries: Array<{ docId: string; data: any }> = [];
      if (allUsersSnap) {
        allUsersSnap.forEach(d => entries.push({ docId: d.id, data: d.data() }));
      }
      if (allMembersSnap) {
        allMembersSnap.forEach(d => entries.push({ docId: d.id, data: d.data() }));
      }
      cachedTokenDocs = { fetchedAt: now, entries };
    }

    cachedTokenDocs.entries.forEach(entry => collectTokensFromDoc(entry.docId, entry.data));
  } catch (err) {
    console.warn('Erreur extraction fcmTokens Firestore:', err);
  }

  return Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 10)));
};

export const dispatchPushNotification = async (options: PushDispatchOptions) => {
  try {
    const senderLabel = options.senderRole || options.senderName || 'Secrétariat Général';
    const formattedTitle = options.rawTitle
      ? options.title
      : options.title.startsWith('E-ROUAMA')
      ? options.title
      : `E-ROUAMA : ${senderLabel}`;

    const normalizedDepts = Array.from(
      new Set(
        [
          options.targetDepartment ? normalizeDepartmentKey(options.targetDepartment) : '',
          ...(Array.isArray(options.targetDepartments)
            ? options.targetDepartments.map(d => normalizeDepartmentKey(d))
            : []),
          options.targetRole ? normalizeDepartmentKey(options.targetRole) : '',
        ].filter(Boolean)
      )
    );
    const primaryDept = normalizedDepts[0] || null;

    const targetRoleUpper = (options.targetRole || '').toUpperCase().trim();
    const isDuesTargeted = ['RETARD', 'A_JOUR', 'EN_AVANCE'].includes(targetRoleUpper) || Boolean(options.targetDuesStatus);
    const resolvedDuesStatus = options.targetDuesStatus || (['RETARD', 'A_JOUR', 'EN_AVANCE'].includes(targetRoleUpper) ? targetRoleUpper : null);

    const hasDirectUsers = Boolean(options.targetUserId || (options.targetUserIds && options.targetUserIds.length > 0));
    const isBroadcastAll =
      !hasDirectUsers &&
      !isDuesTargeted &&
      (targetRoleUpper === 'ALL' || targetRoleUpper === 'TOUS' || primaryDept === 'all');

    const excludedUserId = options.metadata?.excludedUserId
      ? String(options.metadata.excludedUserId).trim()
      : undefined;

    let targetTokens: string[] = [];
    if (!hasDirectUsers || options.fcmToken || options.fcmTokens) {
      targetTokens = await extractRecipientFcmTokens({
        targetRole: isBroadcastAll ? 'ALL' : options.targetRole,
        targetDepartment: primaryDept || undefined,
        targetDepartments: normalizedDepts,
        targetUserId: options.targetUserId,
        targetUserIds: options.targetUserIds,
        excludedUserId,
      });
    }

    if (options.fcmToken && typeof options.fcmToken === 'string' && options.fcmToken.trim().length > 10) {
      targetTokens.push(options.fcmToken.trim());
    }
    if (Array.isArray(options.fcmTokens)) {
      options.fcmTokens.forEach((t) => {
        if (typeof t === 'string' && t.trim().length > 10) targetTokens.push(t.trim());
      });
    }
    targetTokens = Array.from(new Set(targetTokens));

    const messageId =
      options.metadata?.messageId ||
      options.metadata?.id ||
      options.metadata?.newsId ||
      `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const notificationTag = options.metadata?.tag || `erouama-msg-${messageId}`;

    // Marquer l'ID comme déjà émis par ce client pour éviter les auto-échos locaux redondants
    markNotificationAsHandled(messageId);
    markNotificationAsHandled(notificationTag);

    const resolvedTargetRole = hasDirectUsers
      ? (options.targetRole || 'DIRECT_USER')
      : isDuesTargeted
      ? (resolvedDuesStatus || options.targetRole || 'ALL')
      : (options.targetRole || (primaryDept ? primaryDept.toUpperCase() : 'ALL'));

    const payload = {
      id: messageId,
      messageId: messageId,
      title: formattedTitle,
      body: options.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      priority: options.priority || 'high',
      sound: options.sound || 'default',
      requireInteraction: options.requireInteraction !== false,
      vibrate: [200, 100, 200],
      tag: notificationTag,
      deleted: false,
      status: 'active',
      senderRole: options.senderRole || '',
      senderName: options.senderName || '',
      targetRole: resolvedTargetRole,
      targetDepartment: primaryDept || (hasDirectUsers ? '' : resolvedTargetRole),
      targetDepartments: normalizedDepts,
      targetDuesStatus: resolvedDuesStatus,
      targetUserId: options.targetUserId || null,
      targetUserIds: options.targetUserIds || (options.targetUserId ? [options.targetUserId] : []),
      targetTokens,
      fcmTokens: targetTokens,
      type: options.type,
      url: options.url || '/',
      notification: {
        title: formattedTitle,
        body: options.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        sound: 'default',
      },
      data: {
        click_action: options.url || '/',
        title: formattedTitle,
        body: options.body,
        url: options.url || '/',
        messageId: messageId,
        id: messageId,
        tag: notificationTag,
      },
      metadata: {
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        messageId: messageId,
        ...(options.metadata || {}),
      },
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    await addDoc(collection(db, 'push_notifications'), payload);

    console.log(
      '📢 Notification temps réel émise vers Firestore:',
      payload.title,
      normalizedDepts.length > 0 ? `[Département(s): ${normalizedDepts.join(', ')}]` : `[Cible: ${resolvedTargetRole}]`
    );
  } catch (err) {
    console.warn('Erreur émission notification push:', err);
  }
};

/**
 * Écouteur FCM de premier plan (Foreground SDK)
 * Reçoit les pushs FCM quand l'application est ouverte et active,
 * et déclenche uniquement le son et le toast in-app sans créer de bannière système duplicate.
 */
export const setupForegroundFCMListener = (onReceived?: (payload: any) => void) => {
  if (typeof window === 'undefined') return () => {};
  let unsubscribeFcm: (() => void) | null = null;

  import('firebase/messaging')
    .then(({ getMessaging, onMessage, isSupported }) => {
      isSupported().then((supported) => {
        if (!supported) return;
        const messaging = getMessaging(app);
        unsubscribeFcm = onMessage(messaging, (payload) => {
          console.log('[FCM] Message reçu au premier plan (foreground):', payload);
          const msgId = payload.data?.messageId || payload.data?.id || `fcm-${Date.now()}`;
          const tag = payload.data?.tag || `erouama-msg-${msgId}`;

          if (hasNotificationBeenHandled(msgId) || hasNotificationBeenHandled(tag)) {
            return;
          }
          markNotificationAsHandled(msgId);
          markNotificationAsHandled(tag);

          triggerDirectNotification({
            title: payload.notification?.title || payload.data?.title || 'E-ROUAMA',
            body: payload.notification?.body || payload.data?.body || '',
            icon: payload.notification?.icon || '/icon-192.png',
            tag,
            url: payload.data?.click_action || payload.data?.url || '/',
            data: payload.data,
          });

          if (onReceived) {
            onReceived({
              title: payload.notification?.title || payload.data?.title || 'E-ROUAMA',
              body: payload.notification?.body || payload.data?.body || '',
              icon: payload.notification?.icon || '/icon-192.png',
              tag,
              url: payload.data?.click_action || payload.data?.url || '/',
              data: payload.data,
              isForeground: true,
            });
          }
        });
      }).catch(() => {});
    })
    .catch(() => {});

  return () => {
    if (unsubscribeFcm) {
      unsubscribeFcm();
    }
  };
};

export interface RealtimeNotificationItem {
  id: string;
  title: string;
  body: string;
  icon: string;
  url: string;
  type: string;
  senderName?: string;
  senderRole?: string;
  targetDepartment?: string;
  targetRole?: string;
  createdAt: string;
  timestamp: number;
  data?: any;
}

const getReadIdsStorageKey = (userId: string) => `erouama_notif_read_ids_${userId || 'guest'}`;
const getLastSeenStorageKey = (userId: string) => `erouama_notif_last_seen_${userId || 'guest'}`;

export const getReadNotificationIds = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(getReadIdsStorageKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch {}
  return new Set();
};

export const markNotificationIdAsRead = (userId: string, notifId: string): Set<string> => {
  const existing = getReadNotificationIds(userId);
  if (notifId) existing.add(String(notifId));
  const arr = Array.from(existing).slice(-120);
  try {
    localStorage.setItem(getReadIdsStorageKey(userId), JSON.stringify(arr));
  } catch {}
  return new Set(arr);
};

export const markAllNotificationIdsAsRead = (userId: string, notifIds: string[]): Set<string> => {
  const existing = getReadNotificationIds(userId);
  notifIds.forEach(id => id && existing.add(String(id)));
  const arr = Array.from(existing).slice(-150);
  try {
    localStorage.setItem(getReadIdsStorageKey(userId), JSON.stringify(arr));
  } catch {}
  return new Set(arr);
};

export const matchesNotificationRecipient = (
  docData: any,
  context: {
    userId: string;
    userRole: string;
    userDeptsNormalized: string[];
    userDuesStatus?: string;
  }
): boolean => {
  if (!docData || docData.deleted === true || docData.status === 'deleted') {
    return false;
  }

  const cleanUserId = String(context.userId || '').trim();
  const cleanRoleUpper = String(context.userRole || '').toUpperCase().trim();
  const cleanRoleNorm = normalizeDepartmentKey(cleanRoleUpper);

  // Exclusion de l'expéditeur si explicitement exclu
  if (docData.metadata?.excludedUserId && cleanUserId && String(docData.metadata.excludedUserId).trim() === cleanUserId) {
    return false;
  }

  const targetUserIds: string[] = [];
  if (docData.targetUserId) targetUserIds.push(String(docData.targetUserId).trim());
  if (Array.isArray(docData.targetUserIds)) {
    docData.targetUserIds.forEach((id: any) => id && targetUserIds.push(String(id).trim()));
  }

  const hasDirectTargets = targetUserIds.length > 0;
  const isDirectTarget = Boolean(cleanUserId && targetUserIds.includes(cleanUserId));

  if (hasDirectTargets) {
    if (isDirectTarget) return true;
    // Si la notification cible uniquement des utilisateurs précis et pas celui-ci, ne pas diffuser aux autres sauf si c'est aussi un département explicite
    if (!docData.targetDepartment && (!Array.isArray(docData.targetDepartments) || docData.targetDepartments.length === 0)) {
      return false;
    }
  }

  // Ciblage par statut de cotisation (ex: 'RETARD', 'A_JOUR', 'EN_AVANCE')
  const targetDues = String(docData.targetDuesStatus || '').toUpperCase().trim();
  const targetRoleClean = String(docData.targetRole || '').toUpperCase().trim();
  if (targetDues || ['RETARD', 'A_JOUR', 'EN_AVANCE'].includes(targetRoleClean)) {
    const expectedDues = targetDues || targetRoleClean;
    return Boolean(context.userDuesStatus && context.userDuesStatus.toUpperCase() === expectedDues);
  }

  // Diffusion générale à tous les membres
  const targetDeptsRaw: string[] = [
    docData.targetDepartment,
    ...(Array.isArray(docData.targetDepartments) ? docData.targetDepartments : []),
    docData.targetRole,
  ].filter(Boolean);

  const targetDeptsNorm = targetDeptsRaw.map(d => normalizeDepartmentKey(String(d))).filter(Boolean);

  const isBroadcastAll =
    targetRoleClean === 'ALL' ||
    targetRoleClean === 'TOUS' ||
    targetDeptsNorm.includes('all') ||
    (!docData.targetRole && !docData.targetDepartment && !hasDirectTargets);

  if (isBroadcastAll) {
    return true;
  }

  // Super Admin reçoit tout ce qui concerne les départements
  if (cleanRoleUpper === 'SUPER_ADMIN') {
    return true;
  }

  // Correspondance exacte ou normalisée de rôle / département
  const isRoleTarget = Boolean(
    cleanRoleUpper &&
      targetRoleClean &&
      (targetRoleClean === cleanRoleUpper ||
        (cleanRoleNorm && normalizeDepartmentKey(targetRoleClean) === cleanRoleNorm))
  );

  const isDeptTarget = targetDeptsNorm.some(
    tDept => tDept !== 'all' && tDept !== 'direct_user' && context.userDeptsNormalized.includes(tDept)
  );

  return isRoleTarget || isDeptTarget;
};

export interface RealtimeNotifSubscriptionOptions {
  userRole?: string;
  userId?: string;
  userDepartments?: string[];
  userDuesStatus?: string;
  onReceived?: (notif: RealtimeNotificationItem) => void;
  onListUpdate?: (items: RealtimeNotificationItem[]) => void;
}

export const subscribeToRealtimeNotifications = (options: RealtimeNotifSubscriptionOptions) => {
  if (typeof window === 'undefined') return () => {};

  const storedLastUserId = localStorage.getItem('erouama_last_auth_user_id') || '';
  const storedLastRole = localStorage.getItem('erouama_last_auth_role') || '';
  let storedLastDepts: string[] = [];
  try {
    const raw = localStorage.getItem('erouama_last_auth_depts');
    if (raw) storedLastDepts = JSON.parse(raw);
  } catch {}

  const cleanRole = (options.userRole || storedLastRole || '').toUpperCase().trim();
  const cleanUserId = (options.userId || storedLastUserId || '').trim();
  const combinedDepts = [
    ...(options.userDepartments && options.userDepartments.length > 0 ? options.userDepartments : storedLastDepts),
    cleanRole,
  ].filter(Boolean);
  const userDeptsNormalized = Array.from(new Set(combinedDepts.map(d => normalizeDepartmentKey(d)).filter(Boolean)));

  const lastSeenKey = getLastSeenStorageKey(cleanUserId);
  let storedLastSeenTs = 0;
  let hasStoredLastSeen = false;
  try {
    const rawTs = localStorage.getItem(lastSeenKey);
    if (rawTs) {
      const parsed = Number(rawTs);
      if (!isNaN(parsed) && parsed > 0) {
        storedLastSeenTs = parsed;
        hasStoredLastSeen = true;
      }
    }
  } catch {}

  try {
    const notifsRef = collection(db, 'push_notifications');
    const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(30));

    let initialLoadDone = false;

    const toNotifItem = (docSnapId: string, docData: any): RealtimeNotificationItem => {
      const notifId = docData.messageId || docData.id || docSnapId;
      const ts =
        typeof docData.timestamp === 'number' && !isNaN(docData.timestamp)
          ? docData.timestamp
          : docData.createdAt
          ? Date.parse(docData.createdAt) || Date.now()
          : Date.now();
      return {
        id: String(notifId),
        title: docData.title || 'E-ROUAMA',
        body: docData.body || '',
        icon: docData.icon || '/icon-192.png',
        url: docData.url || '/',
        type: docData.type || 'GENERAL',
        senderName: docData.senderName || '',
        senderRole: docData.senderRole || '',
        targetDepartment: docData.targetDepartment || '',
        targetRole: docData.targetRole || '',
        createdAt: docData.createdAt || new Date(ts).toISOString(),
        timestamp: ts,
        data: docData,
      };
    };

    const emitAlertForItem = (item: RealtimeNotificationItem, docSnapId: string, docData: any) => {
      const notifTag = docData.tag || `erouama-msg-${item.id}`;
      if (hasNotificationBeenHandled(item.id) || hasNotificationBeenHandled(notifTag)) {
        return;
      }
      markNotificationAsHandled(item.id);
      markNotificationAsHandled(notifTag);
      markNotificationAsHandled(docSnapId);

      // Sonnerie temps réel même si le navigateur n'a pas encore accordé les notifications OS
      playWaveNotificationSound();

      // Notification système native (si permission accordée)
      triggerDirectNotification({
        title: item.title,
        body: item.body,
        icon: item.icon,
        tag: notifTag,
        url: item.url,
        data: docData,
      });

      // Toast in-app immédiat
      if (options.onReceived) {
        options.onReceived(item);
      }
    };

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const matchedItems: RealtimeNotificationItem[] = [];
        let maxTimestampSeen = storedLastSeenTs;

        snapshot.docs.forEach((docSnap) => {
          const docData = docSnap.data() as any;
          if (
            matchesNotificationRecipient(docData, {
              userId: cleanUserId,
              userRole: cleanRole,
              userDeptsNormalized,
              userDuesStatus: options.userDuesStatus,
            })
          ) {
            const item = toNotifItem(docSnap.id, docData);
            matchedItems.push(item);
            if (item.timestamp > maxTimestampSeen) {
              maxTimestampSeen = item.timestamp;
            }
          }
        });

        matchedItems.sort((a, b) => b.timestamp - a.timestamp);
        if (options.onListUpdate) {
          options.onListUpdate(matchedItems);
        }

        if (!initialLoadDone) {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          if (hasStoredLastSeen) {
            // Déclencher les notifications arrivées pendant que l'onglet était fermé / à la connexion
            const missedRecent = matchedItems.filter(
              item => item.timestamp > storedLastSeenTs && now - item.timestamp < dayMs
            );
            // Marquer d'abord les anciens comme traités, puis émettre au plus le plus récent en toast + sonnerie
            snapshot.docs.forEach((docSnap) => {
              const docData = docSnap.data() as any;
              const id = docData.messageId || docData.id || docSnap.id;
              const ts =
                typeof docData.timestamp === 'number'
                  ? docData.timestamp
                  : Date.parse(docData.createdAt) || 0;
              if (ts <= storedLastSeenTs) {
                markNotificationAsHandled(id);
                markNotificationAsHandled(docData.tag || `erouama-msg-${id}`);
                markNotificationAsHandled(docSnap.id);
              }
            });
            if (missedRecent.length > 0) {
              const newest = missedRecent[0];
              emitAlertForItem(newest, newest.id, newest.data || {});
              missedRecent.slice(1).forEach(m => {
                markNotificationAsHandled(m.id);
                markNotificationAsHandled(m.data?.tag || `erouama-msg-${m.id}`);
              });
            }
          } else {
            // Première initialisation sur ce navigateur : mémoriser les anciennes sans inonder l'écran
            snapshot.docs.forEach((docSnap) => {
              const docData = docSnap.data() as any;
              const initialMsgId = docData.messageId || docData.id || docSnap.id;
              const initialTag = docData.tag || `erouama-msg-${initialMsgId}`;
              markNotificationAsHandled(initialMsgId);
              markNotificationAsHandled(initialTag);
              markNotificationAsHandled(docSnap.id);
            });
          }

          const baselineTs = Math.max(now, maxTimestampSeen);
          storedLastSeenTs = baselineTs;
          try {
            localStorage.setItem(lastSeenKey, String(baselineTs));
          } catch {}
          initialLoadDone = true;
          return;
        }

        // Nouveaux événements temps réel après le chargement initial
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docData = change.doc.data() as any;
            if (
              matchesNotificationRecipient(docData, {
                userId: cleanUserId,
                userRole: cleanRole,
                userDeptsNormalized,
                userDuesStatus: options.userDuesStatus,
              })
            ) {
              const item = toNotifItem(change.doc.id, docData);
              if (item.timestamp > storedLastSeenTs) {
                storedLastSeenTs = item.timestamp;
                try {
                  localStorage.setItem(lastSeenKey, String(item.timestamp));
                } catch {}
              }
              emitAlertForItem(item, change.doc.id, docData);
            }
          }
        });
      },
      (err) => {
        console.warn('Erreur écouteur push notifications Firestore:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  } catch (err) {
    console.warn('Erreur écouteur push notifications Firestore:', err);
    return () => {};
  }
};

// Écouteur en temps réel rétro-compatible
export const listenForIncomingPushNotifications = (
  currentUserRole?: string,
  currentUserId?: string,
  userDepartments?: string[],
  onReceived?: (notif: any) => void
) => {
  return subscribeToRealtimeNotifications({
    userRole: currentUserRole,
    userId: currentUserId,
    userDepartments,
    onReceived,
  });
};
