import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  collection,
  getDocs,
  limit,
  query,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Identifiants Firebase officiels du projet DE PRODUCTION E-ROUAMA (e-rouama-f735a)
// Clés directes en dur pour contourner tout problème de variable d'environnement manquante
export const firebaseConfig = {
  apiKey: "AIzaSyCxEO6-cd0Bld5FKxBE8j8KNoP9c7PeNI4",
  authDomain: "e-rouama-f735a.firebaseapp.com",
  projectId: "e-rouama-f735a",
  storageBucket: "e-rouama-f735a.firebasestorage.app",
  messagingSenderId: "700309956720",
  appId: "1:700309956720:web:5dc3242ea580b5f39fecb5"
};

// Réduire le niveau de log Firestore pour éviter les alertes intempestives
try {
  setLogLevel('silent');
} catch {
  // Ignorer si déjà initialisé
}

// Initialisation de Firebase avec les clés directes officielles du projet de production
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore sur la base par défaut (default)
export const db = getFirestore(app);

// 2. PRÉSERVATION DES DONNÉES EN LOCAL (CACHE / PERSISTENCE INDEXEDDB)
// Active la persistance hors ligne Firestore afin que l'application lise prioritairement
// le cache local du navigateur sans solliciter inutilement les quotas réseau.
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('✅ Persistance Firestore IndexedDB activée avec succès.');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistance Firestore : plusieurs onglets ouverts en simultané.');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistance Firestore : le navigateur ne supporte pas IndexedDB.');
      } else {
        console.warn('Persistance Firestore non activée :', err?.message || err);
      }
    });
}

// Service d'authentification Firebase
export const auth = getAuth(app);

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
      console.log('✅ Connexion Firestore opérationnelle sur ' + firebaseConfig.projectId + ' ((default))');
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
