import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, passwordNeedsRehash, validatePassword, DUMMY_PASSWORD_HASH,
  SCRYPT_PARAMS, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH,
} from '../lib/passwords.js';
import { hashToken, newToken, newUserId } from '../lib/authTokens.js';
import {
  parseCookies, readSessionToken, sessionCookie, clearedSessionCookie, isSecureRequest,
  SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN,
} from '../lib/authCookie.js';
import { normalizeEmail } from '../lib/authStore.js';

// --- Mots de passe ---

test('un mot de passe haché se vérifie, un autre est refusé', async () => {
  const stored = await hashPassword('une phrase de passe correcte');
  assert.equal(await verifyPassword('une phrase de passe correcte', stored), true);
  assert.equal(await verifyPassword('une phrase de passe incorrecte', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('deux hachages du même mot de passe diffèrent (sel aléatoire)', async () => {
  const a = await hashPassword('une phrase de passe correcte');
  const b = await hashPassword('une phrase de passe correcte');
  assert.notEqual(a, b);
});

test('le format stocké ne contient jamais le mot de passe et porte les paramètres', async () => {
  const stored = await hashPassword('une phrase de passe correcte');
  assert.ok(!stored.includes('phrase'));
  assert.match(stored, new RegExp(`^scrypt\\$${SCRYPT_PARAMS.N}\\$${SCRYPT_PARAMS.r}\\$${SCRYPT_PARAMS.p}\\$`));
  assert.equal(passwordNeedsRehash(stored), false);
});

test('une empreinte aux anciens paramètres, ou illisible, doit être recalculée ; une empreinte illisible ne valide jamais rien', async () => {
  assert.equal(passwordNeedsRehash('scrypt$16384$8$1$c2VsLXNlbA==$' + Buffer.alloc(32).toString('base64')), true);
  assert.equal(passwordNeedsRehash('n importe quoi'), true);
  assert.equal(passwordNeedsRehash(null), true);
  assert.equal(await verifyPassword('x', null), false);
  assert.equal(await verifyPassword('x', 'scrypt$1$1$1$a$b'), false);
  assert.equal(await verifyPassword('x', 'bcrypt$10$abc'), false);
});

test('un mot de passe démesuré est refusé sans calcul coûteux', async () => {
  const stored = await hashPassword('une phrase de passe correcte');
  assert.equal(await verifyPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1), stored), false);
});

test('l\'empreinte factice sert à égaliser la durée de réponse et ne valide aucun mot de passe', async () => {
  assert.equal(await verifyPassword('une phrase de passe correcte', DUMMY_PASSWORD_HASH), false);
  assert.equal(passwordNeedsRehash(DUMMY_PASSWORD_HASH), false);
});

test('règles de mot de passe', () => {
  assert.equal(validatePassword('une phrase de passe correcte'), null);
  assert.match(validatePassword('court'), new RegExp(String(PASSWORD_MIN_LENGTH)));
  assert.match(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1)), /dépasser/);
  assert.match(validatePassword('motdepasse123'), /courant/);
  assert.match(validatePassword('aaaaaaaaaaaaaaa'), /répéter/);
  assert.match(validatePassword('jean.dupont@exemple.fr', { email: 'jean.dupont@exemple.fr' }), /e-mail/);
  assert.match(validatePassword('mon-jean.dupont-2026', { email: 'jean.dupont@exemple.fr' }), /e-mail/);
  assert.equal(validatePassword('une phrase de passe correcte', { email: 'jean.dupont@exemple.fr' }), null);
  assert.match(validatePassword(undefined), /obligatoire/);
});

// --- Jetons ---

test('un jeton est aléatoire, assez long, et seule son empreinte est conservée', () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.hash, hashToken(a.token));
  assert.notEqual(a.hash, a.token);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
});

test('les identifiants de compte sont uniques et reconnaissables', () => {
  const a = newUserId();
  assert.match(a, /^usr_[0-9a-f]{24}$/);
  assert.notEqual(a, newUserId());
});

// --- Cookies ---

const httpsReq = (cookie) => ({ headers: { 'x-forwarded-proto': 'https', cookie } });
const httpReq = (cookie) => ({ headers: { cookie } });
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

test('le cookie de session est protégé : HttpOnly, SameSite=Lax, Secure et préfixe __Host- en https', () => {
  const cookie = sessionCookie(httpsReq(), TOKEN);
  assert.ok(cookie.startsWith(`${SESSION_COOKIE_SECURE}=${TOKEN};`));
  for (const part of ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure']) assert.ok(cookie.includes(part), part);
  assert.ok(!cookie.includes('Domain='), '__Host- interdit l\'attribut Domain');
});

test('en développement local (http), le cookie n\'est pas Secure et porte le nom simple', () => {
  const cookie = sessionCookie(httpReq(), TOKEN);
  assert.ok(cookie.startsWith(`${SESSION_COOKIE_PLAIN}=${TOKEN};`));
  assert.ok(!cookie.includes('Secure'));
});

test('le cookie est lu, et seul le bon format est accepté', () => {
  assert.equal(readSessionToken(httpsReq(`autre=1; ${SESSION_COOKIE_SECURE}=${TOKEN}`)), TOKEN);
  assert.equal(readSessionToken(httpReq(`${SESSION_COOKIE_PLAIN}=${TOKEN}`)), TOKEN);
  assert.equal(readSessionToken(httpsReq('')), null);
  assert.equal(readSessionToken(httpsReq(`${SESSION_COOKIE_SECURE}=court`)), null);
  assert.equal(readSessionToken(httpsReq(`${SESSION_COOKIE_SECURE}=${'a'.repeat(200)}`)), null);
  assert.equal(readSessionToken(httpsReq(`${SESSION_COOKIE_SECURE}=${TOKEN}'; DROP TABLE users;--`)), null);
});

test('en https, le cookie au nom simple (posable par un sous-domaine) est ignoré', () => {
  assert.equal(readSessionToken(httpsReq(`${SESSION_COOKIE_PLAIN}=${TOKEN}`)), null);
});

test('la déconnexion efface le cookie', () => {
  assert.match(clearedSessionCookie(httpsReq()), /Max-Age=0/);
});

test('analyse d\'un en-tête Cookie et détection de https', () => {
  assert.deepEqual(parseCookies('a=1; b=2; =x; c'), { a: '1', b: '2' });
  assert.deepEqual(parseCookies(undefined), {});
  assert.equal(isSecureRequest({ headers: { 'x-forwarded-proto': 'https' } }), true);
  assert.equal(isSecureRequest({ headers: { 'x-forwarded-proto': 'http' } }), false);
  assert.equal(isSecureRequest({ headers: {} }), false);
});

// --- Adresses e-mail ---

test('normalisation des adresses e-mail', () => {
  assert.equal(normalizeEmail('  Jean.Dupont@Exemple.FR '), 'jean.dupont@exemple.fr');
  for (const bad of ['', 'abc', 'a@b', 'a b@c.fr', 'a@@c.fr', 'a@c..fr', '<x>@c.fr', null, undefined, 42, `${'a'.repeat(250)}@c.fr`]) {
    assert.equal(normalizeEmail(bad), null, String(bad));
  }
});
