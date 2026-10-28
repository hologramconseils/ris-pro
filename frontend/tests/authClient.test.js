import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirect, authApi } from '../src/authClient.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('safeRedirect n\'accepte que des chemins du site', () => {
  assert.equal(safeRedirect('/diagnostic?file=ovh%3Aa.pdf'), '/diagnostic?file=ovh%3Aa.pdf');
  assert.equal(safeRedirect('/'), '/');
  for (const bad of ['https://pirate.example.net', '//pirate.example.net', '/\\pirate.example.net', 'javascript:alert(1)', '', null, undefined, 42]) {
    assert.equal(safeRedirect(bad), '/', String(bad));
  }
  assert.equal(safeRedirect('//x', '/login'), '/login');
});

test('authApi envoie le cookie, du JSON, et renvoie le message d\'erreur du serveur', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ error: 'Adresse e-mail ou mot de passe incorrect.' }), { status: 401 });
  };
  const result = await authApi.login('a@example.org', 'x');
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.error, 'Adresse e-mail ou mot de passe incorrect.');
  assert.equal(calls[0].url, '/api/auth?action=login');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'a@example.org', password: 'x' });
});

test('authApi.me utilise GET sans corps ; une panne réseau donne un message, sans exception', async () => {
  let init;
  globalThis.fetch = async (_url, i) => { init = i; return new Response(JSON.stringify({ user: null }), { status: 200 }); };
  const me = await authApi.me();
  assert.equal(init.method, 'GET');
  assert.equal(init.body, undefined);
  assert.equal(me.ok, true);

  globalThis.fetch = async () => { throw new Error('réseau'); };
  const down = await authApi.register('a@example.org');
  assert.equal(down.ok, false);
  assert.match(down.error, /momentanément indisponible/);
});
