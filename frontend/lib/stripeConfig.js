// Version de l'API Stripe utilisée par le paiement (api/checkout.js) et le webhook
// (api/webhook.js).
//
// Chaque version majeure du SDK `stripe` change par défaut la version d'API appelée. On la fige
// ici pour que la mise à jour du SDK ne modifie pas le comportement des paiements : c'est la
// dernière version de la famille « acacia », celle qu'utilisait le SDK 17.x. Au sein d'une même
// famille, Stripe ne fait pas de changement cassant.
//
// Passer à une version plus récente doit être un choix volontaire, suivi d'un paiement test en
// mode test Stripe.
export const STRIPE_API_VERSION = '2025-02-24.acacia';
