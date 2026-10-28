// Crédits accordés par un paiement. Le pack de 39 € donne droit à 4 analyses EN TOUT, dont celle du
// relevé qui vient d'être payé : ce relevé est débloqué directement par le webhook (sans passer par
// /api/analyze, donc sans débit de crédit), il ne reste alors que 3 crédits pour les suivants.
// Si le paiement ne débloque aucun relevé (relevé introuvable, déjà débloqué), les 4 crédits sont accordés.

export const PACK_ANALYSES = 4;

export function creditsToGrant(unlockedDocument) {
  return PACK_ANALYSES - (unlockedDocument ? 1 : 0);
}

// Débloque le relevé payé (retire le marqueur « restreint » des résultats, rattache le relevé au
// compte) et indique s'il était réellement restreint avant le paiement. L'état précédent est lu et
// modifié dans la même requête : deux livraisons simultanées du même événement ne peuvent pas
// toutes deux croire qu'elles ont débloqué le relevé.
export async function unlockPaidDocument(db, userId, filePath) {
  const { rows } = await db.query(
    `WITH previous AS (
       SELECT id, COALESCE(results->>'is_restricted' = 'true', false) AS was_restricted
       FROM analyses WHERE file_path = $2 FOR UPDATE
     )
     UPDATE analyses a
     SET user_id = $1, results = a.results - 'is_restricted'
     FROM previous
     WHERE a.id = previous.id
     RETURNING previous.was_restricted`,
    [userId, filePath]
  );
  return rows.length > 0 && rows[0].was_restricted === true;
}
