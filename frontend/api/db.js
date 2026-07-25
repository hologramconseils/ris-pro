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
