import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePaymentAccount, createPaymentLoginLink } from '../lib/paymentAccount.js';
import { paymentConfirmationEmail, magicLoginEmailLink } from '../lib/authEmails.js';

function fakes() {
  const users = [];
  const tokens = [];
  const queries = [];
  return {
    users, tokens, queries,
    db: { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; } },
    store: {
      findUserByEmail: async (_db, email) => users.find((u) => u.email === email) || null,
      createUser: async (_db, { email }) => {
        if (users.some((u) => u.email === email)) return null;
        const user = { id: `usr_${users.length + 1}`, email };
        users.push(user);
        return user;
      },
      createAuthToken: async (_db, userId, purpose) => { tokens.push({ userId, purpose }); return 'TOKEN123'; },
    },
  };
}

test('acheteur sans compte : compte créé sans mot de passe, profil à 0 crédit', async () => {
  const f = fakes();
  const result = await resolvePaymentAccount({ db: f.db, store: f.store, clientUserId: null, email: ' Payeur@Example.org ' });
  assert.deepEqual(result, { userId: 'usr_1', isNewUser: true });
  assert.equal(f.users[0].email, 'payeur@example.org');
  assert.match(f.queries[0].sql, /INSERT INTO profiles/);
  assert.deepEqual(f.queries[0].params, ['usr_1']);
});

test('acheteur dont l\'adresse a déjà un compte : ce compte est réutilisé', async () => {
  const f = fakes();
  f.users.push({ id: 'user_abc', email: 'client@example.org' });
  const result = await resolvePaymentAccount({ db: f.db, store: f.store, clientUserId: null, email: 'CLIENT@example.org' });
  assert.deepEqual(result, { userId: 'user_abc', isNewUser: false });
  assert.equal(f.users.length, 1);
});

test('acheteur connecté : l\'identifiant du paiement est utilisé, sans toucher aux comptes', async () => {
  const f = fakes();
  const result = await resolvePaymentAccount({ db: f.db, store: f.store, clientUserId: 'usr_9', email: 'autre@example.org' });
  assert.deepEqual(result, { userId: 'usr_9', isNewUser: false });
  assert.equal(f.users.length, 0);
});

test('adresse invalide : aucun compte', async () => {
  const f = fakes();
  assert.deepEqual(await resolvePaymentAccount({ db: f.db, store: f.store, clientUserId: null, email: 'n importe quoi' }), { userId: null, isNewUser: false });
  assert.equal(f.queries.length, 0);
});

test('création simultanée : le compte créé par l\'autre traitement est retrouvé', async () => {
  const f = fakes();
  let calls = 0;
  f.store.findUserByEmail = async () => (++calls === 1 ? null : { id: 'usr_race', email: 'a@example.org' });
  f.store.createUser = async () => null;
  const result = await resolvePaymentAccount({ db: f.db, store: f.store, clientUserId: null, email: 'a@example.org' });
  assert.deepEqual(result, { userId: 'usr_race', isNewUser: false });
});

test('lien de connexion : jeton « magic_login » et redirection vers le bilan payé', async () => {
  const f = fakes();
  const link = await createPaymentLoginLink({ db: f.db, store: f.store, userId: 'usr_1', origin: 'https://ris.example.org', filePath: 'ovh:ris-pro/1 a.pdf' });
  assert.deepEqual(f.tokens, [{ userId: 'usr_1', purpose: 'magic_login' }]);
  const url = new URL(link);
  assert.equal(url.origin + url.pathname, 'https://ris.example.org/connexion-lien');
  assert.equal(url.searchParams.get('token'), 'TOKEN123');
  assert.equal(url.searchParams.get('redirect'), '/bilan?success=true&file=ovh%3Aris-pro%2F1%20a.pdf');
});

test('sans adresse de site configurée, aucun lien ni jeton n\'est créé', async () => {
  const f = fakes();
  assert.equal(await createPaymentLoginLink({ db: f.db, store: f.store, userId: 'usr_1', origin: null, filePath: 'x' }), null);
  assert.equal(f.tokens.length, 0);
});

test('e-mail de paiement : avec lien, sans lien, nouveau compte ou non', () => {
  const link = magicLoginEmailLink('https://ris.example.org', 'T', '/bilan');
  assert.equal(link, 'https://ris.example.org/connexion-lien?token=T&redirect=%2Fbilan');
  const withLink = paymentConfirmationEmail({ link, isNewUser: true, siteUrl: 'https://ris.example.org' });
  assert.ok(withLink.html.includes(`href="${link}"`));
  assert.match(withLink.html, /Un compte a été créé/);
  assert.match(paymentConfirmationEmail({ link, isNewUser: false, siteUrl: '' }).html, /mot de passe habituel/);
  const without = paymentConfirmationEmail({ link: null, isNewUser: true, siteUrl: 'https://ris.example.org' });
  assert.ok(without.html.includes('https://ris.example.org/login?forgot=true'));
  assert.equal(without.html.includes('connexion-lien'), false);
});
