// Prix du pack d'analyses (en centimes), avec un prix de test réservé à un compte précis.
//
// Le prix de test sert à vérifier de bout en bout (paiement réel, webhook, e-mail) sans payer
// 39 € : il ne s'applique que si TOUTES ces conditions sont réunies :
//  - CHECKOUT_TEST_USER_ID et CHECKOUT_TEST_AMOUNT_CENTS sont définies sur le serveur ;
//  - l'utilisateur est identifié par un jeton Clerk vérifié (jamais par une valeur envoyée par le
//    navigateur) et son identifiant est exactement CHECKOUT_TEST_USER_ID ;
//  - le montant est compris entre 50 centimes (minimum accepté par Stripe) et le prix normal exclu.
// Sans ces variables, personne ne peut payer autre chose que le prix normal.

export const STANDARD_AMOUNT_CENTS = 3900;
export const MIN_TEST_AMOUNT_CENTS = 50;

export function resolveUnitAmount(authenticatedUserId, env = process.env) {
  const testUserId = env.CHECKOUT_TEST_USER_ID;
  const rawAmount = env.CHECKOUT_TEST_AMOUNT_CENTS;
  if (!authenticatedUserId || !testUserId || !rawAmount) return STANDARD_AMOUNT_CENTS;
  if (authenticatedUserId !== testUserId) return STANDARD_AMOUNT_CENTS;

  const amount = Number(rawAmount);
  const valid = Number.isInteger(amount) && amount >= MIN_TEST_AMOUNT_CENTS && amount < STANDARD_AMOUNT_CENTS;
  return valid ? amount : STANDARD_AMOUNT_CENTS;
}
