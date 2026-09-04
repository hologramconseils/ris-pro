import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePremiumAccess } from '../api/analysisRestriction.js';

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
