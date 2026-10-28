import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthHandler } from '../lib/authApi.js';
import { clientIp, siteOrigin, isSameOriginRequest } from '../lib/authRequest.js';
import { activationEmail, resetEmail, alreadyRegisteredEmail, magicLoginEmailLink } from '../lib/authEmails.js';
import { normalizeEmail } from '../lib/authStore.js';

const ORIGIN = 'https://ris.example.org';
const GOOD_PASSWORD = 'une phrase de passe correcte';

// Mots de passe factices (instantanés) : le vrai scrypt est testé dans authPrimitives.test.js.
const fakePasswords = {
  hashPassword: async (p) => `h:${p}`,
  verifyPassword: async (p, stored) => stored === `h:${p}`,
  needsRehash: (stored) => stored.startsWith('old:'),
  dummyHash: 'h:jamais-utilisable-par-un-visiteur',
};

// Base en mémoire qui reproduit le contrat de authStore.js.
function memoryStore() {
  const users = new Map();
  const sessions = new Map();
  const tokens = new Map();
  let seq = 0;
  const calls = [];
  const store = {
    users, sessions, tokens, calls,
    async createUser(_db, { email }) {
      if ([...users.values()].some((u) => u.email === email)) return null;
      const user = { id: `usr_${++seq}`, email, email_verified_at: null, password_hash: null };
      users.set(user.id, user);
      return { ...user };
    },
    async findUserByEmail(_db, email) {
      const user = [...users.values()].find((u) => u.email === email);
      return user ? { ...user } : null;
    },
    async findUserById(_db, id) {
      return users.has(id) ? { ...users.get(id) } : null;
    },
    async setPassword(_db, id, hash) { users.get(id).password_hash = hash; calls.push('setPassword'); },
    async markEmailVerified(_db, id) { users.get(id).email_verified_at ||= new Date(); },
    async recordLogin() {},
    async createSession(_db, userId) {
      const token = `session-token-${++seq}-aaaaaaaaaaaaaaaa`;
      sessions.set(token, userId);
      return token;
    },
    async getSessionUser(_db, token) {
      const userId = sessions.get(token);
      const user = userId && users.get(userId);
      return user ? { id: user.id, email: user.email, emailVerified: Boolean(user.email_verified_at) } : null;
    },
    async deleteSession(_db, token) { sessions.delete(token); },
    async deleteUserSessions(_db, userId) {
      for (const [t, u] of sessions) if (u === userId) sessions.delete(t);
    },
    async createAuthToken(_db, userId, purpose) {
      const token = `tok-${++seq}-${purpose}`;
      tokens.set(token, { userId, purpose, used: false });
      return token;
    },
    async findValidAuthToken(_db, token, purpose) {
      const t = tokens.get(token);
      return t && t.purpose === purpose && !t.used ? t.userId : null;
    },
    async consumeAuthToken(_db, token, purpose) {
      const t = tokens.get(token);
      if (!t || t.purpose !== purpose || t.used) return null;
      t.used = true;
      return t.userId;
    },
  };
  return store;
}

function setup({ rateLimit, sendEmail } = {}) {
  const store = memoryStore();
  const sent = [];
  const pending = [];
  const logs = [];
  const handler = createAuthHandler({
    getDb: () => ({}),
    store,
    passwords: fakePasswords,
    sendEmail: sendEmail || (async (mail) => { sent.push(mail); return { error: null }; }),
    rateLimit: rateLimit || (async () => true),
    background: (p) => { pending.push(p); },
    env: { NEXT_PUBLIC_SITE_URL: ORIGIN },
    log: { error: (m) => logs.push(m) },
  });
  async function call(action, { method = 'POST', body = {}, headers = {} } = {}) {
    const res = {
      headers: {}, statusCode: null, payload: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.payload = data; return this; },
    };
    const req = { method, query: { action }, body, headers: { origin: ORIGIN, 'x-forwarded-for': '203.0.113.7', 'x-forwarded-proto': 'https', ...headers } };
    await handler(req, res);
    await Promise.all(pending.splice(0));
    return res;
  }
  const tokenFromMail = (mail) => new URL(mail.html.match(/href="([^"]+)"/)[1]).searchParams.get('token');
  return { store, sent, logs, call, tokenFromMail };
}

