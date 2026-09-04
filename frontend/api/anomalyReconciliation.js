// Filet de sécurité pour la règle « une anomalie apparaît si et seulement si trimestres<4,
// points=0, ou année absente » (voir analyze.js). Cette règle est appliquée par consigne dans
// le prompt de l'Agent 3 (rédacteur), mais un LLM peut ne pas suivre une consigne à 100% du
// temps — c'est exactement la leçon de cette session (seuils SMIC inventés, arithmétique de
// pension fausse, etc.). Plutôt que de faire confiance à l'IA pour ce comptage, on vérifie
// après coup que chaque anomalie brute a bien un enrichissement correspondant, et on complète
// avec un enrichissement générique pour toute anomalie que l'IA aurait silencieusement omise.

function fallbackTitle(reasonCode) {
  if (reasonCode === 'CAS 5: Année absente du relevé') return 'Année absente du relevé de carrière';
  if (reasonCode === 'Suspicion de trimestres manquants') return 'Trimestres manquants à vérifier';
  if (reasonCode === 'Suspicion de points manquants') return 'Points de retraite complémentaire manquants à vérifier';
  return reasonCode || 'Anomalie détectée';
}

function buildFallbackAnomaly(raw) {
  return {
    id: `fallback_${raw.year}`,
    year: raw.year,
    employer: raw.employer || 'Aucun',
    title: fallbackTitle(raw.reason_code),
    description: `Anomalie détectée pour l'année ${raw.year} (${raw.reason_code || 'écart avec les critères attendus'}).`,
    reason: raw.reason_code || 'Écart entre les données attendues et le relevé de carrière.',
    solution: "Vérifier ce point avec votre caisse de retraite et rassembler les justificatifs correspondant à cette année.",
    docs: ['Bulletins de salaire ou justificatifs correspondant à cette année'],
    salary: raw.salary,
    trimesters: String(raw.trimesters),
    points: String(raw.points),
    severity: 'medium'
  };
}

// rawAnomalies : sorties par Agent 2 (JS), une entrée par année remplissant le critère.
// enrichedAnomalies : sorties par Agent 3 (IA), censées enrichir CHAQUE entrée brute 1:1.
// Retourne le tableau final, complété par un enrichissement générique pour toute année brute
// que l'IA aurait omise (jamais l'inverse : on n'ajoute rien qui ne soit pas dans rawAnomalies).
export function reconcileAnomalies(rawAnomalies, enrichedAnomalies) {
  const raw = rawAnomalies || [];
  const enriched = enrichedAnomalies || [];

  if (enriched.length === raw.length) return enriched;

  const enrichedYears = new Set(enriched.map(a => String(a.year)));
  const missing = raw.filter(r => !enrichedYears.has(String(r.year)));

  return [...enriched, ...missing.map(buildFallbackAnomaly)];
}
