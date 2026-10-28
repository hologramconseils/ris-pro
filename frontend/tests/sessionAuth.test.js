import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthenticatedUser, isTrustedPost } from '../lib/sessionAuth.js';

const TOKEN = 'a'.repeat(43);
const req = (headers = {}) => ({ headers: { 'x-forwarded-proto': 'https', cookie: `__Host-ris_session=${TOKEN}`, ...headers } });
const storeReturning = (user) => ({
  ensureAuthSchema: async () => {},
  getSessionUser: async (_db, token) => (token === TOKEN ? user : null),
});

test('une session valable d\'un compte vérifié identifie l\'appelant', async () => {
  const user = await getAuthenticatedUser(req(), { db: {}, store: storeReturning({ id: 'usr_1', email: 'a@example.org', emailVerified: true }) });
  assert.deepEqual(user, { id: 'usr_1', email: 'a@example.org' });
});

test('sans cookie, avec un cookie inconnu ou pour un compte non vérifié : appelant inconnu', async () => {
  const verified = storeReturning({ id: 'usr_1', email: 'a@example.org', emailVerified: true });
  assert.equal(await getAuthenticatedUser(req({ cookie: '' }), { db: {}, store: verified }), null);
  assert.equal(await getAuthenticatedUser(req({ cookie: `__Host-ris_session=${'b'.repeat(43)}` }), { db: {}, store: verified }), null);
  const unverified = storeReturning({ id: 'usr_1', email: 'a@example.org', emailVerified: false });
  assert.equal(await getAuthenticatedUser(req(), { db: {}, store: unverified }), null);
});

test('un en-tête Authorization n\'est plus un moyen de s\'identifier', async () => {
  const store = storeReturning({ id: 'usr_1', email: 'a@example.org', emailVerified: true });
  assert.equal(await getAuthenticatedUser(req({ cookie: '', authorization: `Bearer ${TOKEN}` }), { db: {}, store }), null);
});

test('les POST venant d\'un autre site ne sont pas de confiance', () => {
  const env = { NEXT_PUBLIC_SITE_URL: 'https://ris.example.org' };
  assert.equal(isTrustedPost({ headers: { origin: 'https://ris.example.org' } }, env), true);
  assert.equal(isTrustedPost({ headers: { origin: 'https://pirate.example.net' } }, env), false);
  assert.equal(isTrustedPost({ headers: {} }, env), false);
});
