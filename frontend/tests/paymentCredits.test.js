import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK_ANALYSES, creditsToGrant, unlockPaidDocument } from '../lib/paymentCredits.js';

test('le pack comprend 4 analyses en tout, dont le relevé payé', () => {
  assert.equal(PACK_ANALYSES, 4);
  assert.equal(creditsToGrant(true), 3);
});

test('si aucun relevé n\'est débloqué par le paiement, les 4 crédits sont accordés', () => {
  assert.equal(creditsToGrant(false), 4);
});

function fakeDb(rows) {
  const calls = [];
  return { calls, query: async (sql, params) => { calls.push({ sql, params }); return { rows }; } };
}

test('unlockPaidDocument renvoie vrai quand le relevé était restreint', async () => {
  const db = fakeDb([{ was_restricted: true }]);
  assert.equal(await unlockPaidDocument(db, 'user_1', 'ovh:ris-pro/a.pdf'), true);
  assert.deepEqual(db.calls[0].params, ['user_1', 'ovh:ris-pro/a.pdf']);
  assert.match(db.calls[0].sql, /results - 'is_restricted'/);
});

test('unlockPaidDocument renvoie faux pour un relevé déjà libre ou introuvable', async () => {
  assert.equal(await unlockPaidDocument(fakeDb([{ was_restricted: false }]), 'u', 'f'), false);
  assert.equal(await unlockPaidDocument(fakeDb([]), 'u', 'f'), false);
});
