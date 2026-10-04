// Mémorisation des données extraites d'un relevé (colonne analyses.extraction).
// La lecture du PDF par Mistral OCR est l'étape la plus coûteuse de l'analyse : une fois faite,
// son résultat est conservé pour que toute nouvelle analyse du même document (rechargement de la
// page freemium, passage en premium après achat, nouvelle tentative après une erreur de
// rédaction) reparte de ces données au lieu de relire le PDF.
// Le NIR n'y figure jamais : seule son empreinte salée (nir_hash) est conservée, et l'année de
// naissance n'en est retenue que sous la forme du nombre de trimestres requis par défaut.
// Les données sont effacées en même temps que le relevé, 6 mois après le dépôt (fileRetention.js).

let extractionSchemaEnsured = false;
export async function ensureExtractionSchema(pool) {
  if (extractionSchemaEnsured) return;
  await pool.query('ALTER TABLE analyses ADD COLUMN IF NOT EXISTS extraction JSONB;');
  extractionSchemaEnsured = true;
}

// Trimestres requis pour le taux plein, déduits de l'année de naissance contenue dans le NIR.
// Utilisé uniquement si le relevé n'indique pas lui-même ce total.
export function requiredQuartersFromNir(nir) {
  const cleanNir = String(nir || '').replace(/\s/g, '');
  if (cleanNir.length < 3) return 172;
  const birthYearSuffix = parseInt(cleanNir.substring(1, 3));
  if (isNaN(birthYearSuffix)) return 170;
  const birthYear = birthYearSuffix > 26 ? 1900 + birthYearSuffix : 2000 + birthYearSuffix;
  if (birthYear >= 1968) return 172;
  if (birthYear >= 1964) return 171;
  return 170;
}

// Version mémorisable de l'extraction : tout sauf le NIR.
export function toCachedExtraction(extractedData) {
  const { nir, ...rest } = extractedData;
  return { ...rest, trimestres_requis_par_defaut: requiredQuartersFromNir(nir) };
}

export function isUsableExtraction(cached) {
  return Boolean(
    cached &&
    typeof cached === 'object' &&
    cached.is_valid_document === true &&
    Array.isArray(cached.synthese_annees) &&
    Number.isInteger(cached.trimestres_requis_par_defaut)
  );
}
