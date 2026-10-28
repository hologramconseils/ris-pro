// Identité de l'appelant des fonctions d'API : lue depuis le cookie de session (remplace le jeton Clerk).
// Renvoie { id, email } pour une session valable d'un compte dont l'adresse est vérifiée, sinon null.
// Les fonctions qui acceptent aussi les visiteurs sans compte (get-analysis, checkout) traitent null comme « invité ».

import * as defaultStore from './authStore.js';
import { readSessionToken } from './authCookie.js';
import { isSameOriginRequest } from './authRequest.js';

export async function getAuthenticatedUser(req, { db, store = defaultStore } = {}) {
  const token = readSessionToken(req);
  if (!token) return null;
  // Import tardif : la connexion à la base n'est chargée que si elle sert.
  const pool = db || (await import('./db.js')).getDb();
  await store.ensureAuthSchema(pool);
  const user = await store.getSessionUser(pool, token);
  return user && user.emailVerified ? { id: user.id, email: user.email } : null;
}

// Une requête POST qui s'appuie sur le cookie de session doit venir du site lui-même (en plus de SameSite=Lax).
export function isTrustedPost(req, env = process.env) {
  return isSameOriginRequest(req, env);
}
