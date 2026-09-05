import { Pool } from '@neondatabase/serverless';

// Singleton pour éviter les fuites de connexions dans Vercel Serverless
let pool;

export function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️ DATABASE_URL n'est pas définie dans l'environnement.");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// neon_schema.sql déclare `email TEXT` sur profiles, mais CREATE TABLE IF NOT EXISTS ne modifie
// jamais une table déjà existante : la table de production a été créée avant l'ajout de cette
// colonne au fichier de schéma et ne l'a jamais reçue. Résultat en cascade : toute requête
// SELECT ... email FROM profiles échouait entièrement (pas seulement le champ email), et comme
// ces requêtes servent aussi à lire analysis_credits et role pour la décision d'accès premium,
// celle-ci retombait silencieusement à false pour tout le monde (admin ET clients payants).
// Migration auto-appliquée (idempotente) au lieu d'une migration manuelle unique, pour éviter
// qu'un futur décalage schéma-code du même genre casse à nouveau silencieusement l'accès.
let profilesEmailColumnEnsured = false;
export async function ensureProfilesEmailColumn(dbPool) {
  if (profilesEmailColumnEnsured) return;
  await dbPool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;');
  profilesEmailColumnEnsured = true;
}
