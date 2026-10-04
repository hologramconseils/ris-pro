// Garde-fous de sécurité partagés par les fonctions de l'API.

// Limite de taille d'un relevé envoyé. Vercel refuse de toute façon les corps de requête
// au-delà d'environ 4,5 Mo ; on vérifie avant pour renvoyer un message clair.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Un PDF commence par la signature « %PDF- ». On vérifie le contenu réel plutôt que le nom ou le
// Content-Type déclarés par le navigateur, qui sont contrôlés par le client.
export function isPdfBuffer(buffer) {
  return Boolean(buffer && buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-');
}

// Erreur dont le message est rédigé pour l'utilisateur et peut lui être affiché tel quel.
// Toute autre erreur (base de données, API Mistral, Stripe...) ne doit jamais sortir de l'API :
// son message peut contenir des détails internes.
export class UserFacingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UserFacingError';
    this.status = status;
  }
}

export function publicErrorMessage(error, fallback) {
  return error instanceof UserFacingError ? error.message : fallback;
}

// Masque une adresse e-mail pour les journaux : « jean.dupont@exemple.fr » -> « j***@exemple.fr ».
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '(aucun)';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

// Limite de requêtes par utilisateur et par point d'API, stockée dans Neon (pas de Redis dans
// ce projet). Chaque appel autorisé est enregistré ; au-delà de `max` appels sur la fenêtre, la
// requête est refusée. En cas d'erreur de base, on laisse passer : la limite protège les coûts
// (OCR Mistral) et ne doit jamais bloquer un utilisateur légitime à cause d'une panne.
export const RATE_LIMITS = {
  upload: { max: 15, windowMinutes: 60 },
  analyze: { max: 30, windowMinutes: 60 },
};

let rateLimitSchemaEnsured = false;
async function ensureRateLimitSchema(pool) {
  if (rateLimitSchemaEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS api_rate_limits_lookup
      ON api_rate_limits (user_id, endpoint, created_at);
  `);
  rateLimitSchemaEnsured = true;
}

export async function checkRateLimit(pool, userId, endpoint, limits = RATE_LIMITS[endpoint]) {
  try {
    await ensureRateLimitSchema(pool);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM api_rate_limits
       WHERE user_id = $1 AND endpoint = $2 AND created_at > NOW() - make_interval(mins => $3)`,
      [userId, endpoint, limits.windowMinutes]
    );
    if ((rows[0]?.count || 0) >= limits.max) return false;
    await pool.query(`INSERT INTO api_rate_limits (user_id, endpoint) VALUES ($1, $2)`, [userId, endpoint]);
    // Purge des entrées de cet utilisateur devenues inutiles, pour que la table reste petite.
    await pool.query(
      `DELETE FROM api_rate_limits WHERE user_id = $1 AND created_at < NOW() - INTERVAL '1 day'`,
      [userId]
    );
    return true;
  } catch (error) {
    console.error('[RateLimit] Vérification impossible, requête autorisée :', error.message);
    return true;
  }
}

export const RATE_LIMIT_MESSAGE = 'Trop de demandes en peu de temps. Merci de réessayer dans une heure.';
