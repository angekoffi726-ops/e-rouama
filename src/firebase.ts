import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Identifiants Firebase officiels du projet E-ROUAMA
export const firebaseConfig = {
  apiKey: "AIzaSyCxEO6-cd0Bld5FKxBE8j8KNoP9c7PeNI4",
  authDomain: "e-rouama-f735a.firebaseapp.com",
  projectId: "e-rouama-f735a",
  storageBucket: "e-rouama-f735a.firebasestorage.app",
  messagingSenderId: "700309956720",
  appId: "1:700309956720:web:5dc3242ea580b5f39fecb5"
};

// Initialisation de Firebase avec les clés du projet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore
export const db = getFirestore(app);

// Initialisation du service d'authentification Firebase
export const auth = getAuth(app);

// Authentification anonyme pour assurer des échanges fluides en temps réel
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase Auth note:', err);
});

// Test de connectivité initiale avec Firestore avec garde-fou contre les blocages
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const fetchPromise = getDocFromServer(doc(db, 'test', 'connection'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('connection timeout')), 5000)
    );
    await Promise.race([fetchPromise, timeoutPromise]);
    console.log('✅ Connexion Firestore opérationnelle sur e-rouama-f735a');
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('timeout'))) {
      console.warn('⚠️ Connexion Firestore en attente de synchronisation ou hors-ligne.');
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
