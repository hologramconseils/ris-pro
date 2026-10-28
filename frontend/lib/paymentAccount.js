// Compte rattaché à un paiement Stripe (remplace la recherche / création d'utilisateur chez Clerk).
// - Acheteur connecté : son identifiant vient du paiement (client_reference_id, posé par /api/checkout à partir
//   de la session vérifiée), jamais d'une donnée du navigateur.
// - Acheteur sans compte : le compte est créé avec l'adresse e-mail saisie chez Stripe, SANS mot de passe et non
//   vérifié ; il ne devient utilisable que par le lien de connexion envoyé à cette adresse (qui prouve que l'on
//   en possède la boîte) ou par « Mot de passe oublié ».

import { normalizeEmail } from './authStore.js';
import { magicLoginEmailLink } from './authEmails.js';

// Renvoie { userId, isNewUser } ; userId vaut null si aucun compte ne peut être déterminé.
export async function resolvePaymentAccount({ db, store, clientUserId, email }) {
  let userId = clientUserId || null;
  let isNewUser = false;

  if (!userId) {
    const address = normalizeEmail(email);
    if (!address) return { userId: null, isNewUser: false };
    let user = await store.findUserByEmail(db, address);
    if (!user) {
      user = await store.createUser(db, { email: address });
      isNewUser = Boolean(user);
      // Création simultanée par un autre traitement : le compte existe désormais.
      if (!user) user = await store.findUserByEmail(db, address);
    }
    if (!user) return { userId: null, isNewUser: false };
    userId = user.id;
  }

  // Le profil porte les crédits : il doit exister avant de les ajouter.
  await db.query('INSERT INTO profiles (id, analysis_credits) VALUES ($1, 0) ON CONFLICT (id) DO NOTHING', [userId]);
  return { userId, isNewUser };
}

// Lien de connexion (7 jours, usage unique) menant au bilan payé. null si l'adresse du site n'est pas configurée.
export async function createPaymentLoginLink({ db, store, userId, origin, filePath }) {
  if (!origin) return null;
  const token = await store.createAuthToken(db, userId, 'magic_login');
  const redirect = filePath ? `/bilan?success=true&file=${encodeURIComponent(filePath)}` : '/';
  return magicLoginEmailLink(origin, token, redirect);
}
