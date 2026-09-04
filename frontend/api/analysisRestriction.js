// Logique partagée de masquage des résultats freemium.
// Utilisée par analyze.js (génération) ET get-analysis.js (relecture) pour éviter
// que les deux endpoints divergent et qu'un utilisateur freemium récupère les
// données complètes via l'un des deux chemins.
//
// L'accès premium n'est décidé qu'à un seul endroit (analyze.js, à partir des
// crédits/statut admin) et persisté via le flag `is_restricted` sur l'analyse.
// get-analysis.js se contente ensuite de respecter ce flag déjà tranché : il ne
// doit pas le recalculer à partir du solde de crédits courant, sinon un document
// déjà débloqué redeviendrait restreint dès que l'utilisateur dépense ses crédits
// ailleurs.

// Décide de l'accès premium et de la consommation d'un crédit pour une requête d'analyse.
// - isNewIdentity : aucune analyse "completed" n'existe encore pour ce user+nir_hash.
// - wasRestricted : la dernière analyse connue pour cette identité était freemium (is_restricted === true).
// Une identité déjà débloquée (!isNewIdentity && !wasRestricted) reste premium définitivement,
// même si le solde de crédits courant est retombé à 0 depuis.
export function resolvePremiumAccess({ isAdmin, isNewIdentity, wasRestricted, currentCredits }) {
  const alreadyUnlocked = !isNewIdentity && !wasRestricted;
  const hasPremiumAccess = Boolean(isAdmin || alreadyUnlocked || currentCredits > 0);
  const shouldDeductCredit = Boolean(!isAdmin && currentCredits > 0 && (isNewIdentity || wasRestricted));
  return { hasPremiumAccess, shouldDeductCredit };
}

export function buildRestrictedResults(analysisResults) {
  const clientResponse = JSON.parse(JSON.stringify(analysisResults));
  clientResponse.is_restricted = true;
  const rawAnomalies = clientResponse.anomalies || [];
  const currentYear = new Date().getFullYear();

  const sortedAnomalies = [...rawAnomalies].sort((a, b) => {
    const yearA = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0');
    const yearB = parseInt(String(b.year).match(/\d{4}/)?.[0] || '0');
    return yearA - yearB;
  });

  const validAnomalies = sortedAnomalies.filter(a => parseInt(String(a.year).match(/\d{4}/)?.[0] || '0') < currentYear);

  const freemiumIndices = new Set();
  if (validAnomalies.length > 0) {
    freemiumIndices.add(rawAnomalies.indexOf(validAnomalies[0]));
    freemiumIndices.add(rawAnomalies.indexOf(validAnomalies[validAnomalies.length - 1]));
  }

  clientResponse.anomalies = rawAnomalies.map((anom, idx) => {
    if (freemiumIndices.has(idx)) {
      return { ...anom, is_premium: false };
    } else {
      return {
        year: anom.year || "Année masquée",
        severity: anom.severity || "medium",
        title: "Anomalie additionnelle détectée",
        description: "Débloquez votre bilan détaillé pour afficher cette anomalie ainsi que la solution corrective.",
        is_restricted: true,
        is_premium: true,
        employer: "Masqué (Premium)",
        reason: "Masqué (Premium)",
        solution: "Masqué (Premium)",
        docs: ["Pièces justificatives masquées"],
        salary: "Masqué",
        trimesters: "X/4",
        points: "X.XX"
      };
    }
  });

  return clientResponse;
}
