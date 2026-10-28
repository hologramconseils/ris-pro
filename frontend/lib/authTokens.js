// Jetons aléatoires (session, lien de vérification, mot de passe oublié, connexion après paiement).
// Le jeton en clair n'est jamais enregistré : seule son empreinte SHA-256 l'est. Une fuite de la base ne
// permet donc pas de reprendre une session ni d'utiliser un lien en cours de validité. Les jetons étant
// aléatoires sur 256 bits, une empreinte rapide suffit (contrairement à un mot de passe choisi par un humain).

import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

// Renvoie le jeton à transmettre à l'utilisateur et l'empreinte à enregistrer.
export function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

// Identifiant d'un nouveau compte. Les comptes repris de Clerk gardent leur identifiant d'origine (« user_… »),
// ce qui évite de modifier les profils et les analyses déjà enregistrés.
export function newUserId() {
  return `usr_${randomBytes(12).toString('hex')}`;
}
