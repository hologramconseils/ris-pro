import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimPayment, releasePayment } from '../lib/paymentIdempotency.js';

// Base simulée imitant INSERT ... ON CONFLICT DO NOTHING RETURNING et DELETE.
function fakeDb() {
  const seen = new Set();
  return {
    seen,
    async query(sql, params) {
      if (/^INSERT INTO processed_payments/.test(sql)) {
        const [id] = params;
        if (seen.has(id)) return { rows: [] };
        seen.add(id);
        return { rows: [{ session_id: id }] };
      }
      if (/^DELETE FROM processed_payments/.test(sql)) {
        seen.delete(params[0]);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

test('la première livraison est acceptée, la deuxième est ignorée', async () => {
  const db = fakeDb();
  assert.equal(await claimPayment(db, 'cs_test_1'), true);
  assert.equal(await claimPayment(db, 'cs_test_1'), false);
});

test('deux paiements différents sont traités tous les deux', async () => {
  const db = fakeDb();
  assert.equal(await claimPayment(db, 'cs_test_1'), true);
  assert.equal(await claimPayment(db, 'cs_test_2'), true);
});

test('un paiement libéré peut être traité de nouveau (renvoi manuel après échec)', async () => {
  const db = fakeDb();
  await claimPayment(db, 'cs_test_1');
  await releasePayment(db, 'cs_test_1');
  assert.equal(await claimPayment(db, 'cs_test_1'), true);
});
