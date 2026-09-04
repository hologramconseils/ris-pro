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

function extractYear(anomalyYear) {
  return parseInt(String(anomalyYear).match(/\d{4}/)?.[0] || '0');
}

// Consigne de restitution : le premium affiche TOUTES les anomalies de la plus ancienne à la
// plus récente ; le freemium n'affiche que la plus ancienne et la plus récente, en détail. Les
// deux dépendent d'un ordre chronologique garanti — on trie ici plutôt que de faire confiance à
// l'ordre renvoyé par l'IA (jamais garanti) ou à l'ordre d'ajout du filet de sécurité de
// réconciliation (qui ajoute les entrées manquantes en fin de tableau).
export function sortAnomaliesChronologically(anomalies) {
  return [...(anomalies || [])].sort((a, b) => extractYear(a.year) - extractYear(b.year));
}

export function buildRestrictedResults(analysisResults) {
  const clientResponse = JSON.parse(JSON.stringify(analysisResults));
  clientResponse.is_restricted = true;
  // L'entrée peut déjà être triée (analyze.js trie avant assemblage), mais on retrie ici aussi :
  // cette fonction doit garantir l'ordre chronologique par elle-même, sans dépendre de ce que
  // fait l'appelant.
  const sortedAnomalies = sortAnomaliesChronologically(clientResponse.anomalies);
  const currentYear = new Date().getFullYear();

  const validAnomalies = sortedAnomalies.filter(a => extractYear(a.year) < currentYear);

  // Index (dans sortedAnomalies) de la plus ancienne et de la plus récente anomalie valide —
  // comparaison par référence d'objet (pas par année) pour rester correct même si deux
  // anomalies distinctes partagent la même année.
  const freemiumIndices = new Set();
  if (validAnomalies.length > 0) {
    freemiumIndices.add(sortedAnomalies.indexOf(validAnomalies[0]));
    freemiumIndices.add(sortedAnomalies.indexOf(validAnomalies[validAnomalies.length - 1]));
  }

  // La plus ancienne et la plus récente sont affichées en détail (données intactes) ; le reste
  // est masqué. On mappe sur sortedAnomalies (pas clientResponse.anomalies) pour que le tableau
  // final soit lui-même dans l'ordre chronologique, pas seulement le choix des 2 visibles.
  clientResponse.anomalies = sortedAnomalies.map((anom, idx) => {
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
