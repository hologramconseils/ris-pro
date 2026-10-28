import { del } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { getDb } from '../lib/db.js';
import { purgeExpiredFiles, RETENTION_MONTHS } from '../lib/fileRetention.js';
import { ensureAuthSchema, purgeExpiredAuthData } from '../lib/authStore.js';
import { isOvhRef, keyFromRef, deleteObject } from '../lib/ovhStorage.js';

// Supprime un relevé selon l'endroit où il est stocké : OVHcloud (référence « ovh:… ») ou, pour les
// dépôts antérieurs à la migration, Vercel Blob (adresse https).
async function deleteStoredFile(filePath) {
  if (isOvhRef(filePath)) return deleteObject(keyFromRef(filePath));
  return del(filePath);
}

// Tâche planifiée (minuteur systemd sur le serveur) : supprime chaque jour les relevés PDF déposés
// il y a plus de 6 mois. Le minuteur appelle cette adresse avec « Authorization: Bearer <CRON_SECRET> » ;
// sans la variable d'environnement CRON_SECRET, la tâche refuse de s'exécuter, pour qu'aucun
// visiteur ne puisse la déclencher.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Rétention] CRON_SECRET absente : purge des relevés non exécutée.');
    return res.status(500).json({ error: 'Tâche non configurée' });
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.authorization || '');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    const summary = await purgeExpiredFiles(getDb(), deleteStoredFile);
    console.log(
      `[Rétention] Relevés de plus de ${RETENTION_MONTHS} mois supprimés : ${summary.deleted}` +
      (summary.blobFailures ? `, échecs de suppression de fichier : ${summary.blobFailures}` : '')
    );
    // Sessions et liens expirés, comptes jamais activés : un échec ici ne doit pas faire échouer la purge des relevés.
    try {
      const pool = getDb();
      await ensureAuthSchema(pool);
      const accounts = await purgeExpiredAuthData(pool);
      if (accounts) console.log(`[Rétention] Comptes jamais activés supprimés : ${accounts}`);
    } catch (authError) {
      console.error('[Rétention] Purge des données de connexion en échec :', authError.message);
    }
    return res.status(200).json(summary);
  } catch (error) {
    console.error('[Rétention] Échec de la purge :', error);
    return res.status(500).json({ error: 'Échec de la purge' });
  }
}
