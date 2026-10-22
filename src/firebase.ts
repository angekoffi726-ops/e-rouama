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

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {} as any;

// Identifiants Firebase officiels du projet DE PRODUCTION E-ROUAMA (e-rouama-f735a)
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey || "AIzaSyCxEO6-cd0Bld5FKxBE8j8KNoP9c7PeNI4",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain || "e-rouama-f735a.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId || "e-rouama-f735a",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket || "e-rouama-f735a.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId || "700309956720",
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId || "1:700309956720:web:5dc3242ea580b5f39fecb5",
};

// Réduire le niveau de log Firestore pour éviter les alertes intempestives
try {
  setLogLevel('silent');
} catch {
  // Ignorer si déjà initialisé
}

// Initialisation de Firebase avec les clés officielles du projet de production
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore sur la base par défaut de production (default)
const databaseId = env.VITE_FIREBASE_DATABASE_ID || (firebaseConfigData as any).firestoreDatabaseId || '(default)';
const isDefaultDb = !databaseId || databaseId === '(default)';

let firestoreInstance;
try {
  firestoreInstance = isDefaultDb ? getFirestore(app) : getFirestore(app, databaseId);
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

// Initialisation du service d'authentification Firebase
export const auth = getAuth(app);

// Authentification anonyme si supportée par le projet
try {
  signInAnonymously(auth).catch(() => {});
} catch {
  // Ignorer si non activée sur le projet Firebase
}

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
