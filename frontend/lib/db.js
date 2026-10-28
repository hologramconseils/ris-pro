import { createRequire } from 'node:module';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { isNeonUrl } from './dbUrl.js';

const requireCjs = createRequire(import.meta.url);

// Deux types de base sont acceptés, selon DATABASE_URL :
// - Neon (adresse en neon.tech) : pilote serverless, utilisé tant que la migration n'est pas faite ;
// - PostgreSQL classique (serveur RIS, adresse locale) : pilote `pg`, chargé uniquement dans ce cas.
// Les deux exposent la même interface (query → { rows }), le reste du code n'a pas à les distinguer.
export function createPool(connectionString) {
  if (isNeonUrl(connectionString)) return new NeonPool({ connectionString });
  const { Pool } = requireCjs('pg');
  const pool = new Pool({ connectionString, max: 10 });
  // Sans écouteur, une connexion inactive coupée par le serveur ferait tomber tout le processus.
  pool.on('error', (error) => console.error('[DB] Erreur sur une connexion inactive :', error.message));
  return pool;
}

// Singleton : une seule réserve de connexions pour tout le processus
let pool;

export function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️ DATABASE_URL n'est pas définie dans l'environnement.");
    }
    pool = createPool(process.env.DATABASE_URL);
  }
  return pool;
}

// neon_schema.sql déclare plusieurs colonnes sur profiles (email, is_paid, created_at,
// updated_at...) que la table de production n'a jamais reçues : elle a été créée avant que ces
// colonnes soient ajoutées au fichier de schéma, et CREATE TABLE IF NOT EXISTS ne modifie
// jamais une table déjà existante. Deux incidents distincts causés par ce décalage :
// - SELECT ... email FROM profiles échouait entièrement (pas seulement le champ email), et
//   comme cette requête sert aussi à lire analysis_credits/role pour la décision d'accès
//   premium, celle-ci retombait silencieusement à false pour tout le monde.
// - upload.js insérait is_paid/created_at/updated_at à la création du profil ; l'échec de cet
//   INSERT (dans le même try/catch que l'INSERT dans `analyses`) empêchait l'enregistrement du
//   document d'être créé du tout, donc l'analyse ne le retrouvait jamais ensuite (404).
// Migration auto-appliquée (idempotente) plutôt qu'une migration manuelle unique, pour qu'un
// futur décalage schéma-code du même genre ne casse plus silencieusement quelque chose ailleurs.
let profilesSchemaEnsured = false;
export async function ensureProfilesSchema(dbPool) {
  if (profilesSchemaEnsured) return;
  await dbPool.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `);
  profilesSchemaEnsured = true;
}
