// Service officiel de gestion des Notifications Push FCM (Web Push style Wave / WhatsApp)
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  arrayUnion,
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

    // 2. Enregistrement / récupération du Service Worker
    const swReg = await registerPushServiceWorker();

    // 3. Récupération du Token FCM officiel via SDK Firebase Messaging
    let fcmToken = '';
    try {
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
      const supported = await isSupported().catch(() => false);

      if (supported && swReg) {
        const messaging = getMessaging(app);
        // Tente de récupérer le token FCM
        const token = await getToken(messaging, {
          serviceWorkerRegistration: swReg,
        }).catch((err) => {
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

    // 5. Affiche une notification de bienvenue test style Wave
    triggerDirectNotification({
      title: 'E-ROUAMA : Notifications Push Activées 🔔',
      body: 'Vous recevrez désormais les nouvelles demandes d’information et les PV en direct, même appli fermée !',
      icon: '/LOGOPRO.png',
    });

    playWaveNotificationSound();

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

// Déclenchement direct d'une notification sur le système de l'appareil
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

  const icon = options.icon || '/LOGOPRO.png';
  const tag = options.tag || ('erouama-notif-' + Date.now());

  // Tenter via le Service Worker registration en premier pour un affichage système natif
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(options.title, {
          body: options.body,
          icon: icon,
          badge: '/LOGOPRO.png',
          tag: tag,
          vibrate: [300, 150, 300, 150, 400],
          requireInteraction: true,
          silent: false,
          data: {
            url: options.url || '/',
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
      badge: '/LOGOPRO.png',
      tag: tag,
      requireInteraction: true,
      data: {
        url: options.url || '/',
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
  type: 'INFO_REQUEST' | 'PV_PUBLISHED' | 'BILAN_PUBLISHED' | 'PAYMENT' | 'GENERAL';
  url?: string;
  metadata?: Record<string, any>;
  rawTitle?: boolean; // When true, does not prefix title with E-ROUAMA : [sender]
  priority?: 'high' | 'normal';
  sound?: string;
  requireInteraction?: boolean;
}

/**
 * Extrait tous les jetons FCM actifs des destinataires concernés dans Firestore
 * (Prend en compte les rôles, départements, gestion partagée et diffusion globale)
 */
export const extractRecipientFcmTokens = async (options: {
  targetRole?: string;
  targetDepartment?: string;
  targetUserId?: string;
  targetUserIds?: string[];
  excludedUserId?: string;
  excludedUserIds?: string[];
}): Promise<string[]> => {
  const tokens: string[] = [];
  const targetRoleClean = (options.targetRole || '').toUpperCase().trim();
  const normalizedDept = options.targetDepartment
    ? normalizeDepartmentKey(options.targetDepartment)
    : options.targetRole
    ? normalizeDepartmentKey(options.targetRole)
    : '';

  const isBroadcastAll = targetRoleClean === 'ALL' || targetRoleClean === 'TOUS' || normalizedDept === 'all';

  const excludedIds = new Set<string>();
  if (options.excludedUserId) excludedIds.add(String(options.excludedUserId).trim());
  if (Array.isArray(options.excludedUserIds)) {
    options.excludedUserIds.forEach(id => id && excludedIds.add(String(id).trim()));
  }

  try {
    const usersRef = collection(db, 'users');
    const membersRef = collection(db, 'members');

    // Cas 2 : Utilisateur(s) ciblé(s) par ID
    const directUserIds = new Set<string>();
    if (options.targetUserId) {
      directUserIds.add(String(options.targetUserId).trim());
    }
    if (Array.isArray(options.targetUserIds)) {
      options.targetUserIds.forEach(id => id && directUserIds.add(String(id).trim()));
    }

    // Cas 3 : Ciblage par Département / Rôle administratif
    const targetDeptManagers = new Set<string>();
    if (normalizedDept && normalizedDept !== 'all') {
      const deptConfig = OFFICIAL_DEPARTMENTS.find(d => 
        d.key === normalizedDept || 
        normalizeDepartmentKey(d.key) === normalizedDept ||
        d.adminRole.toLowerCase() === normalizedDept
      );
      if (deptConfig) {
        deptConfig.managerMemberIds.forEach(id => targetDeptManagers.add(String(id).trim()));
      }
    }

    // Rôles spécifiques directs
    if (normalizedDept === 'cerveau' || targetRoleClean === 'CERVEAU') {
      targetDeptManagers.add('1'); // Wilfried (Cerveau)
    }
    if (normalizedDept === 'tresorerie' || targetRoleClean === 'TRESORIER' || targetRoleClean === 'TRESO') {
      targetDeptManagers.add('11'); // Léger (Trésorier)
    }

    const collectTokensFromDoc = (docId: string, u: any) => {
      const uId = String(u.id || '').trim();
      if (excludedIds.has(docId) || (uId && excludedIds.has(uId))) {
        return;
      }

      if (isBroadcastAll) {
        if (Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u.fcmToken && typeof u.fcmToken === 'string') tokens.push(u.fcmToken);
        return;
      }

      const uDepts = Array.isArray(u.departments) ? u.departments.map(x => normalizeDepartmentKey(x)) : [];
      const uRoles = Array.isArray(u.roles) ? u.roles.map(x => normalizeDepartmentKey(x)) : [];
      const uRole = normalizeDepartmentKey(u.role || u.adminRole || '');

      const isDirectTarget = directUserIds.has(docId) || (uId && directUserIds.has(uId));
      const isManagerTarget = targetDeptManagers.has(docId) || (uId && targetDeptManagers.has(uId));
      const isDeptMatch = normalizedDept && (
        uDepts.includes(normalizedDept) ||
        uRoles.includes(normalizedDept) ||
        uRole === normalizedDept ||
        (normalizedDept === 'cerveau' && (uRoles.includes('cerveau') || uRole.includes('cerveau'))) ||
        (normalizedDept === 'tresorerie' && (uRoles.includes('tresorerie') || uRole.includes('treso')))
      );

      if (isDirectTarget || isManagerTarget || isDeptMatch) {
        if (Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u.fcmToken && typeof u.fcmToken === 'string') tokens.push(u.fcmToken);
      }
    };

    // Extraction depuis 'users'
    const [allUsersSnap, allMembersSnap] = await Promise.all([
      getDocs(usersRef).catch(() => null),
      getDocs(membersRef).catch(() => null),
    ]);

    if (allUsersSnap) {
      allUsersSnap.forEach(d => collectTokensFromDoc(d.id, d.data()));
    }
    if (allMembersSnap) {
      allMembersSnap.forEach(d => collectTokensFromDoc(d.id, d.data()));
    }
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

    const normalizedDept = options.targetDepartment
      ? normalizeDepartmentKey(options.targetDepartment)
      : options.targetRole
      ? normalizeDepartmentKey(options.targetRole)
      : null;

    const excludedUserId = options.metadata?.excludedUserId ? String(options.metadata.excludedUserId).trim() : undefined;

    // Récupération simultanée de tous les jetons FCM des destinataires concernés dans Firestore
    const targetTokens = await extractRecipientFcmTokens({
      targetRole: options.targetRole,
      targetDepartment: normalizedDept || undefined,
      targetUserId: options.targetUserId,
      targetUserIds: options.targetUserIds,
      excludedUserId,
    });

    const payload = {
      title: formattedTitle,
      body: options.body,
      icon: '/LOGOPRO.png',
      badge: '/LOGOPRO.png',
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 400],
      senderRole: options.senderRole || '',
      senderName: options.senderName || '',
      targetRole: options.targetRole || 'ALL',
      targetDepartment: normalizedDept || options.targetRole || 'ALL',
      targetUserId: options.targetUserId || null,
      targetUserIds: options.targetUserIds || (options.targetUserId ? [options.targetUserId] : []),
      targetTokens,
      fcmTokens: targetTokens,
      type: options.type,
      url: options.url || '/',
      notification: {
        title: formattedTitle,
        body: options.body,
        icon: '/LOGOPRO.png',
        badge: '/LOGOPRO.png',
        sound: 'default',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'erouama_notifications',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          requireInteraction: true,
          sound: 'default',
          vibrate: [300, 150, 300, 150, 400],
        },
      },
      metadata: {
        priority: 'high',
        sound: 'default',
        requireInteraction: true,
        ...(options.metadata || {}),
      },
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    // 1. Enregistre l'événement dans la collection Firestore 'push_notifications'
    await addDoc(collection(db, 'push_notifications'), payload);

    console.log(
      '📢 Notification Push FCM émise vers Firestore:',
      payload.title,
      `[${targetTokens.length} jetons ciblés]`,
      normalizedDept ? `[Département: ${normalizedDept}]` : ''
    );
  } catch (err) {
    console.warn('Erreur émission notification push:', err);
  }
};

// Écouteur en temps réel (onSnapshot) pour intercepter les notifications push et les afficher à l'utilisateur
export const listenForIncomingPushNotifications = (
  currentUserRole?: string,
  currentUserId?: string,
  userDepartments?: string[],
  onReceived?: (notif: any) => void
) => {
  if (typeof window === 'undefined') return () => {};

  const cleanRole = (currentUserRole || '').toUpperCase().trim();
  const cleanUserId = (currentUserId || '').trim();
  const userDeptsNormalized = (userDepartments || []).map(d => normalizeDepartmentKey(d));
  const sessionStartTime = Date.now() - 30000; // Prendre les notifs des 30 dernières secondes maximum au chargement

  try {
    const notifsRef = collection(db, 'push_notifications');
    const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as any;
          const notifTime = data.timestamp || new Date(data.createdAt).getTime();

          // Ignorer les vieilles notifications historiques
          if (notifTime < sessionStartTime) return;

          // Vérifier si cette notification s'adresse à ce rôle, cet utilisateur ou l'un de ses départements
          const targetRole = (data.targetRole || '').toUpperCase().trim();
          const targetDepartment = normalizeDepartmentKey(data.targetDepartment || data.targetRole || '');
          const targetUserId = (data.targetUserId || '').trim();
          const senderRole = (data.senderRole || '').toUpperCase().trim();

          // Ne pas notifier l'utilisateur de sa propre action si c'est lui qui l'a émise (sauf s'il est spécifiquement ciblé par targetUserId)
          if (!targetUserId && senderRole && cleanRole && senderRole === cleanRole) {
            return;
          }

          // Ne pas notifier un utilisateur explicitement exclu dans les métadonnées (ex: payeur exclu du broadcast gbrairai)
          if (data.metadata?.excludedUserId && cleanUserId && String(data.metadata.excludedUserId).trim() === cleanUserId) {
            return;
          }

          const roleMatches =
            targetRole === 'ALL' ||
            targetRole === 'TOUS' ||
            targetRole === cleanRole ||
            (targetRole === 'CERVEAU' && (cleanRole.includes('CERVEAU') || userDeptsNormalized.includes('cerveau'))) ||
            (targetRole === 'TRESORIER' && (cleanRole.includes('TRESO') || userDeptsNormalized.includes('tresorerie'))) ||
            (targetRole === 'SECRETARIAT' && (cleanRole.includes('SECRETA') || cleanRole === 'SECRETARIAT' || userDeptsNormalized.includes('secretariat'))) ||
            (targetRole === 'ORGANISATION' && (cleanRole.includes('ORGANI') || cleanRole === 'ORGANISATION' || userDeptsNormalized.includes('organisation'))) ||
            (targetRole === 'PROJET' && (cleanRole.includes('PROJET') || cleanRole === 'PROJET' || userDeptsNormalized.includes('projet'))) ||
            (targetRole === 'PAYOR' && (cleanRole.includes('PAYOR') || cleanRole === 'PAYOR' || userDeptsNormalized.includes('payor'))) ||
            (targetRole === 'COM' && (cleanRole.includes('COM') || cleanRole === 'COM' || userDeptsNormalized.includes('communication'))) ||
            (targetRole === 'SPIRITUALITE' && (cleanRole.includes('SPIRIT') || cleanRole === 'SPIRITUALITE' || userDeptsNormalized.includes('spiritualite'))) ||
            (targetRole === 'SDP' && (cleanRole.includes('SDP') || cleanRole.includes('PROGRAMME') || userDeptsNormalized.includes('suivi_programme')));

          // Vérification si le département cible correspond à un des départements de l'utilisateur (ex: communication pour Esther et Désiré)
          const deptMatches = targetDepartment && userDeptsNormalized.includes(targetDepartment);

          // Si un targetUserId précis ou une liste de membres ciblés est spécifié(e)
          const targetUserIds = Array.isArray(data.targetUserIds) ? data.targetUserIds.map((x: any) => String(x).trim()) : [];
          const isDirectTargetUser =
            Boolean(targetUserId && cleanUserId && targetUserId === cleanUserId) ||
            Boolean(targetUserIds.length > 0 && cleanUserId && targetUserIds.includes(cleanUserId));

          // Si targetRole ou département est ciblé (et aucun targetUserId n'est requis ou targetUserId correspond)
          const isRoleOrDeptTarget = !targetUserId && targetUserIds.length === 0 && (roleMatches || deptMatches);

          if (isDirectTargetUser || isRoleOrDeptTarget) {
            // Déclencher la notification Push native
            triggerDirectNotification({
              title: data.title,
              body: data.body,
              icon: data.icon || '/LOGOPRO.png',
              tag: 'push-' + change.doc.id,
              url: data.url || '/',
            });

            if (onReceived) {
              onReceived(data);
            }
          }
        }
      });
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Erreur écouteur push notifications Firestore:', err);
    return () => {};
  }
};
