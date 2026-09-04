// Estimation déterministe du SAM et de la pension, portée depuis
// backend/services/rules_engine.py (moteur non déployé) vers le pipeline JS réellement
// en production. Approximation volontairement simplifiée : pas de revalorisation
// historique des salaires par coefficient officiel, pas de plafonnement au PASS pour le
// SAM, pas de décote/surcote sur le taux. Le but n'est pas d'être exact au centime près
// (calcul CNAV réel), mais de donner à l'IA rédactrice une base chiffrée réelle plutôt que
// de la laisser inventer un montant en euros sans aucun calcul derrière.

// Valeur de service du point Agirc-Arrco, gelée par la circulaire Agirc-Arrco 2025-15-DT
// du 23 octobre 2025 jusqu'au 31 octobre 2026 (cf. regles_pension_reversion_2023.md).
// À mettre à jour si le point est revalorisé après cette date.
const AGIRC_ARRCO_POINT_VALUE = 1.4386;

// Taux plein du régime général hors décote/surcote (SAM × 50 % × ratio trimestres).
const BASE_PENSION_RATE = 0.5;

function parseSalary(raw) {
  const val = parseFloat(String(raw).replace(/[^0-9.-]+/g, ''));
  return isNaN(val) ? 0 : val;
}

// Moyenne des 25 meilleures années de salaire (années à salaire > 0 uniquement).
export function calculateSAM(careerData) {
  const salaries = (careerData || [])
    .map(c => parseSalary(c.salary))
    .filter(s => s > 0)
    .sort((a, b) => b - a);

  if (salaries.length === 0) return 0;

  const best25 = salaries.slice(0, 25);
  return best25.reduce((sum, s) => sum + s, 0) / best25.length;
}

// Pension de base annuelle : SAM × taux × min(1, trimestres validés / requis).
export function calculateBasePension(sam, validatedQuarters, requiredQuarters, rate = BASE_PENSION_RATE) {
  if (!requiredQuarters || requiredQuarters <= 0) return 0;
  const ratio = Math.min(1, (validatedQuarters || 0) / requiredQuarters);
  return sam * rate * ratio;
}

// Pension complémentaire annuelle : points × valeur du point.
export function calculateComplementaryPension(totalPoints, pointValue = AGIRC_ARRCO_POINT_VALUE) {
  return (totalPoints || 0) * pointValue;
}

export function estimateMonthlyPension({ careerData, validatedQuarters, requiredQuarters, totalPoints }) {
  const sam = calculateSAM(careerData);
  const basePensionAnnual = calculateBasePension(sam, validatedQuarters, requiredQuarters);
  const complementaryPensionAnnual = calculateComplementaryPension(totalPoints);
  const totalAnnual = basePensionAnnual + complementaryPensionAnnual;

  return {
    sam: Math.round(sam),
    base_pension_annual: Math.round(basePensionAnnual),
    complementary_pension_annual: Math.round(complementaryPensionAnnual),
    total_monthly_estimate: Math.round(totalAnnual / 12)
  };
}
