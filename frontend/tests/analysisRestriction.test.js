import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePremiumAccess, buildRestrictedResults, sortAnomaliesChronologically } from '../api/analysisRestriction.js';

function makeAnomaly(year, overrides = {}) {
  return {
    year: String(year),
    title: `Anomalie ${year}`,
    employer: 'ACME',
    reason: 'Explication réglementaire',
    solution: 'Fournir les justificatifs',
    docs: ['Bulletin de paie'],
    salary: '1000',
    trimesters: '2',
    points: '0',
    severity: 'high',
    ...overrides
  };
}

test('identité déjà débloquée + 0 crédit => reste premium, aucun crédit débité', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: false,
    isNewIdentity: false,
    wasRestricted: false, // la dernière analyse connue pour cette identité était déjà premium
    currentCredits: 0
  });

  assert.equal(hasPremiumAccess, true, "un document déjà payé doit rester accessible même sans crédit restant");
  assert.equal(shouldDeductCredit, false, "un document déjà débloqué ne doit jamais être débité une seconde fois");
});

test('nouvelle identité + crédits disponibles => premium, un crédit débité', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: false,
    isNewIdentity: true,
    wasRestricted: false,
    currentCredits: 3
  });

  assert.equal(hasPremiumAccess, true);
  assert.equal(shouldDeductCredit, true);
});

test('nouvelle identité + 0 crédit => freemium, rien à débiter', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: false,
    isNewIdentity: true,
    wasRestricted: false,
    currentCredits: 0
  });

  assert.equal(hasPremiumAccess, false);
  assert.equal(shouldDeductCredit, false);
});

test('identité déjà vue en freemium + crédits disponibles => premium, un crédit débité pour débloquer', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: false,
    isNewIdentity: false,
    wasRestricted: true,
    currentCredits: 1
  });

  assert.equal(hasPremiumAccess, true);
  assert.equal(shouldDeductCredit, true);
});

test('identité déjà vue en freemium + 0 crédit => reste freemium, rien à débiter', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: false,
    isNewIdentity: false,
    wasRestricted: true,
    currentCredits: 0
  });

  assert.equal(hasPremiumAccess, false);
  assert.equal(shouldDeductCredit, false);
});

test('admin => toujours premium, jamais de crédit débité, même sans crédit', () => {
  const { hasPremiumAccess, shouldDeductCredit } = resolvePremiumAccess({
    isAdmin: true,
    isNewIdentity: true,
    wasRestricted: false,
    currentCredits: 0
  });

  assert.equal(hasPremiumAccess, true);
  assert.equal(shouldDeductCredit, false);
});

test('buildRestrictedResults : 5 anomalies désordonnées => seules la plus ancienne et la plus récente restent visibles', () => {
  const anomalies = [makeAnomaly(2010), makeAnomaly(1995), makeAnomaly(2005), makeAnomaly(2000), makeAnomaly(2015)];
  const restricted = buildRestrictedResults({ anomalies });

  assert.equal(restricted.is_restricted, true);
  assert.equal(restricted.anomalies.length, 5, 'aucune anomalie ne doit être supprimée du tableau, seulement masquée');

  const visible = restricted.anomalies.filter(a => a.is_premium === false);
  const masked = restricted.anomalies.filter(a => a.is_premium === true);

  assert.equal(visible.length, 2, 'exactement 2 anomalies visibles en freemium');
  assert.equal(masked.length, 3);
  assert.deepEqual(visible.map(a => a.year).sort(), ['1995', '2015'], 'la plus ancienne (1995) et la plus récente (2015)');

  masked.forEach(a => {
    assert.equal(a.is_restricted, true);
    assert.equal(a.employer, 'Masqué (Premium)');
    assert.equal(a.solution, 'Masqué (Premium)');
  });

  visible.forEach(a => {
    assert.notEqual(a.employer, 'Masqué (Premium)', 'les anomalies visibles conservent leurs vraies données');
  });
});

test('buildRestrictedResults : une seule anomalie => elle reste visible, rien à masquer', () => {
  const restricted = buildRestrictedResults({ anomalies: [makeAnomaly(2010)] });
  assert.equal(restricted.anomalies.length, 1);
  assert.equal(restricted.anomalies[0].is_premium, false);
});

test('buildRestrictedResults : deux anomalies => les deux restent visibles (première = plus ancienne = plus récente)', () => {
  const restricted = buildRestrictedResults({ anomalies: [makeAnomaly(2010), makeAnomaly(1995)] });
  const visible = restricted.anomalies.filter(a => a.is_premium === false);
  assert.equal(visible.length, 2);
});

test('buildRestrictedResults : aucune anomalie => tableau vide, pas d\'erreur', () => {
  const restricted = buildRestrictedResults({ anomalies: [] });
  assert.deepEqual(restricted.anomalies, []);
});

test('buildRestrictedResults : une anomalie de l\'année en cours est exclue du choix "plus récente"', () => {
  const currentYear = new Date().getFullYear();
  const anomalies = [makeAnomaly(2010), makeAnomaly(currentYear)];
  const restricted = buildRestrictedResults({ anomalies });
  const visible = restricted.anomalies.filter(a => a.is_premium === false);

  assert.equal(visible.length, 1, "l'année en cours ne doit pas compter comme anomalie exploitable");
  assert.equal(visible[0].year, '2010');
});

test('buildRestrictedResults : une plage d\'années ("1992 à 2019") se trie sur sa première année', () => {
  const anomalies = [makeAnomaly(2020), makeAnomaly('1992 à 2019'), makeAnomaly(1991)];
  const restricted = buildRestrictedResults({ anomalies });
  const visible = restricted.anomalies.filter(a => a.is_premium === false).map(a => a.year);

  assert.deepEqual(visible.sort(), ['1991', '2020'], "1992 à 2019 se classe par sa première année (1992), donc n'est ni la plus ancienne (1991) ni la plus récente (2020)");
});

test('sortAnomaliesChronologically : trie de la plus ancienne à la plus récente, quel que soit l\'ordre d\'entrée', () => {
  const anomalies = [makeAnomaly(2010), makeAnomaly(1995), makeAnomaly(2005)];
  const sorted = sortAnomaliesChronologically(anomalies);
  assert.deepEqual(sorted.map(a => a.year), ['1995', '2005', '2010']);
});

test('buildRestrictedResults : le tableau final (pas seulement le choix des 2 visibles) est trié chronologiquement même si l\'entrée ne l\'était pas', () => {
  // Reproduit le cas réel : l'IA (ou le filet de réconciliation) peut renvoyer les anomalies
  // dans un ordre différent de l'ordre chronologique.
  const anomalies = [makeAnomaly(2015), makeAnomaly(1995), makeAnomaly(2005), makeAnomaly(2000), makeAnomaly(2010)];
  const restricted = buildRestrictedResults({ anomalies });

  assert.deepEqual(
    restricted.anomalies.map(a => a.year),
    ['1995', '2000', '2005', '2010', '2015'],
    'le tableau retourné doit être trié, pas seulement les 2 entrées visibles'
  );

  const visible = restricted.anomalies.filter(a => a.is_premium === false).map(a => a.year);
  assert.deepEqual(visible, ['1995', '2015']);
});
