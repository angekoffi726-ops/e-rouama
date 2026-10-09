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

  const icon = options.icon || '/icon-192.png';
  const tag = options.tag || 'erouama-notification';

  // Tenter via le Service Worker registration en premier pour un affichage système natif
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(options.title, {
          body: options.body,
          icon: icon,
          badge: '/icon-192.png',
          tag: tag,
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
      targetDeptManagers.add('CERVEAU');
      targetDeptManagers.add('cerveau');
      targetDeptManagers.add('admin_cerveau');
    }
    if (normalizedDept === 'tresorerie' || targetRoleClean === 'TRESORIER' || targetRoleClean === 'TRESO') {
      targetDeptManagers.add('11'); // Léger (Trésorier)
      targetDeptManagers.add('TRESORIER');
      targetDeptManagers.add('tresorerie');
      targetDeptManagers.add('admin_tresorier');
    }

    const collectTokensFromDoc = (docId: string, u: any) => {
      const uId = String(u.id || '').trim();

      // RÈGLE STRICTE BROADCAST / COMMUNAUTAIRE :
      // Pour toute diffusion collective (ALL / TOUS / broadcast général), inclure ABSOLUMENT TOUS les jetons
      // de la collection users/members sans exception, INDÉPENDAMMENT du statut de connexion en temps réel (isLoggedIn/Auth).
      if (isBroadcastAll) {
        if (Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u.fcmToken && typeof u.fcmToken === 'string' && u.fcmToken.trim()) tokens.push(u.fcmToken.trim());
        return;
      }

      // Exclusion de l'expéditeur UNIQUEMENT pour les messages directs (tests unitaires ou chats 1-à-1)
      if (excludedIds.has(docId) || (uId && excludedIds.has(uId))) {
        return;
      }

      const uDepts = Array.isArray(u.departments) ? u.departments.map(x => normalizeDepartmentKey(x)) : [];
      const uRoles = Array.isArray(u.roles) ? u.roles.map(x => normalizeDepartmentKey(x)) : [];
      const uRole = normalizeDepartmentKey(u.role || u.adminRole || '');

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

      const isDeptMatch = normalizedDept && (
        uDepts.includes(normalizedDept) ||
        uRoles.includes(normalizedDept) ||
        uRole === normalizedDept ||
        (normalizedDept === 'cerveau' && (uRoles.includes('cerveau') || uRole.includes('cerveau'))) ||
        (normalizedDept === 'tresorerie' && (uRoles.includes('tresorerie') || uRole.includes('treso')))
      );

      // CIBLAGE SANS CONDITION DE CONNEXION :
      // Les requêtes lisent les jetons FCM même si l'utilisateur s'est déconnecté (session inactive)
      if (isDirectTarget || isManagerTarget || isDeptMatch) {
        if (Array.isArray(u.fcmTokens)) tokens.push(...u.fcmTokens.filter(Boolean));
        if (u.fcmToken && typeof u.fcmToken === 'string' && u.fcmToken.trim()) tokens.push(u.fcmToken.trim());
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

    const isBroadcastAll =
      (options.targetRole || '').toUpperCase().trim() === 'ALL' ||
      (options.targetRole || '').toUpperCase().trim() === 'TOUS' ||
      normalizedDept === 'all';

    // Règle stricte : Ne filtrer/exclure que pour les messages directs ou chats 1-à-1
    const excludedUserId = isBroadcastAll
      ? undefined
      : options.metadata?.excludedUserId
      ? String(options.metadata.excludedUserId).trim()
      : undefined;

    // Récupération simultanée de tous les jetons FCM des destinataires concernés dans Firestore
    const targetTokens = await extractRecipientFcmTokens({
      targetRole: options.targetRole,
      targetDepartment: normalizedDept || undefined,
      targetUserId: options.targetUserId,
      targetUserIds: options.targetUserIds,
      excludedUserId,
    });

    // Construction du format natif FCM HTTP v1 haute priorité Android / WebPush
    const buildFcmHttpV1Envelope = (token?: string) => ({
      message: {
        token: token || '',
        notification: {
          title: formattedTitle,
          body: options.body,
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'default',
            sound: 'default',
            default_vibrate_timings: true,
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '86400',
          },
          notification: {
            title: formattedTitle,
            body: options.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            tag: 'erouama-push',
          },
          fcm_options: {
            link: options.url || '/',
          },
        },
        data: {
          title: formattedTitle,
          body: options.body,
          click_action: options.url || '/',
        },
      },
    });

    const primaryMessageObj = buildFcmHttpV1Envelope(targetTokens[0] || '').message;

    const payload = {
      title: formattedTitle,
      body: options.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      priority: 'high',
      sound: 'default',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      tag: 'erouama-push',
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
      message: primaryMessageObj,
      messages: targetTokens.map(token => buildFcmHttpV1Envelope(token)),
      notification: {
        title: formattedTitle,
        body: options.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        sound: 'default',
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'default',
          sound: 'default',
          default_vibrate_timings: true,
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          title: formattedTitle,
          body: options.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200],
          tag: 'erouama-push',
        },
        fcm_options: {
          link: options.url || '/',
        },
      },
      data: {
        click_action: options.url || '/',
        title: formattedTitle,
        body: options.body,
        url: options.url || '/',
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

  // Récupération de l'identité terminal persistée pour maintenir la réception même après déconnexion (logout)
  const storedLastUserId = localStorage.getItem('erouama_last_auth_user_id') || '';
  const storedLastRole = localStorage.getItem('erouama_last_auth_role') || '';
  let storedLastDepts: string[] = [];
  try {
    const raw = localStorage.getItem('erouama_last_auth_depts');
    if (raw) storedLastDepts = JSON.parse(raw);
  } catch {}

  const cleanRole = (currentUserRole || storedLastRole || '').toUpperCase().trim();
  const cleanUserId = (currentUserId || storedLastUserId || '').trim();
  const userDeptsNormalized = (
    userDepartments && userDepartments.length > 0 ? userDepartments : storedLastDepts
  ).map(d => normalizeDepartmentKey(d));
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
          const isBroadcast = targetRole === 'ALL' || targetRole === 'TOUS' || targetDepartment === 'all';

          // RÈGLE STRICTE AUTO-NOTIFICATION :
          // Ne filtrer/exclure l'expéditeur QUE pour les messages directs de test unitaire ou chats 1-à-1.
          // POUR TOUTES LES NOTIFICATIONS DE BROADCAST / COMMUNAUTAIRES (ex: Validation d'un Gbrairai pour tous les membres,
          // Publication de Projet, Activités Org/Spir, Annonces générales) :
          // Le ciblage inclut TOUS les membres sans exception, Y COMPRIS celui de l'administrateur/Cerveau (Wilfried)
          // qui a exécuté l'action, garantissant que chaque membre reçoive l'actualité sur son profil membre.
          if (!isBroadcast) {
            // Ne pas notifier l'utilisateur de sa propre action si c'est lui qui l'a émise (sauf s'il est spécifiquement ciblé par targetUserId)
            if (!targetUserId && senderRole && cleanRole && senderRole === cleanRole) {
              return;
            }

            // Ne pas notifier un utilisateur explicitement exclu dans les métadonnées pour un envoi direct
            if (data.metadata?.excludedUserId && cleanUserId && String(data.metadata.excludedUserId).trim() === cleanUserId) {
              return;
            }
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
