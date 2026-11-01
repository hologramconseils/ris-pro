import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exitVercelBlob } from '../lib/blobExit.js';

const PDF = Buffer.from('%PDF-1.4 contenu');
const isPdf = (b) => b.subarray(0, 5).toString('latin1') === '%PDF-';

function fakeDb(rows) {
  const updates = [];
  return {
    updates,
    query: async (sql, params) => {
      if (sql.startsWith('SELECT')) return { rows };
      updates.push(params);
      return { rows: [] };
    },
  };
}

const ROWS = [
  { id: 1, file_path: 'https://blob.example/a.pdf', has_copy: true },
  { id: 2, file_path: 'https://blob.example/b.pdf', has_copy: false },
];

test('simulation : rien n\'est modifié ni supprimé, le décompte est donné', async () => {
  const db = fakeDb(ROWS);
  const deleted = [];
  const summary = await exitVercelBlob({ db, fetchBlob: async () => PDF, deleteBlob: async (u) => deleted.push(u), isPdf });
  assert.deepEqual(summary, { total: 2, alreadyCopied: 1, copied: 1, deleted: 2, errors: [] });
  assert.equal(db.updates.length, 0);
  assert.equal(deleted.length, 0);
});

test('exécution : la seule copie est rapatriée en base AVANT la suppression chez Vercel', async () => {
  const order = [];
  const fetched = [];
  const db = {
    query: async (sql, params) => {
      if (sql.startsWith('SELECT')) return { rows: ROWS };
      order.push(`copie ${params[0]}`);
      return { rows: [] };
    },
  };
  await exitVercelBlob({
    db,
    fetchBlob: async (u) => { fetched.push(u); return PDF; },
    deleteBlob: async (u) => order.push(`suppression ${u}`),
    isPdf,
    apply: true,
  });
  assert.deepEqual(fetched, ['https://blob.example/b.pdf']); // le relevé déjà copié n'est pas retéléchargé
  assert.deepEqual(order, ['suppression https://blob.example/a.pdf', 'copie 2', 'suppression https://blob.example/b.pdf']);
});

test('exécution : un fichier déjà absent chez Vercel n\'est pas une erreur', async () => {
  const summary = await exitVercelBlob({
    db: fakeDb([ROWS[0]]), fetchBlob: async () => PDF, isPdf, apply: true,
    deleteBlob: async () => { throw new Error('BlobNotFoundError: 404'); },
  });
  assert.equal(summary.errors.length, 0);
  assert.equal(summary.deleted, 1);
});

test('un téléchargement en échec ou qui n\'est pas un PDF : rien n\'est supprimé pour ce relevé', async () => {
  const deleted = [];
  const db = fakeDb([ROWS[1], { id: 3, file_path: 'https://blob.example/c.pdf', has_copy: false }]);
  let call = 0;
  const summary = await exitVercelBlob({
    db, isPdf, apply: true,
    fetchBlob: async () => (++call === 1 ? Buffer.from('<html>') : Promise.reject(new Error('téléchargement refusé (403)'))),
    deleteBlob: async (u) => deleted.push(u),
  });
  assert.equal(deleted.length, 0);
  assert.equal(db.updates.length, 0);
  assert.deepEqual(summary.errors.map((e) => e.id), [2, 3]);
  assert.match(summary.errors[0].message, /pas un PDF/);
});
