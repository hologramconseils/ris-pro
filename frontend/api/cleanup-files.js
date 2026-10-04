import { del } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { getDb } from '../lib/db.js';
import { purgeExpiredFiles, RETENTION_MONTHS } from '../lib/fileRetention.js';

// Tâche planifiée (vercel.json, « crons ») : supprime chaque jour les relevés PDF déposés il y a
// plus de 6 mois. Vercel appelle cette adresse avec l'en-tête « Authorization: Bearer <CRON_SECRET> » ;
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
    const summary = await purgeExpiredFiles(getDb(), (url) => del(url));
    console.log(
      `[Rétention] Relevés de plus de ${RETENTION_MONTHS} mois supprimés : ${summary.deleted}` +
      (summary.blobFailures ? `, échecs de suppression Blob : ${summary.blobFailures}` : '')
    );
    return res.status(200).json(summary);
  } catch (error) {
    console.error('[Rétention] Échec de la purge :', error);
    return res.status(500).json({ error: 'Échec de la purge' });
  }
}
