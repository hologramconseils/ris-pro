import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_BYTES,
  isPdfBuffer,
  UserFacingError,
  publicErrorMessage,
  maskEmail,
  checkRateLimit,
} from '../lib/security.js';

test('isPdfBuffer : accepte un contenu commençant par %PDF-', () => {
  assert.equal(isPdfBuffer(Buffer.from('%PDF-1.7\n...')), true);
});

test('isPdfBuffer : refuse un autre type de fichier, même nommé .pdf', () => {
  assert.equal(isPdfBuffer(Buffer.from('<html><script>alert(1)</script>')), false);
  assert.equal(isPdfBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), false); // PNG
  assert.equal(isPdfBuffer(Buffer.alloc(0)), false);
  assert.equal(isPdfBuffer(null), false);
});

test('MAX_UPLOAD_BYTES : reste sous la limite de corps de requête de Vercel (~4,5 Mo)', () => {
  assert.ok(MAX_UPLOAD_BYTES <= 4.5 * 1024 * 1024);
});

test('publicErrorMessage : seul un message prévu pour l\'utilisateur est renvoyé', () => {
  assert.equal(publicErrorMessage(new UserFacingError('Document illisible.'), 'Erreur'), 'Document illisible.');
  assert.equal(
    publicErrorMessage(new Error('Erreur API Mistral (401): {"detail":"invalid key sk-..."}'), 'Erreur générique'),
    'Erreur générique'
  );
});

test('maskEmail : masque l\'adresse dans les journaux', () => {
  assert.equal(maskEmail('jean.dupont@exemple.fr'), 'j***@exemple.fr');
  assert.equal(maskEmail(undefined), '(aucun)');
  assert.equal(maskEmail('pas-un-email'), '(aucun)');
});

function fakePool({ count = 0, fail = false } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (fail) throw new Error('connexion perdue');
      if (/SELECT COUNT/.test(sql)) return { rows: [{ count }] };
      return { rows: [] };
    },
  };
}

test('checkRateLimit : sous la limite => autorisé et appel enregistré', async () => {
  const pool = fakePool({ count: 2 });
  assert.equal(await checkRateLimit(pool, 'user_1', 'upload', { max: 3, windowMinutes: 60 }), true);
  assert.ok(pool.queries.some(q => /INSERT INTO api_rate_limits/.test(q.sql)));
});

test('checkRateLimit : limite atteinte => refusé, rien enregistré', async () => {
  const pool = fakePool({ count: 3 });
  assert.equal(await checkRateLimit(pool, 'user_1', 'upload', { max: 3, windowMinutes: 60 }), false);
  assert.ok(!pool.queries.some(q => /INSERT INTO api_rate_limits/.test(q.sql)));
});

test('checkRateLimit : panne de base => autorisé (ne bloque jamais un utilisateur légitime)', async () => {
  const pool = fakePool({ fail: true });
  assert.equal(await checkRateLimit(pool, 'user_1', 'analyze', { max: 3, windowMinutes: 60 }), true);
});
