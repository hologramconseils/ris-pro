import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runKeepalive } from '../../server/mail-keepalive.mjs';

const now = new Date('2026-11-01T09:00:00Z');

test('le contrôle envoie un message daté à l\'adresse de l\'administrateur', async () => {
  const sent = [];
  const result = await runKeepalive({
    configured: () => true,
    env: { MAIL_REPLY_TO: 'admin@example.org' },
    now,
    send: async (message) => { sent.push(message); return { error: null }; },
  });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'admin@example.org');
  assert.match(sent[0].subject, /2026-11-01/);
});

test('sans variable, le message part vers l\'adresse par défaut', async () => {
  let to;
  await runKeepalive({ configured: () => true, env: {}, now, send: async (m) => { to = m.to; return { error: null }; } });
  assert.equal(to, 'bertrand.saulnerond@hologramconseils.com');
});

test('un refus de Brevo est signalé comme un échec', async () => {
  const result = await runKeepalive({
    configured: () => true, env: {}, now,
    send: async () => ({ error: { name: 'HTTP 401', message: 'Key not found' } }),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /HTTP 401/);
});

test('sans clé Brevo, le contrôle échoue sans rien envoyer', async () => {
  let called = false;
  const result = await runKeepalive({ configured: () => false, env: {}, now, send: async () => { called = true; return { error: null }; } });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});
