import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfigData from '../firebase-applet-config.json';

// Identifiants Firebase officiels du projet E-ROUAMA (synchronisés avec firebase-applet-config.json)
export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Réduire le niveau de log Firestore pour éviter les alertes intempestives
try {
  setLogLevel('silent');
} catch {
  // Ignorer si déjà initialisé
}

// Gestionnaire global pour intercepter gracieusement les dépassements temporaires de quota Free Tier
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (
      reason?.code === 'resource-exhausted' ||
      reason?.message?.includes('Quota limit exceeded') ||
      reason?.message?.includes('Free daily write units')
    ) {
      event.preventDefault();
      console.warn('⚡ Quota journalier Firestore atteint (Free Tier). Le mode local résilient prend le relais.');
    }
  });
}

// Initialisation de Firebase avec les clés officielles du projet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore avec long-polling et base de données assignée à l'application
const databaseId = (firebaseConfigData as any).firestoreDatabaseId || '(default)';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any,
    databaseId
  );
} catch {
  firestoreInstance = getFirestore(app, databaseId);
}

export const db = firestoreInstance;

// Initialisation du service d'authentification Firebase
export const auth = getAuth(app);

// Authentification anonyme pour assurer des échanges fluides en temps réel
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase Auth note:', err);
});

// Test de connectivité initiale avec Firestore avec garde-fou contre les blocages
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );
    const snap = await Promise.race([
      getDocs(query(collection(db, 'members'), limit(1))),
      timeoutPromise
    ]);
    if (snap && snap.size >= 0) {
      console.log('✅ Connexion Firestore opérationnelle sur ' + firebaseConfig.projectId + ' (' + databaseId + ')');
      return true;
    }
    return true;
  } catch (error: any) {
    // Mode hors-ligne opérationnel via le cache
    return false;
  }
}

// Fonction utilitaire pour nettoyer les valeurs undefined interdites par Firestore
export function sanitizeFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export default app;
