import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseClerkExport, importClerkUsers } from '../lib/clerkImport.js';

const CSV = '﻿id,first_name,last_name,primary_email_address,created_at\r\n' +
  'user_2abc,"Dupont, Jean",X,Jean.Dupont@Example.org,2025-01-01\r\n' +
  'user_3def,Marie,"Duran\nd",marie@example.org,2025-02-02\r\n' +
  'pas_un_id,A,B,a@example.org,2025\r\n' +
  'user_4ghi,A,B,adresse-invalide,2025\r\n' +
  'user_5jkl,A,B,marie@example.org,2025\r\n';

test('parseCsv gère les guillemets, les virgules et les retours à la ligne dans un champ', () => {
  const rows = parseCsv('a,b\n"x,1","y ""z"""\n"l1\nl2",3');
  assert.deepEqual(rows, [['a', 'b'], ['x,1', 'y "z"'], ['l1\nl2', '3']]);
});

test('parseClerkExport garde les comptes valables et signale les autres', () => {
  const { users, skipped } = parseClerkExport(CSV);
  assert.deepEqual(users, [{ id: 'user_2abc', email: 'jean.dupont@example.org' }, { id: 'user_3def', email: 'marie@example.org' }]);
  assert.equal(skipped.length, 3);
  assert.throws(() => parseClerkExport('a,b\n1,2'), /Colonnes/);
});

function fakeStore(initial = []) {
  const users = [...initial];
  return {
    users,
    findUserByEmail: async (_d, email) => users.find((u) => u.email === email) || null,
    findUserById: async (_d, id) => users.find((u) => u.id === id) || null,
    createUser: async (_d, u) => { users.push(u); return u; },
  };
}

test('import : simulation sans écriture, puis création avec adresse vérifiée et sans mot de passe', async () => {
  const list = [{ id: 'user_1', email: 'a@example.org' }];
  const dry = fakeStore();
  assert.deepEqual((await importClerkUsers({ db: {}, store: dry, users: list })).created, ['a@example.org']);
  assert.equal(dry.users.length, 0);

  const real = fakeStore();
  await importClerkUsers({ db: {}, store: real, users: list, apply: true });
  assert.deepEqual(real.users, [{ id: 'user_1', email: 'a@example.org', emailVerified: true }]);
});

test('import : relancer ne crée rien de plus ; un conflit n\'est jamais écrasé', async () => {
  const store = fakeStore([{ id: 'user_1', email: 'a@example.org' }, { id: 'usr_9', email: 'b@example.org' }]);
  const result = await importClerkUsers({
    db: {}, store, apply: true,
    users: [{ id: 'user_1', email: 'a@example.org' }, { id: 'user_2', email: 'b@example.org' }],
  });
  assert.deepEqual(result.existing, ['a@example.org']);
  assert.deepEqual(result.conflicts, ['b@example.org (user_2)']);
  assert.equal(store.users.length, 2);
});
