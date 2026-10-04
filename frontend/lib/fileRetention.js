// Durée de conservation des relevés PDF déposés (RGPD) : 6 mois après le dépôt, le fichier est
// supprimé de Vercel Blob et sa copie en base (colonne file_base64) est effacée. Les résultats de
// l'analyse restent consultables ; seule une nouvelle analyse du même document devient impossible.
// Exécuté chaque jour par la tâche planifiée Vercel /api/cleanup-files (vercel.json, « crons »).

export const RETENTION_MONTHS = 6;

export const FILE_DELETED_MESSAGE =
  `Ce relevé a été supprimé automatiquement ${RETENTION_MONTHS} mois après son dépôt, conformément à notre politique de confidentialité. Merci de le déposer à nouveau pour lancer une nouvelle analyse.`;

let retentionSchemaEnsured = false;
async function ensureRetentionSchema(pool) {
  if (retentionSchemaEnsured) return;
  await pool.query(`
    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS file_deleted_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_analyses_retention
      ON analyses (created_at) WHERE file_deleted_at IS NULL;
  `);
  retentionSchemaEnsured = true;
}

// Supprime les relevés déposés il y a plus de RETENTION_MONTHS mois, par lots.
// - deleteBlob(url) : supprime le fichier de Vercel Blob (injecté pour pouvoir tester sans réseau).
// - La copie en base est effacée dans tous les cas. Le relevé n'est marqué comme supprimé
//   (file_deleted_at) que si la suppression Blob a réussi ; sinon il sera retenté le lendemain.
// - maxBatches borne le travail d'un passage, pour rester dans la durée maximale de la fonction.
export async function purgeExpiredFiles(pool, deleteBlob, { batchSize = 100, maxBatches = 20 } = {}) {
  await ensureRetentionSchema(pool);
  const summary = { deleted: 0, blobFailures: 0 };
  const failedIds = [];

  for (let batch = 0; batch < maxBatches; batch++) {
    const { rows } = await pool.query(
      `SELECT id, file_path FROM analyses
       WHERE file_deleted_at IS NULL
         AND created_at < NOW() - make_interval(months => $1)
         AND NOT (id = ANY($2::int[]))
       ORDER BY created_at
       LIMIT $3`,
      [RETENTION_MONTHS, failedIds, batchSize]
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      let blobDeleted = true;
      if (row.file_path && /^https:\/\//.test(row.file_path)) {
        try {
          await deleteBlob(row.file_path);
        } catch (error) {
          // Un fichier déjà absent du stockage n'est pas un échec.
          if (!/not.?found|404/i.test(String(error?.message || error))) {
            blobDeleted = false;
            console.error(`[Rétention] Suppression Blob impossible (analyse ${row.id}) :`, error?.message || error);
          }
        }
      }

      await pool.query(
        `UPDATE analyses
         SET file_base64 = NULL,
             file_deleted_at = CASE WHEN $2 THEN NOW() ELSE file_deleted_at END
         WHERE id = $1`,
        [row.id, blobDeleted]
      );

      if (blobDeleted) {
        summary.deleted++;
      } else {
        summary.blobFailures++;
        failedIds.push(row.id);
      }
    }

    if (rows.length < batchSize) break;
  }

  return summary;
}
