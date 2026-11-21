import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
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

// Laisser les erreurs critiques Firestore visibles pour le diagnostic (quota, permissions)
try {
  setLogLevel('error');
} catch {
  // Ignorer si déjà initialisé
}

// Initialisation de Firebase avec les clés directes officielles du projet de production
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation de Firestore sur la base par défaut (default)
export const db = getFirestore(app, '(default)');

// 2. SYNCHRONISATION EN LIGNE DIRECTE (RÉSEAU EN PRIORITÉ)
// Persistance IndexedDB désactivée pour garantir que les navigateurs mobiles (iOS Safari / Android Chrome)
// reçoivent instantanément toutes les requêtes et messages récents depuis le serveur Firestore
// sans rester bloqués sur des instantanés locaux obsolètes.
console.log('🌐 Synchronisation Firestore en ligne directe active (bypass cache persistant mobile).');

// Service d'authentification Firebase
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFirestoreErrorMessage(error: unknown): string {
  const code = String((error as any)?.code || '').toLowerCase();
  const msg = String((error as any)?.message || error || '').toLowerCase();

  if (code.includes('resource-exhausted') || msg.includes('quota') || msg.includes('429')) {
    return 'Quota journalier Firebase Firestore dépassé (erreur 429 RESOURCE_EXHAUSTED). Le serveur refuse temporairement les lectures/écritures jusqu’à réinitialisation du quota ou passage au forfait Blaze.';
  }
  if (code.includes('permission-denied') || msg.includes('permission') || msg.includes('403')) {
    return 'Accès refusé par les règles de sécurité Firestore (PERMISSION_DENIED).';
  }
  if (code.includes('unavailable') || msg.includes('offline') || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Serveur Firestore injoignable (problème réseau ou mode hors-ligne).';
  }
  if (code.includes('deadline-exceeded') || msg.includes('timeout')) {
    return 'Délai de réponse dépassé lors de la communication avec Firestore.';
  }
  const rawMessage = (error as any)?.message || String(error || 'Erreur inconnue');
  return `Erreur serveur Firestore (${rawMessage}).`;
}

export async function probeFirestoreRestStatus(
  collectionName: string,
  docId?: string
): Promise<{ ok: boolean; status: number; code: string; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const pathSegment = docId
      ? `${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`
      : encodeURIComponent(collectionName);
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${pathSegment}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    if (res.ok || res.status === 404) {
      return { ok: true, status: res.status, code: 'OK', message: '' };
    }
    let bodyJson: any = null;
    try {
      bodyJson = await res.json();
    } catch {
      bodyJson = null;
    }
    const apiStatus = String(bodyJson?.error?.status || res.status);
    const apiMsg = String(bodyJson?.error?.message || res.statusText || '');
    if (res.status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
      return {
        ok: false,
        status: 429,
        code: 'RESOURCE_EXHAUSTED',
        message: 'Quota journalier Firebase Firestore dépassé (erreur 429 RESOURCE_EXHAUSTED). Le serveur cloud bloque actuellement les écritures et lectures jusqu’à réinitialisation du quota.',
      };
    }
    if (res.status === 403 || apiStatus === 'PERMISSION_DENIED') {
      return {
        ok: false,
        status: 403,
        code: 'PERMISSION_DENIED',
        message: 'Accès refusé par les règles de sécurité Firestore (erreur 403 PERMISSION_DENIED).',
      };
    }
    return {
      ok: false,
      status: res.status,
      code: apiStatus,
      message: `Erreur serveur Firestore (HTTP ${res.status} : ${apiMsg || 'indisponible'}).`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Impossible de joindre le serveur Firestore (réseau instable ou hors-ligne).',
    };
  } finally {
    clearTimeout(timer);
  }
}

// Test de connectivité initiale avec Firestore via getDocFromServer
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3500)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise,
    ]);
    console.log('✅ Connexion Firestore opérationnelle sur ' + firebaseConfig.projectId + ' ((default))');
    return true;
  } catch (error: any) {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    if (code.includes('permission-denied')) {
      // Le serveur a bien répondu (connectivité réseau confirmée)
      return true;
    }
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline).');
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
