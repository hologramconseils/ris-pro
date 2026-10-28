// Un même paiement Stripe ne doit être traité qu'une seule fois. Stripe renvoie un événement quand le
// serveur met trop de temps à répondre (ou lors d'un renvoi manuel depuis le tableau de bord) : sans
// cette protection, chaque livraison ajouterait de nouveau les crédits et renverrait l'e-mail.
// L'identifiant de la session de paiement est enregistré à la première livraison ; les suivantes sont ignorées.

let schemaEnsured = false;
export async function ensureProcessedPaymentsSchema(db) {
  if (schemaEnsured) return;
  await db.query(`CREATE TABLE IF NOT EXISTS processed_payments (
    session_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  schemaEnsured = true;
}

// Renvoie vrai pour la première livraison de ce paiement, faux pour toute livraison suivante. L'insertion
// est atomique : deux livraisons simultanées ne peuvent pas toutes deux obtenir « vrai ».
export async function claimPayment(db, sessionId) {
  const { rows } = await db.query(
    'INSERT INTO processed_payments (session_id) VALUES ($1) ON CONFLICT (session_id) DO NOTHING RETURNING session_id',
    [sessionId]
  );
  return rows.length > 0;
}

// Libère un paiement dont le traitement a échoué avant d'accorder quoi que ce soit, pour qu'un renvoi
// de l'événement (depuis le tableau de bord Stripe) puisse être traité.
export async function releasePayment(db, sessionId) {
  await db.query('DELETE FROM processed_payments WHERE session_id = $1', [sessionId]);
}
