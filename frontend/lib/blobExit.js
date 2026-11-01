// Sortie de Vercel Blob (États-Unis) : pour chaque ancien relevé encore stocké chez Vercel Blob
// (analyses.file_path en https://, non purgé), on s'assure que son contenu est bien conservé en base
// (colonne file_base64, sur le serveur européen), puis on supprime le fichier chez Vercel.
// Les identifiants des relevés (file_path) ne changent pas : les liens existants vers les bilans restent
// valables, et l'analyse relit déjà la copie en base pour ces anciens dépôts (cf. api/analyze.js).
//
// Dépendances injectées (testable sans réseau ni base) :
// - fetchBlob(url) → Buffer du fichier ; deleteBlob(url) → suppression chez Vercel ;
// - isPdf(buffer) → vrai si le contenu est un PDF.
// Sans `apply`, rien n'est modifié : le résultat indique ce qui serait fait.

const isNotFound = (error) => /not.?found|404/i.test(String(error?.message || error));

export async function exitVercelBlob({ db, fetchBlob, deleteBlob, isPdf, apply = false, log = () => {} }) {
  const { rows } = await db.query(
    `SELECT id, file_path, (file_base64 IS NOT NULL) AS has_copy
     FROM analyses
     WHERE file_path LIKE 'https://%' AND file_deleted_at IS NULL
     ORDER BY id`
  );
  const summary = { total: rows.length, alreadyCopied: 0, copied: 0, deleted: 0, errors: [] };

  for (const row of rows) {
    try {
      if (row.has_copy) {
        summary.alreadyCopied++;
      } else {
        // Seule copie du relevé : on la rapatrie en base AVANT toute suppression.
        const buffer = await fetchBlob(row.file_path);
        if (!isPdf(buffer)) throw new Error('contenu téléchargé qui n\'est pas un PDF');
        if (apply) {
          await db.query(
            'UPDATE analyses SET file_base64 = $2 WHERE id = $1 AND file_base64 IS NULL',
            [row.id, buffer.toString('base64')]
          );
        }
        summary.copied++;
      }
      if (apply) {
        try {
          await deleteBlob(row.file_path);
        } catch (error) {
          if (!isNotFound(error)) throw error; // déjà absent chez Vercel : rien à supprimer
        }
      }
      summary.deleted++;
    } catch (error) {
      summary.errors.push({ id: row.id, message: error?.message || String(error) });
      log(`[Erreur] analyse ${row.id} : ${error?.message || error}`);
    }
  }
  return summary;
}
