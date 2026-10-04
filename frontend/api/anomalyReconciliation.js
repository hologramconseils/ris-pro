// Filet de sécurité pour la règle « une anomalie apparaît si et seulement si trimestres<4,
// points=0, ou année absente » (voir analyze.js). Cette règle est appliquée par consigne dans
// le prompt de l'Agent 3 (rédacteur), mais un LLM peut ne pas suivre une consigne à 100% du
// temps — c'est exactement la leçon de cette session (seuils SMIC inventés, arithmétique de
// pension fausse, etc.). Plutôt que de faire confiance à l'IA pour ce comptage, on vérifie
// après coup que chaque anomalie brute a bien un enrichissement correspondant, et on complète
// avec un enrichissement générique pour toute anomalie que l'IA aurait silencieusement omise.

// Textes modèles par type d'anomalie. Servent à la fois de filet de sécurité quand l'IA
// rédactrice omet une anomalie (premium) et de contenu complet pour le freemium, qui n'appelle
// plus l'IA rédactrice : les 3 types d'anomalies possibles (voir analyze.js) se décrivent sans
// génération de texte. Aucun montant chiffré (SMIC, seuils) : uniquement des critères qualitatifs.
const TEMPLATES = {
  'CAS 5: Année absente du relevé': {
    title: 'Année absente du relevé de carrière',
    severity: 'high',
    reason: "Cette année n'apparaît pas dans votre relevé alors qu'elle se situe entre votre première et votre dernière année d'activité. Une période travaillée, indemnisée (chômage, maladie, maternité) ou assimilée qui n'a pas été reportée ne vous rapporte aucun trimestre.",
    solution: "Vérifiez votre situation de cette année-là. Si vous avez travaillé ou perçu des indemnités, demandez la régularisation de votre carrière auprès de votre caisse de retraite depuis votre espace info-retraite.fr, justificatifs à l'appui.",
    docs: ['Bulletins de salaire ou contrat de travail de cette année', "Attestations d'indemnisation (France Travail, Assurance Maladie) le cas échéant"]
  },
  'Suspicion de trimestres manquants': {
    title: 'Trimestres manquants à vérifier',
    severity: 'high',
    reason: "Moins de 4 trimestres sont validés pour cette année. Un trimestre est validé pour chaque tranche de salaire soumis à cotisation, calculée à partir du SMIC en vigueur cette année-là : un salaire non déclaré ou mal reporté fait perdre des trimestres.",
    solution: "Comparez les salaires de cette année avec vos bulletins de paie. En cas d'écart, demandez la régularisation de votre carrière auprès de votre caisse de retraite depuis votre espace info-retraite.fr, justificatifs à l'appui.",
    docs: ['Bulletins de salaire de cette année (notamment celui de décembre)', 'Attestations employeur ou certificats de travail']
  },
  'Suspicion de points manquants': {
    title: 'Points de retraite complémentaire manquants à vérifier',
    severity: 'medium',
    reason: "Aucun point de retraite complémentaire n'apparaît pour cette année alors que des trimestres sont validés. Pour un salarié du privé, chaque année cotisée doit normalement générer des points Agirc-Arrco.",
    solution: "Consultez votre relevé de points Agirc-Arrco et signalez l'année manquante à votre caisse de retraite complémentaire, bulletins de salaire à l'appui.",
    docs: ['Bulletins de salaire de cette année', 'Relevé de points Agirc-Arrco']
  }
};

export function buildTemplateAnomaly(raw) {
  const template = TEMPLATES[raw.reason_code] || {
    title: raw.reason_code || 'Anomalie détectée',
    severity: 'medium',
    reason: raw.reason_code || 'Écart entre les données attendues et le relevé de carrière.',
    solution: 'Vérifier ce point avec votre caisse de retraite et rassembler les justificatifs correspondant à cette année.',
    docs: ['Bulletins de salaire ou justificatifs correspondant à cette année']
  };
  return {
    id: `template_${raw.year}`,
    year: raw.year,
    employer: raw.employer || 'Aucun',
    title: template.title,
    description: `Anomalie détectée pour l'année ${raw.year} : ${raw.trimesters} trimestre(s) validé(s) et ${raw.points} point(s) de retraite complémentaire.`,
    reason: template.reason,
    solution: template.solution,
    docs: template.docs,
    salary: raw.salary,
    trimesters: String(raw.trimesters),
    points: String(raw.points),
    severity: template.severity
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

  return [...enriched, ...missing.map(buildTemplateAnomaly)];
}
