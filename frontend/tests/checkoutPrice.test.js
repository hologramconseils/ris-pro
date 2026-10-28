import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUnitAmount, STANDARD_AMOUNT_CENTS } from '../lib/checkoutPrice.js';

const env = { CHECKOUT_TEST_USER_ID: 'user_abc', CHECKOUT_TEST_AMOUNT_CENTS: '100' };

test('le compte de test paie le montant de test', () => {
  assert.equal(resolveUnitAmount('user_abc', env), 100);
});

test('un autre compte paie toujours le prix normal', () => {
  assert.equal(resolveUnitAmount('user_autre', env), STANDARD_AMOUNT_CENTS);
});

test('un visiteur non identifié paie le prix normal', () => {
  assert.equal(resolveUnitAmount(null, env), STANDARD_AMOUNT_CENTS);
  assert.equal(resolveUnitAmount(undefined, env), STANDARD_AMOUNT_CENTS);
});

test('sans variables, le prix est normal même pour le compte de test', () => {
  assert.equal(resolveUnitAmount('user_abc', {}), STANDARD_AMOUNT_CENTS);
  assert.equal(resolveUnitAmount('user_abc', { CHECKOUT_TEST_USER_ID: 'user_abc' }), STANDARD_AMOUNT_CENTS);
  assert.equal(resolveUnitAmount('user_abc', { CHECKOUT_TEST_AMOUNT_CENTS: '100' }), STANDARD_AMOUNT_CENTS);
});

test('un montant de test invalide est ignoré', () => {
  for (const bad of ['49', '0', '-5', '3900', '5000', '1.5', 'abc', ' ']) {
    assert.equal(resolveUnitAmount('user_abc', { ...env, CHECKOUT_TEST_AMOUNT_CENTS: bad }), STANDARD_AMOUNT_CENTS, bad);
  }
});

test('le montant minimum accepté par Stripe est autorisé', () => {
  assert.equal(resolveUnitAmount('user_abc', { ...env, CHECKOUT_TEST_AMOUNT_CENTS: '50' }), 50);
});
