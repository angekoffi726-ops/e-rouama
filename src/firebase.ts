import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Identifiants Firebase officiels du projet E-ROUAMA (chargés dynamiquement depuis la configuration applet)
export const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  ...(firebaseAppletConfig.measurementId ? { measurementId: firebaseAppletConfig.measurementId } : {})
};

// Initialisation de Firebase avec les clés du projet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore avec la base de données spécifique du projet
export const db = firebaseAppletConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseAppletConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialisation du service d'authentification Firebase
export const auth = getAuth(app);

// Authentification anonyme pour assurer des échanges fluides en temps réel
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase Auth note:', err);
});

// Test de connectivité initiale avec Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log(`✅ Connexion Firestore opérationnelle sur ${firebaseAppletConfig.projectId}`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('⚠️ Connexion Firestore hors-ligne ou en attente:', error.message);
    }
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