async function activatedAccount(ctx, email = 'client@example.org') {
  await ctx.call('register', { body: { email } });
  const token = ctx.tokenFromMail(ctx.sent.at(-1));
  await ctx.call('activate', { body: { token, password: GOOD_PASSWORD } });
  return email;
}

// --- Inscription et activation ---

test('inscription : crée un compte sans mot de passe et envoie le lien d\'activation', async () => {
  const ctx = setup();
  const res = await ctx.call('register', { body: { email: ' Client@Example.org ' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  const [user] = ctx.store.users.values();
  assert.equal(user.email, 'client@example.org');
  assert.equal(user.password_hash, null);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'client@example.org');
  assert.match(ctx.sent[0].html, new RegExp(`${ORIGIN}/activation\\?token=tok-`));
  assert.equal(res.headers['Set-Cookie'], undefined); // aucune session avant d'avoir prouvé la propriété de l'adresse
});

test('inscription : la réponse est la même que l\'adresse soit libre, déjà activée, ou invalide côté serveur', async () => {
  const ctx = setup();
  const fresh = await ctx.call('register', { body: { email: 'a@example.org' } });
  await activatedAccount(ctx, 'b@example.org');
  const known = await ctx.call('register', { body: { email: 'b@example.org' } });
  assert.deepEqual(known.payload, fresh.payload);
  assert.equal(known.statusCode, fresh.statusCode);
  assert.equal(ctx.sent.at(-1).subject, alreadyRegisteredEmail(ORIGIN).subject);
});

test('inscription : une adresse invalide est refusée', async () => {
  const ctx = setup();
  for (const email of ['', 'pas-une-adresse', null, 42, 'a@b']) {
    assert.equal((await ctx.call('register', { body: { email } })).statusCode, 400);
  }
  assert.equal(ctx.sent.length, 0);
});

test('inscription répétée avant activation : un nouveau lien est envoyé, un seul compte existe', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  await ctx.call('register', { body: { email: 'a@example.org' } });
  assert.equal(ctx.store.users.size, 1);
  assert.equal(ctx.sent.length, 2);
  assert.match(ctx.sent[1].subject, /Activez/);
});

test('activation : le mot de passe est enregistré, l\'adresse est vérifiée, aucune session n\'est ouverte', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  const token = ctx.tokenFromMail(ctx.sent[0]);
  const res = await ctx.call('activate', { body: { token, password: GOOD_PASSWORD } });
  assert.equal(res.statusCode, 200);
  const [user] = ctx.store.users.values();
  assert.equal(user.password_hash, `h:${GOOD_PASSWORD}`);
  assert.ok(user.email_verified_at);
  assert.equal(ctx.store.sessions.size, 0);
});

test('activation : un lien ne sert qu\'une fois', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  const token = ctx.tokenFromMail(ctx.sent[0]);
  await ctx.call('activate', { body: { token, password: GOOD_PASSWORD } });
  const again = await ctx.call('activate', { body: { token, password: 'un autre mot de passe valable' } });
  assert.equal(again.statusCode, 400);
  assert.equal([...ctx.store.users.values()][0].password_hash, `h:${GOOD_PASSWORD}`);
});

test('activation : un mot de passe refusé ne brûle pas le lien', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  const token = ctx.tokenFromMail(ctx.sent[0]);
  const weak = await ctx.call('activate', { body: { token, password: 'court' } });
  assert.equal(weak.statusCode, 400);
  assert.equal(ctx.store.tokens.get(token).used, false);
  const ok = await ctx.call('activate', { body: { token, password: GOOD_PASSWORD } });
  assert.equal(ok.statusCode, 200);
});

test('activation : un mot de passe contenant l\'adresse e-mail est refusé', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'bertrand@example.org' } });
  const token = ctx.tokenFromMail(ctx.sent[0]);
  const res = await ctx.call('activate', { body: { token, password: 'bertrand-et-moi-2026' } });
  assert.equal(res.statusCode, 400);
  assert.equal(ctx.store.users.get('usr_1').password_hash, null);
});

test('un lien d\'un autre usage ne peut pas servir d\'activation', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  await ctx.call('forgot', { body: { email: 'client@example.org' } });
  const resetToken = ctx.tokenFromMail(ctx.sent.at(-1));
  const res = await ctx.call('activate', { body: { token: resetToken, password: GOOD_PASSWORD } });
  assert.equal(res.statusCode, 400);
  assert.equal(ctx.store.tokens.get(resetToken).used, false);
});

// --- Connexion ---

