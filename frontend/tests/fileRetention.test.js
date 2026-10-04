import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purgeExpiredFiles, RETENTION_MONTHS } from '../lib/fileRetention.js';

// Base simulée : `expired` = relevés de plus de 6 mois encore présents.
function fakePool(expired) {
  const rows = expired.map((r) => ({ ...r, file_base64: 'JVBERi0=', file_deleted_at: null }));
  const queries = [];
  return {
    rows,
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT id, file_path FROM analyses/.test(sql)) {
        const [, failedIds, limit] = params;
        return { rows: rows.filter((r) => !r.file_deleted_at && !failedIds.includes(r.id)).slice(0, limit) };
      }
      if (/UPDATE analyses/.test(sql)) {
        const [id, blobDeleted] = params;
        const row = rows.find((r) => r.id === id);
        row.file_base64 = null;
        if (blobDeleted) row.file_deleted_at = 'now';
      }
      return { rows: [] };
    },
  };
}

test('purgeExpiredFiles : supprime le fichier Blob et la copie en base des relevés de plus de 6 mois', async () => {
  const pool = fakePool([
    { id: 1, file_path: 'https://blob.example/ris-pro/a.pdf' },
    { id: 2, file_path: 'https://blob.example/ris-pro/b.pdf' },
  ]);
  const deletedUrls = [];
  const summary = await purgeExpiredFiles(pool, async (url) => { deletedUrls.push(url); });

  assert.deepEqual(summary, { deleted: 2, blobFailures: 0 });
  assert.deepEqual(deletedUrls, ['https://blob.example/ris-pro/a.pdf', 'https://blob.example/ris-pro/b.pdf']);
  assert.ok(pool.rows.every((r) => r.file_base64 === null && r.file_deleted_at));
  assert.equal(pool.queries.find((q) => /SELECT id/.test(q.sql)).params[0], RETENTION_MONTHS);
});

test('purgeExpiredFiles : fichier déjà absent du stockage => considéré comme supprimé', async () => {
  const pool = fakePool([{ id: 1, file_path: 'https://blob.example/x.pdf' }]);
  const summary = await purgeExpiredFiles(pool, async () => { throw new Error('BlobNotFoundError: not found'); });
  assert.deepEqual(summary, { deleted: 1, blobFailures: 0 });
});

test('purgeExpiredFiles : échec Blob => copie en base effacée, relevé retenté au prochain passage, pas de boucle infinie', async () => {
  const pool = fakePool([{ id: 1, file_path: 'https://blob.example/x.pdf' }, { id: 2, file_path: 'https://blob.example/y.pdf' }]);
  const summary = await purgeExpiredFiles(pool, async (url) => { if (url.endsWith('x.pdf')) throw new Error('503 service unavailable'); }, { batchSize: 1 });
  assert.deepEqual(summary, { deleted: 1, blobFailures: 1 });
  const failed = pool.rows.find((r) => r.id === 1);
  assert.equal(failed.file_base64, null);
  assert.equal(failed.file_deleted_at, null);
});

test('purgeExpiredFiles : rien à supprimer => aucun appel au stockage', async () => {
  let calls = 0;
  const summary = await purgeExpiredFiles(fakePool([]), async () => { calls++; });
  assert.deepEqual(summary, { deleted: 0, blobFailures: 0 });
  assert.equal(calls, 0);
});
