import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRetryDelay, RETRY_DELAYS_MS } from '../src/bilanFetch.js';

test('au retour d\'un paiement, un refus est réessayé avec des délais croissants', () => {
  assert.equal(nextRetryDelay({ status: 403, attempt: 0, isPaymentReturn: true }), 1000);
  assert.equal(nextRetryDelay({ status: 401, attempt: 1, isPaymentReturn: true }), 2000);
  assert.equal(nextRetryDelay({ status: 404, attempt: 2, isPaymentReturn: true }), 3000);
});

test('après les tentatives prévues, on abandonne', () => {
  assert.equal(nextRetryDelay({ status: 403, attempt: RETRY_DELAYS_MS.length, isPaymentReturn: true }), null);
});

test('hors retour de paiement, aucune nouvelle tentative automatique', () => {
  assert.equal(nextRetryDelay({ status: 403, attempt: 0, isPaymentReturn: false }), null);
});

test('une erreur serveur (500) n\'est pas réessayée en boucle', () => {
  assert.equal(nextRetryDelay({ status: 500, attempt: 0, isPaymentReturn: true }), null);
});

import { isPaymentPending } from '../src/bilanFetch.js';

const base = { isSuccess: true, profile: { analysis_credits: 0 }, results: { is_restricted: true }, isMock: false, isAdmin: false };

test('paiement en attente : retour de Stripe, 0 crédit et relevé encore restreint', () => {
  assert.equal(isPaymentPending(base), true);
});

test('bilan déjà débloqué avec 0 crédit : pas de paiement en attente, le bilan reste affiché', () => {
  assert.equal(isPaymentPending({ ...base, results: { anomalies: [] } }), false);
  assert.equal(isPaymentPending({ ...base, results: { is_restricted: false } }), false);
});

test('résultats pas encore chargés : pas de paiement en attente (l\'écran de chargement prend le relais)', () => {
  assert.equal(isPaymentPending({ ...base, results: null }), false);
});

test('crédits disponibles, hors retour de paiement, mode test ou administrateur : pas en attente', () => {
  assert.equal(isPaymentPending({ ...base, profile: { analysis_credits: 3 } }), false);
  assert.equal(isPaymentPending({ ...base, isSuccess: false }), false);
  assert.equal(isPaymentPending({ ...base, isMock: true }), false);
  assert.equal(isPaymentPending({ ...base, isAdmin: true }), false);
  assert.equal(isPaymentPending({ ...base, profile: null }), false);
});
