import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileAnomalies } from '../api/anomalyReconciliation.js';

function rawAnomaly(year, overrides = {}) {
  return {
    year: String(year),
    employer: 'ACME',
    trimesters: 2,
    points: 0,
    salary: '5000',
    reason_code: 'Suspicion de trimestres manquants',
    ...overrides
  };
}

function enrichedAnomaly(year, overrides = {}) {
  return {
    year: String(year),
    title: `Titre ${year}`,
    employer: 'ACME',
    reason: 'Explication',
    solution: 'Solution',
    docs: ['doc'],
    salary: '5000',
    trimesters: '2',
    points: '0',
    severity: 'high',
    ...overrides
  };
}

test('reconcileAnomalies : même nombre => renvoie l\'enrichissement de l\'IA tel quel', () => {
  const raw = [rawAnomaly(2000), rawAnomaly(2001)];
  const enriched = [enrichedAnomaly(2000), enrichedAnomaly(2001)];
  const result = reconcileAnomalies(raw, enriched);
  assert.deepEqual(result, enriched);
});

test('reconcileAnomalies : IA omet une année => complétée automatiquement, rien de perdu', () => {
  const raw = [rawAnomaly(2000), rawAnomaly(2001), rawAnomaly(2002)];
  const enriched = [enrichedAnomaly(2000), enrichedAnomaly(2002)]; // 2001 manquant

  const result = reconcileAnomalies(raw, enriched);

  assert.equal(result.length, 3, 'aucune année brute ne doit être perdue');
  const years = result.map(a => a.year).sort();
  assert.deepEqual(years, ['2000', '2001', '2002']);

  const fallback2001 = result.find(a => a.year === '2001');
  assert.ok(fallback2001.title, 'l\'entrée de secours a un titre exploitable');
  assert.ok(fallback2001.solution);
  assert.equal(fallback2001.trimesters, '2');
});

test('reconcileAnomalies : IA ne renvoie rien => tout est reconstruit depuis les données brutes', () => {
  const raw = [rawAnomaly(2000), rawAnomaly(2001, { reason_code: 'CAS 5: Année absente du relevé', trimesters: 0, points: 0, salary: '0', employer: 'Aucun' })];
  const result = reconcileAnomalies(raw, []);

  assert.equal(result.length, 2);
  const absente = result.find(a => a.year === '2001');
  assert.equal(absente.title, 'Année absente du relevé de carrière');
});

test('reconcileAnomalies : aucune anomalie brute => tableau vide, pas d\'erreur', () => {
  assert.deepEqual(reconcileAnomalies([], []), []);
  assert.deepEqual(reconcileAnomalies([], undefined), []);
});

test('reconcileAnomalies : writerData.anomalies undefined (réponse IA malformée) => reconstruit depuis les données brutes', () => {
  const raw = [rawAnomaly(2000)];
  const result = reconcileAnomalies(raw, undefined);
  assert.equal(result.length, 1);
  assert.equal(result[0].year, '2000');
});
