// Authentification : /api/auth?action=me|register|activate|login|logout|forgot|reset|magic (cf. lib/authApi.js).
import { getDb } from '../lib/db.js';
import { checkRateLimit } from '../lib/security.js';
import * as store from '../lib/authStore.js';
import { sendEmail } from '../lib/mailer.js';
import { createAuthHandler } from '../lib/authApi.js';
import { hashPassword, verifyPassword, passwordNeedsRehash, DUMMY_PASSWORD_HASH } from '../lib/passwords.js';

const passwords = { hashPassword, verifyPassword, needsRehash: passwordNeedsRehash, dummyHash: DUMMY_PASSWORD_HASH };

let schemaReady;
const db = () => {
  const pool = getDb();
  schemaReady = store.ensureAuthSchema(pool);
  return pool;
};

export default createAuthHandler({
  getDb: db,
  store: new Proxy(store, {
    // Le schéma est créé avant la première utilisation de la base.
    get: (target, name) => (typeof target[name] === 'function' && name !== 'ensureAuthSchema' && name !== 'normalizeEmail'
      ? async (...args) => { await schemaReady; return target[name](...args); }
      : target[name]),
  }),
  passwords,
  sendEmail,
  // Pour la connexion, la limitation refuse en cas de panne de la base (failOpen: false).
  rateLimit: (pool, key, endpoint, limits) => checkRateLimit(pool, key, endpoint, limits, { failOpen: false }),
});
