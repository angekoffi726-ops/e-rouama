/**
 * Point d'accès universel et direct à la base de données FIRESTORE DE PRODUCTION (e-rouama-f735a)
 * Strictement connecté à la base par défaut (default).
 * Aucun fallback local, aucun émulateur, aucune donnée de test factice.
 */
export {
  db,
  auth,
  firebaseConfig,
  testFirestoreConnection,
  sanitizeFirestore,
} from './firebase';

import app from './firebase';
export default app;
