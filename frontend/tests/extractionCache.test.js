import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredQuartersFromNir, toCachedExtraction, isUsableExtraction } from '../lib/extractionCache.js';

const extraction = {
  is_valid_document: true,
  nir: '1 77 05 75 123 456',
  total_trimestres_enregistres: 120,
  total_trimestres_requis: 0,
  synthese_annees: [{ year: 2000, trimesters: 4, points: 30 }],
  detail_employeurs: [{ employer: 'ACME', start_year: 2000, end_year: 2000, salary: '20 000 €' }],
};

test('toCachedExtraction : le NIR n\'est jamais mémorisé', () => {
  const cached = toCachedExtraction(extraction);
  assert.equal('nir' in cached, false);
  assert.ok(!JSON.stringify(cached).includes('123 456'));
  assert.deepEqual(cached.synthese_annees, extraction.synthese_annees);
  assert.deepEqual(cached.detail_employeurs, extraction.detail_employeurs);
});

test('toCachedExtraction : conserve les trimestres requis par défaut déduits du NIR', () => {
  assert.equal(toCachedExtraction(extraction).trimestres_requis_par_defaut, 172);
});

test('requiredQuartersFromNir : même barème qu\'avant la mémorisation', () => {
  assert.equal(requiredQuartersFromNir('1 77 05'), 172); // 1977
  assert.equal(requiredQuartersFromNir('1 68 05'), 172); // 1968
  assert.equal(requiredQuartersFromNir('2 67 05'), 171); // 1967
  assert.equal(requiredQuartersFromNir('1 64 05'), 171); // 1964
  assert.equal(requiredQuartersFromNir('1 60 05'), 170); // 1960
  assert.equal(requiredQuartersFromNir(''), 172);        // NIR absent
  assert.equal(requiredQuartersFromNir('1XX'), 170);     // NIR illisible
});

test('isUsableExtraction : seule une extraction complète et valide est réutilisée', () => {
  assert.equal(isUsableExtraction(toCachedExtraction(extraction)), true);
  assert.equal(isUsableExtraction(null), false);
  assert.equal(isUsableExtraction({}), false);
  assert.equal(isUsableExtraction({ ...toCachedExtraction(extraction), is_valid_document: false }), false);
  assert.equal(isUsableExtraction(extraction), false); // version brute, avec NIR, jamais réutilisée
});
