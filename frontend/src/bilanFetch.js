// Récupération du bilan au retour d'un paiement (Bilan.jsx).
// Juste après le retour de Stripe, la connexion Clerk n'est pas toujours reconnue à la première demande
// (le jeton manque, le serveur répond 401/403) et le document peut ne pas encore être rattaché au compte :
// on réessaie quelques fois avant d'afficher une erreur, au lieu de la montrer à un client qui vient de payer.

export const RETRY_DELAYS_MS = [1000, 2000, 3000];
const RETRYABLE_STATUS = [401, 403, 404];

// attempt : numéro de la tentative qui vient d'échouer (0 pour la première).
export function nextRetryDelay({ status, attempt, isPaymentReturn }) {
  if (!isPaymentReturn) return null;
  if (!RETRYABLE_STATUS.includes(status)) return null;
  return attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt] : null;
}
