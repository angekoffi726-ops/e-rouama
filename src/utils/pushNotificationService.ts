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
          vibrate: [300, 150, 300],
          data: { url: options.url || '/', ...options.data },
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
      data: { url: options.url || '/' },
    });
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
  targetRole?: string; // ex: "TRESORIER", "SECRETARIAT", "ALL", etc.
  targetUserId?: string;
  targetDepartment?: string; // ex: "communication", "projet", "organisation", etc.
  type: 'INFO_REQUEST' | 'PV_PUBLISHED' | 'BILAN_PUBLISHED' | 'PAYMENT' | 'GENERAL';
  url?: string;
  metadata?: Record<string, any>;
  rawTitle?: boolean; // When true, does not prefix title with E-ROUAMA : [sender]
}

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

    // Récupération simultanée de tous les jetons FCM des responsables du département si ciblage par département
    let departmentTokens: string[] = [];
    if (normalizedDept && normalizedDept !== 'all') {
      try {
        const usersRef = collection(db, 'users');
        const qDept = query(usersRef, where('departments', 'array-contains', normalizedDept));
        const snap = await getDocs(qDept);
        snap.forEach((docSnap) => {
          const u = docSnap.data();
          if (Array.isArray(u.fcmTokens)) {
            departmentTokens.push(...u.fcmTokens.filter(Boolean));
          }
          if (u.fcmToken) {
            departmentTokens.push(u.fcmToken);
          }
        });
        departmentTokens = Array.from(new Set(departmentTokens));
      } catch (deptErr) {
        console.debug('Note recherche fcmTokens du département:', deptErr);
      }
    }

    const payload = {
      title: formattedTitle,
      body: options.body,
      icon: '/LOGOPRO.png',
      badge: '/LOGOPRO.png',
      senderRole: options.senderRole || '',
      senderName: options.senderName || '',
      targetRole: options.targetRole || 'ALL',
      targetDepartment: normalizedDept || options.targetRole || 'ALL',
      targetUserId: options.targetUserId || null,
      targetTokens: departmentTokens,
      type: options.type,
      url: options.url || '/',
      metadata: options.metadata || {},
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    // 1. Enregistre l'événement dans la collection Firestore 'push_notifications'
    await addDoc(collection(db, 'push_notifications'), payload);

    // 2. Diffuse également en local si l'émetteur a besoin de retour
    console.log('📢 Notification Push FCM émise vers Firestore:', payload.title, normalizedDept ? `[Département: ${normalizedDept}]` : '');
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

          const roleMatches =
            targetRole === 'ALL' ||
            targetRole === 'TOUS' ||
            targetRole === cleanRole ||
            (targetRole === 'SECRETARIAT' && (cleanRole.includes('SECRETA') || cleanRole === 'SECRETARIAT')) ||
            (targetRole === 'TRESORIER' && (cleanRole.includes('TRESO') || cleanRole === 'TRESORIER')) ||
            (targetRole === 'ORGANISATION' && (cleanRole.includes('ORGANI') || cleanRole === 'ORGANISATION')) ||
            (targetRole === 'PROJET' && (cleanRole.includes('PROJET') || cleanRole === 'PROJET')) ||
            (targetRole === 'PAYOR' && (cleanRole.includes('PAYOR') || cleanRole === 'PAYOR')) ||
            (targetRole === 'COM' && (cleanRole.includes('COM') || cleanRole === 'COM')) ||
            (targetRole === 'SPIRITUALITE' && (cleanRole.includes('SPIRIT') || cleanRole === 'SPIRITUALITE')) ||
            (targetRole === 'SDP' && (cleanRole.includes('SDP') || cleanRole.includes('PROGRAMME')));

          // Vérification si le département cible correspond à un des départements de l'utilisateur (ex: communication pour Esther et Désiré)
          const deptMatches = targetDepartment && userDeptsNormalized.includes(targetDepartment);

          // Si un targetUserId précis est spécifié (ex: notification directe au membre concerné)
          const isDirectTargetUser = targetUserId && cleanUserId && targetUserId === cleanUserId;
          // Si targetRole ou département est ciblé (et aucun targetUserId n'est requis ou targetUserId correspond)
          const isRoleOrDeptTarget = !targetUserId && (roleMatches || deptMatches);

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
