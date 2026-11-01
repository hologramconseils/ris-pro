// Rapatrie en base les anciens relevés encore stockés chez Vercel Blob, puis les supprime chez Vercel
// (cf. lib/blobExit.js). À lancer une seule fois, sur le serveur, depuis /opt/ris-pro/frontend :
//   node --env-file=/etc/ris-pro/env scripts/vercel-blob-exit.mjs           # simulation : ne modifie rien
//   node --env-file=/etc/ris-pro/env scripts/vercel-blob-exit.mjs --apply   # rapatrie et supprime
// La simulation télécharge déjà les relevés sans copie en base, pour vérifier qu'ils sont lisibles.
// Nécessite BLOB_READ_WRITE_TOKEN (jeton Vercel Blob, encore présent dans /etc/ris-pro/env).
import { del } from '@vercel/blob';
import { getDb } from '../lib/db.js';
import { isPdfBuffer } from '../lib/security.js';
import { exitVercelBlob } from '../lib/blobExit.js';

const apply = process.argv.includes('--apply');
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN absente : impossible de lire ou supprimer les fichiers Vercel Blob.');
  process.exit(2);
}

// Les relevés étaient déposés en accès privé : le téléchargement demande le jeton.
async function fetchBlob(url) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`téléchargement refusé (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

const db = getDb();
const summary = await exitVercelBlob({
  db,
  fetchBlob,
  deleteBlob: (url) => del(url, { token }),
  isPdf: isPdfBuffer,
  apply,
  log: console.error,
});

console.log(apply ? '=== Exécution ===' : '=== Simulation (rien n\'a été modifié) ===');
console.log(`Relevés concernés : ${summary.total}`);
console.log(`Déjà copiés en base : ${summary.alreadyCopied}`);
console.log(`${apply ? 'Copiés' : 'À copier'} en base depuis Vercel : ${summary.copied}`);
console.log(`${apply ? 'Supprimés' : 'À supprimer'} chez Vercel : ${summary.deleted}`);
console.log(`Erreurs : ${summary.errors.length}`);
await db.end?.();
process.exit(summary.errors.length ? 1 : 0);
