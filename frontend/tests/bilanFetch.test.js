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