test('connexion : un compte activé obtient un cookie de session sécurisé', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  const res = await ctx.call('login', { body: { email: 'CLIENT@example.org', password: GOOD_PASSWORD } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.user.email, 'client@example.org');
  assert.equal(res.payload.user.emailVerified, true);
  const cookie = res.headers['Set-Cookie'];
  assert.match(cookie, /^__Host-ris_session=session-token-/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(JSON.stringify(res.payload).includes('password'), false);
});

test('connexion : mauvais mot de passe et compte inconnu donnent exactement la même réponse', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  const wrong = await ctx.call('login', { body: { email: 'client@example.org', password: 'mauvais mot de passe' } });
  const unknown = await ctx.call('login', { body: { email: 'inconnu@example.org', password: GOOD_PASSWORD } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.deepEqual(wrong.payload, unknown.payload);
  assert.equal(wrong.headers['Set-Cookie'], undefined);
  assert.equal(ctx.store.sessions.size, 0);
});

test('connexion : un compte jamais activé est refusé, même sans mot de passe défini ou avec le mot de passe factice', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  for (const password of ['', fakePasswords.dummyHash.slice(2), GOOD_PASSWORD]) {
    const res = await ctx.call('login', { body: { email: 'a@example.org', password } });
    assert.equal(res.statusCode, 401);
  }
  // Mot de passe défini mais adresse non vérifiée : refusé aussi.
  ctx.store.users.get('usr_1').password_hash = `h:${GOOD_PASSWORD}`;
  assert.equal((await ctx.call('login', { body: { email: 'a@example.org', password: GOOD_PASSWORD } })).statusCode, 401);
  assert.equal(ctx.store.sessions.size, 0);
});

test('connexion : des paramètres de mauvais type sont refusés sans erreur serveur', async () => {
  const ctx = setup();
  for (const body of [{}, { email: 'a@example.org' }, { email: ['a@example.org'], password: 'x' }, { email: 'a@example.org', password: { $ne: '' } }, { email: 'a@example.org', password: 'x'.repeat(5000) }]) {
    const res = await ctx.call('login', { body });
    assert.equal(res.statusCode, 400);
  }
});

test('connexion : une empreinte aux anciens paramètres est recalculée', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  ctx.store.users.get('usr_1').password_hash = 'old:h';
  fakePasswords.verifyPassword = async () => true;
  try {
    await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  } finally {
    fakePasswords.verifyPassword = async (p, stored) => stored === `h:${p}`;
  }
  assert.equal(ctx.store.users.get('usr_1').password_hash, `h:${GOOD_PASSWORD}`);
});

test('utilisateur courant : renvoie le compte avec un cookie valable, null sinon (toujours 200)', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  const login = await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  const cookie = login.headers['Set-Cookie'].split(';')[0];

  const withCookie = await ctx.call('me', { method: 'GET', headers: { cookie } });
  assert.equal(withCookie.statusCode, 200);
  assert.equal(withCookie.payload.user.email, 'client@example.org');

  const without = await ctx.call('me', { method: 'GET' });
  assert.equal(without.statusCode, 200);
  assert.equal(without.payload.user, null);

  const forged = await ctx.call('me', { method: 'GET', headers: { cookie: '__Host-ris_session=inventé-inventé-inventé-123' } });
  assert.equal(forged.payload.user, null);
});

test('déconnexion : la session est supprimée côté serveur et le cookie effacé', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  const login = await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const res = await ctx.call('logout', { headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(ctx.store.sessions.size, 0);
  assert.equal((await ctx.call('me', { method: 'GET', headers: { cookie } })).payload.user, null);
});

// --- Mot de passe oublié ---

test('mot de passe oublié : même réponse que le compte existe ou non, e-mail seulement s\'il existe', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  const before = ctx.sent.length;
  const known = await ctx.call('forgot', { body: { email: 'client@example.org' } });
  const unknown = await ctx.call('forgot', { body: { email: 'inconnu@example.org' } });
  assert.equal(known.statusCode, 200);
  assert.deepEqual(known.payload, unknown.payload);
  assert.equal(ctx.sent.length, before + 1);
  assert.equal(ctx.sent.at(-1).subject, resetEmail(ORIGIN, 'x').subject);
});

