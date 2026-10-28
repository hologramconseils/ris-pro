// Reprise des comptes Clerk dans la base de RIS Pro (cf. frontend/lib/clerkImport.js).
// Usage (sur le serveur, après « Export » dans le tableau de bord Clerk > Users) :
//   node server/import-clerk-users.mjs export-clerk.csv           # simulation : n'écrit rien
//   node server/import-clerk-users.mjs export-clerk.csv --apply   # crée les comptes
// Les variables de /etc/ris-pro/env (DATABASE_URL) doivent être chargées, comme pour les autres scripts.
import { readFile } from 'node:fs/promises';
import { getDb } from '../frontend/lib/db.js';
import * as store from '../frontend/lib/authStore.js';
import { parseClerkExport, importClerkUsers } from '../frontend/lib/clerkImport.js';

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Usage : node server/import-clerk-users.mjs <export-clerk.csv> [--apply]');
  process.exit(2);
}
const apply = flag === '--apply';

const { users, skipped } = parseClerkExport(await readFile(file, 'utf8'));
skipped.forEach((s) => console.warn(`Ignoré — ${s}`));
const db = getDb();
await store.ensureAuthSchema(db);
const result = await importClerkUsers({ db, store, users, apply });
console.log(`${apply ? 'Créés' : 'À créer (simulation)'} : ${result.created.length}`);
console.log(`Déjà présents : ${result.existing.length}`);
if (result.conflicts.length) console.warn(`Conflits à régler à la main : ${result.conflicts.join(', ')}`);
await db.end?.();
