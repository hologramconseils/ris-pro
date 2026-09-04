import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSAM,
  calculateBasePension,
  calculateComplementaryPension,
  estimateMonthlyPension
} from '../api/pensionEstimate.js';

test('calculateSAM : moyenne des salaires, années à 0€ ignorées', () => {
  const careerData = [
    { year: '2000', salary: '30000' },
    { year: '2001', salary: '0' },
    { year: '2002', salary: 'N/A' },
    { year: '2003', salary: '40000' }
  ];
  assert.equal(calculateSAM(careerData), 35000);
});

test('calculateSAM : ne retient que les 25 meilleures années sur une carrière plus longue', () => {
  const careerData = Array.from({ length: 30 }, (_, i) => ({ year: String(2000 + i), salary: String(20000 + i * 100) }));
  const best25Avg = calculateSAM(careerData);
  const manualBest25 = careerData.map(c => parseFloat(c.salary)).sort((a, b) => b - a).slice(0, 25);
  const expected = manualBest25.reduce((s, v) => s + v, 0) / 25;
  assert.equal(best25Avg, expected);
});

test('calculateSAM : aucune donnée de salaire => 0', () => {
  assert.equal(calculateSAM([]), 0);
  assert.equal(calculateSAM([{ year: '2000', salary: '0' }]), 0);
});

test('calculateBasePension : ratio plafonné à 1 même si trimestres validés > requis', () => {
  const sam = 30000;
  assert.equal(calculateBasePension(sam, 200, 168), sam * 0.5);
});

test('calculateBasePension : proportionnel au ratio trimestres validés / requis', () => {
  const sam = 30000;
  assert.equal(calculateBasePension(sam, 84, 168), sam * 0.5 * 0.5);
});

test('calculateBasePension : 0 si trimestres requis manquant ou nul', () => {
  assert.equal(calculateBasePension(30000, 100, 0), 0);
  assert.equal(calculateBasePension(30000, 100, null), 0);
});

test('calculateComplementaryPension : points × valeur du point', () => {
  const result = calculateComplementaryPension(1000, 1.4386);
  assert.ok(Math.abs(result - 1438.6) < 1e-9, `attendu ~1438.6, obtenu ${result}`);
});

test('estimateMonthlyPension : assemble SAM, pension de base et complémentaire en une estimation mensuelle', () => {
  const careerData = [
    { year: '2000', salary: '20000' },
    { year: '2001', salary: '20000' }
  ];
  const result = estimateMonthlyPension({
    careerData,
    validatedQuarters: 168,
    requiredQuarters: 168,
    totalPoints: 1000
  });

  const expectedSam = 20000;
  const expectedBaseAnnual = Math.round(expectedSam * 0.5);
  const expectedComplementaryAnnual = Math.round(1000 * 1.4386);
  const expectedMonthly = Math.round((expectedBaseAnnual + expectedComplementaryAnnual) / 12);

  assert.equal(result.sam, expectedSam);
  assert.equal(result.base_pension_annual, expectedBaseAnnual);
  assert.equal(result.complementary_pension_annual, expectedComplementaryAnnual);
  assert.equal(result.total_monthly_estimate, expectedMonthly);
});

test('estimateMonthlyPension : carrière vide => tout à 0, pas d\'erreur ni de NaN', () => {
  const result = estimateMonthlyPension({
    careerData: [],
    validatedQuarters: 0,
    requiredQuarters: 168,
    totalPoints: 0
  });
  assert.deepEqual(result, {
    sam: 0,
    base_pension_annual: 0,
    complementary_pension_annual: 0,
    total_monthly_estimate: 0
  });
});