test('réinitialisation : change le mot de passe et ferme toutes les sessions ouvertes', async () => {
  const ctx = setup();
  await activatedAccount(ctx);
  await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  assert.equal(ctx.store.sessions.size, 2);

  await ctx.call('forgot', { body: { email: 'client@example.org' } });
  const token = ctx.tokenFromMail(ctx.sent.at(-1));
  const res = await ctx.call('reset', { body: { token, password: 'un tout nouveau mot de passe' } });
  assert.equal(res.statusCode, 200);
  assert.equal(ctx.store.sessions.size, 0);

  const old = await ctx.call('login', { body: { email: 'client@example.org', password: GOOD_PASSWORD } });
  assert.equal(old.statusCode, 401);
  const fresh = await ctx.call('login', { body: { email: 'client@example.org', password: 'un tout nouveau mot de passe' } });
  assert.equal(fresh.statusCode, 200);
});

test('réinitialisation : un lien d\'activation ne peut pas réinitialiser un mot de passe', async () => {
  const ctx = setup();
  await ctx.call('register', { body: { email: 'a@example.org' } });
  const activationToken = ctx.tokenFromMail(ctx.sent[0]);
  const res = await ctx.call('reset', { body: { token: activationToken, password: GOOD_PASSWORD } });
  assert.equal(res.statusCode, 400);
});

// --- Connexion par lien (après un paiement) ---

test('connexion par lien : ouvre une session, vérifie l\'adresse, et ne sert qu\'une fois', async () => {
  const ctx = setup();
  const user = await ctx.store.createUser({}, { email: 'payeur@example.org' });
  const token = await ctx.store.createAuthToken({}, user.id, 'magic_login');

  const res = await ctx.call('magic', { body: { token } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.user.email, 'payeur@example.org');
  assert.match(res.headers['Set-Cookie'], /^__Host-ris_session=/);
  assert.ok(ctx.store.users.get(user.id).email_verified_at);

  const again = await ctx.call('magic', { body: { token } });
  assert.equal(again.statusCode, 400);
  assert.equal(again.headers['Set-Cookie'], undefined);
});

test('connexion par lien : un lien d\'un autre usage est refusé', async () => {
  const ctx = setup();
  const user = await ctx.store.createUser({}, { email: 'a@example.org' });
  const token = await ctx.store.createAuthToken({}, user.id, 'reset_password');
  const res = await ctx.call('magic', { body: { token } });
  assert.equal(res.statusCode, 400);
  assert.equal(ctx.store.sessions.size, 0);
});

// --- Limitation, origine, méthode, erreurs ---

test('limitation : au-delà du seuil, la requête est refusée (429) et rien n\'est envoyé', async () => {
  const seen = [];
  const ctx = setup({ rateLimit: async (_db, id, endpoint) => { seen.push([id, endpoint]); return false; } });
  const reg = await ctx.call('register', { body: { email: 'a@example.org' } });
  const login = await ctx.call('login', { body: { email: 'a@example.org', password: GOOD_PASSWORD } });
  const forgot = await ctx.call('forgot', { body: { email: 'a@example.org' } });
  assert.deepEqual([reg.statusCode, login.statusCode, forgot.statusCode], [429, 429, 429]);
  assert.equal(ctx.store.users.size, 0);
  assert.equal(ctx.sent.length, 0);
  assert.deepEqual(seen[0], ['ip:203.0.113.7', 'auth_register_ip']);
});

test('limitation : la connexion est limitée par adresse IP ET par adresse e-mail', async () => {
  const seen = [];
  const ctx = setup({ rateLimit: async (_db, id, endpoint) => { seen.push(`${id}|${endpoint}`); return true; } });
  await ctx.call('login', { body: { email: 'a@example.org', password: 'x' } });
  assert.deepEqual(seen, ['ip:203.0.113.7|auth_login_ip', 'email:a@example.org|auth_login_email']);
});

test('limitation : les jetons (activation, réinitialisation, lien) sont aussi limités par IP', async () => {
  const ctx = setup({ rateLimit: async () => false });
  for (const action of ['activate', 'reset', 'magic']) {
    const res = await ctx.call(action, { body: { token: 'abc', password: GOOD_PASSWORD } });
    assert.equal(res.statusCode, 429, action);
  }
});

test('origine : une requête POST venant d\'un autre site est refusée avant tout traitement', async () => {
  const ctx = setup();
  for (const headers of [{ origin: 'https://pirate.example.net' }, { origin: undefined, 'sec-fetch-site': 'cross-site' }, { origin: undefined }]) {
    const res = await ctx.call('register', { body: { email: 'a@example.org' }, headers });
    assert.equal(res.statusCode, 403);
  }
  assert.equal(ctx.store.users.size, 0);
});

test('origine : sans en-tête Origin, Sec-Fetch-Site: same-origin est accepté', async () => {
  const ctx = setup();
  const res = await ctx.call('register', { body: { email: 'a@example.org' }, headers: { origin: undefined, 'sec-fetch-site': 'same-origin' } });
  assert.equal(res.statusCode, 200);
});

test('méthode et action inconnues', async () => {
  const ctx = setup();
  const wrongMethod = await ctx.call('login', { method: 'GET' });
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.Allow, 'POST');
  assert.equal((await ctx.call('me', { method: 'POST' })).statusCode, 405);
  assert.equal((await ctx.call('inconnue')).statusCode, 404);
  assert.equal((await ctx.call(undefined)).statusCode, 404);
});

