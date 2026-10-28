import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, isMailConfigured } from '../lib/mailer.js';

const realFetch = globalThis.fetch;
const savedEnv = { ...process.env };
let calls;

beforeEach(() => {
  calls = [];
  delete process.env.MAIL_FROM_EMAIL;
  delete process.env.MAIL_FROM_NAME;
  delete process.env.MAIL_REPLY_TO;
  process.env.BREVO_API_KEY = 'cle-de-test';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
  Object.assign(process.env, savedEnv);
});

function mockFetch(response) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
}

test('sendEmail envoie la requête attendue à Brevo', async () => {
  mockFetch(new Response('{"messageId":"<1@brevo>"}', { status: 201 }));
  const result = await sendEmail({ to: 'client@example.org', subject: 'Sujet', html: '<p>Bonjour</p>' });

  assert.deepEqual(result, { error: null });
  const { url, init } = calls[0];
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['api-key'], 'cle-de-test');
  const body = JSON.parse(init.body);
  assert.deepEqual(body.sender, { name: 'RIS Pro', email: 'ris@ris.hologramconseils.com' });
  assert.deepEqual(body.replyTo, { email: 'bertrand.saulnerond@hologramconseils.com' });
  assert.deepEqual(body.to, [{ email: 'client@example.org' }]);
  assert.equal(body.subject, 'Sujet');
  assert.equal(body.htmlContent, '<p>Bonjour</p>');
});

test('sendEmail accepte une liste de destinataires et un expéditeur personnalisé', async () => {
  process.env.MAIL_FROM_EMAIL = 'contact@exemple.fr';
  process.env.MAIL_FROM_NAME = 'Autre nom';
  process.env.MAIL_REPLY_TO = 'support@exemple.fr';
  mockFetch(new Response('{}', { status: 201 }));
  await sendEmail({ to: ['a@example.org', 'b@example.org'], subject: 's', html: 'h' });

  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.to, [{ email: 'a@example.org' }, { email: 'b@example.org' }]);
  assert.deepEqual(body.sender, { name: 'Autre nom', email: 'contact@exemple.fr' });
  assert.deepEqual(body.replyTo, { email: 'support@exemple.fr' });
});

test('sendEmail renvoie une erreur (sans lever d\'exception) quand Brevo refuse', async () => {
  mockFetch(new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 }));
  const { error } = await sendEmail({ to: 'client@example.org', subject: 's', html: 'h' });
  assert.equal(error.name, 'HTTP 401');
  assert.match(error.message, /Key not found/);
});

test('sendEmail renvoie une erreur quand le réseau échoue', async () => {
  globalThis.fetch = async () => { throw new Error('connexion impossible'); };
  const { error } = await sendEmail({ to: 'client@example.org', subject: 's', html: 'h' });
  assert.match(error.message, /connexion impossible/);
});

test('sans clé Brevo, rien n\'est envoyé et l\'erreur le dit', async () => {
  delete process.env.BREVO_API_KEY;
  mockFetch(new Response('{}', { status: 201 }));
  assert.equal(isMailConfigured(), false);
  const { error } = await sendEmail({ to: 'client@example.org', subject: 's', html: 'h' });
  assert.equal(error.name, 'NotConfigured');
  assert.equal(calls.length, 0);
});

test('sans destinataire, rien n\'est envoyé', async () => {
  mockFetch(new Response('{}', { status: 201 }));
  const { error } = await sendEmail({ to: undefined, subject: 's', html: 'h' });
  assert.equal(error.name, 'NoRecipient');
  assert.equal(calls.length, 0);
});
