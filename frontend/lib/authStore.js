// Comptes, sessions et jetons à usage unique, dans la base PostgreSQL du serveur (remplace Clerk).
// Toutes les fonctions reçoivent `db` (pool pg) : elles ne dépendent d'aucun état global, ce qui les rend testables.

import { newToken, hashToken, newUserId } from './authTokens.js';

export const SESSION_TTL_DAYS = 7; // durée de vie maximale d'une session
export const SESSION_IDLE_HOURS = 12; // sans aucune requête pendant ce délai, la session est refusée côté serveur
export const TOKEN_TTL_MINUTES = { verify_email: 24 * 60, reset_password: 60, magic_login: 7 * 24 * 60 };
const TOUCH_INTERVAL_MINUTES = 5; // la date de dernière activité n'est mise à jour qu'au plus toutes les 5 minutes

// Création des tables, une seule fois par processus (les requêtes simultanées partagent la même promesse ;
// en cas d'échec, la suivante réessaie).
let schemaPromise = null;
export function ensureAuthSchema(db) {
  schemaPromise ??= createSchema(db).catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

async function createSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_verified_at TIMESTAMPTZ,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);
    CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'magic_login')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens (user_id, purpose);
  `);
}

// --- Adresses e-mail ---

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  if (value.length < 5 || value.length > 254) return null;
  // Contrôle volontairement simple : la vraie vérification est l'envoi du lien de confirmation.
  if (!/^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[^\s@<>"',;:()\[\]\\]{2,}$/.test(value)) return null;
  if (value.includes('..')) return null;
  return value;
}

// --- Comptes ---

const USER_COLUMNS = 'id, email, email_verified_at, password_hash, created_at, last_login_at';

export async function findUserByEmail(db, email) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
  return rows[0] || null;
}

export async function findUserById(db, id) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

// Crée un compte. Renvoie null si l'adresse est déjà utilisée (même en cas de création simultanée : l'unicité est garantie par la base).
export async function createUser(db, { id = newUserId(), email, passwordHash = null, emailVerified = false }) {
  const { rows } = await db.query(
    `INSERT INTO users (id, email, password_hash, email_verified_at)
     VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() ELSE NULL END)
     ON CONFLICT DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [id, email, passwordHash, emailVerified]
  );
  return rows[0] || null;
}

export async function setPassword(db, userId, passwordHash) {
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
}

export async function markEmailVerified(db, userId) {
  await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [userId]);
}

export async function recordLogin(db, userId) {
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
}

// --- Sessions ---

export async function createSession(db, userId, { userAgent = null } = {}) {
  const { token, hash } = newToken();
  await db.query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at, user_agent)
     VALUES ($1, $2, NOW() + make_interval(days => $3), $4)`,
    [hash, userId, SESSION_TTL_DAYS, userAgent ? String(userAgent).slice(0, 300) : null]
  );
  return token;
}

// Renvoie l'utilisateur d'une session valide (non expirée, active récemment), ou null. Met à jour la date
// de dernière activité de temps en temps, sans écriture à chaque requête.
export async function getSessionUser(db, token) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.email_verified_at, s.last_seen_at
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND s.last_seen_at > NOW() - make_interval(hours => $2)
     LIMIT 1`,
    [hashToken(token), SESSION_IDLE_HOURS]
  );
  if (rows.length === 0) return null;
  await db.query(
    `UPDATE user_sessions SET last_seen_at = NOW()
     WHERE token_hash = $1 AND last_seen_at < NOW() - make_interval(mins => $2)`,
    [hashToken(token), TOUCH_INTERVAL_MINUTES]
  );
  const { id, email, email_verified_at } = rows[0];
  return { id, email, emailVerified: Boolean(email_verified_at) };
}

export async function deleteSession(db, token) {
  if (!token) return;
  await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}

// Ferme toutes les sessions d'un compte (après un changement de mot de passe, par exemple).
export async function deleteUserSessions(db, userId) {
  await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

// --- Jetons à usage unique ---

// Crée un jeton et invalide les jetons précédents du même type non utilisés (un seul lien valide à la fois).
export async function createAuthToken(db, userId, purpose) {
  const ttl = TOKEN_TTL_MINUTES[purpose];
  if (!ttl) throw new Error(`Type de jeton inconnu : ${purpose}`);
  await db.query(
    'UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL',
    [userId, purpose]
  );
  const { token, hash } = newToken();
  await db.query(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
    [hash, userId, purpose, ttl]
  );
  return token;
}

// Consomme un jeton : renvoie l'identifiant du compte, ou null si le jeton est inconnu, expiré, déjà utilisé
// ou d'un autre type. L'opération est atomique : un même lien ne peut servir qu'une fois, même cliqué deux fois en même temps.
export async function consumeAuthToken(db, token, purpose) {
  if (!token) return null;
  const { rows } = await db.query(
    `UPDATE auth_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [hashToken(token), purpose]
  );
  return rows[0]?.user_id || null;
}

// Vérifie qu'un jeton est valable SANS le consommer (pour contrôler le nouveau mot de passe avant de brûler le lien).
// Renvoie l'identifiant du compte, ou null.
export async function findValidAuthToken(db, token, purpose) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT user_id FROM auth_tokens
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [hashToken(token), purpose]
  );
  return rows[0]?.user_id || null;
}

// Supprime les sessions et les jetons expirés (appelé par la purge quotidienne).
export async function purgeExpiredAuthData(db) {
  await db.query('DELETE FROM user_sessions WHERE expires_at < NOW() OR last_seen_at < NOW() - make_interval(hours => $1)', [SESSION_IDLE_HOURS]);
  await db.query(`DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`);
}