test('une erreur interne renvoie un message générique, sans détail ni cookie', async () => {
  const ctx = setup();
  ctx.store.findUserByEmail = async () => { throw new Error('connexion à la base refusée: secret'); };
  const res = await ctx.call('login', { body: { email: 'a@example.org', password: GOOD_PASSWORD } });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.payload).includes('secret'), false);
  assert.equal(res.headers['Set-Cookie'], undefined);
  assert.match(ctx.logs[0], /connexion à la base refusée/);
});

test('un échec d\'envoi d\'e-mail ne fait pas échouer la requête et est journalisé sans l\'adresse complète', async () => {
  const ctx = setup({ sendEmail: async () => ({ error: { name: 'HTTP 401', message: 'Key not found' } }) });
  const res = await ctx.call('register', { body: { email: 'client@example.org' } });
  assert.equal(res.statusCode, 200);
  assert.equal(ctx.logs.length, 1);
  assert.match(ctx.logs[0], /HTTP 401/);
  assert.equal(ctx.logs[0].includes('client@example.org'), false);
});

test('sans adresse du site configurée, aucun lien n\'est fabriqué (erreur 500, rien créé)', async () => {
  const store = memoryStore();
  const logs = [];
  const handler = createAuthHandler({
    getDb: () => ({}), store, passwords: fakePasswords, sendEmail: async () => ({ error: null }),
    rateLimit: async () => true, env: { AUTH_EXTRA_ORIGINS: ORIGIN }, log: { error: (m) => logs.push(m) },
  });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  await handler({ method: 'POST', query: { action: 'register' }, body: { email: 'a@example.org' }, headers: { origin: ORIGIN } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(store.users.size, 0);
  assert.match(logs[0], /NEXT_PUBLIC_SITE_URL/);
});

// --- Outils ---

test('clientIp : première adresse de X-Forwarded-For si valide, sinon adresse directe', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' } }), '198.51.100.4');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': 'pas-une-ip' }, socket: { remoteAddress: '192.0.2.1' } }), '192.0.2.1');
  assert.equal(clientIp({ headers: {} }), 'inconnue');
});

test('siteOrigin : https obligatoire (sauf localhost), jamais lu dans la requête', () => {
  assert.equal(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://ris.example.org/chemin' }), 'https://ris.example.org');
  assert.equal(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'http://ris.example.org' }), null);
  assert.equal(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }), 'http://localhost:3000');
  assert.equal(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'n importe quoi' }), null);
  assert.equal(siteOrigin({}), null);
});

test('isSameOriginRequest : origines supplémentaires configurables', () => {
  const env = { NEXT_PUBLIC_SITE_URL: ORIGIN, AUTH_EXTRA_ORIGINS: 'https://www.ris.example.org, https://autre.example.org' };
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://www.ris.example.org' } }, env), true);
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://pirate.example.net' } }, env), false);
});

test('e-mails : les liens pointent vers le site configuré et portent le jeton', () => {
  assert.match(activationEmail(ORIGIN, 'T1').html, new RegExp(`${ORIGIN}/activation\\?token=T1`));
  assert.match(resetEmail(ORIGIN, 'T2').html, new RegExp(`${ORIGIN}/reinitialisation\\?token=T2`));
  assert.equal(magicLoginEmailLink(ORIGIN, 'T3'), `${ORIGIN}/connexion-lien?token=T3`);
  assert.equal(normalizeEmail('X@Y.fr'), 'x@y.fr');
});
