import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  vertexBaseUrl, generateContentUrl, signedAssertion, toVertexSchema, responseText, generateJson, resetVertexCache,
} from '../lib/vertexAI.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNT = {
  client_email: 'ris-pro@projet-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  project_id: 'projet-test',
};
const keyFile = path.join(mkdtempSync(path.join(tmpdir(), 'vertex-')), 'sa.json');
writeFileSync(keyFile, JSON.stringify(ACCOUNT));
const ENV = { GOOGLE_SERVICE_ACCOUNT_FILE: keyFile };

beforeEach(() => resetVertexCache());

test('point d\'accès : multi-région UE ou région européenne uniquement', () => {
  assert.equal(vertexBaseUrl('eu'), 'https://aiplatform.eu.rep.googleapis.com');
  assert.equal(vertexBaseUrl('europe-west9'), 'https://europe-west9-aiplatform.googleapis.com');
  for (const refused of ['global', 'us', 'us-central1', 'europe-west9.evil.com', '', undefined]) {
    assert.throws(() => vertexBaseUrl(refused), /VERTEX_LOCATION refusée/, String(refused));
  }
  assert.equal(
    generateContentUrl({ project: 'projet-test', location: 'eu', model: 'gemini-3.5-flash' }),
    'https://aiplatform.eu.rep.googleapis.com/v1/projects/projet-test/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent'
  );
  assert.throws(() => generateContentUrl({ project: '../x', location: 'eu', model: 'm' }), /Projet/);
  assert.throws(() => generateContentUrl({ project: 'projet-test', location: 'eu', model: 'a/../b' }), /Modèle/);
});

test('assertion JWT signée RS256 et vérifiable avec la clé publique', () => {
  const jwt = signedAssertion(ACCOUNT, 1_800_000_000);
  const [header, claims, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const c = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(c.iss, ACCOUNT.client_email);
  assert.equal(c.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(c.scope, 'https://www.googleapis.com/auth/cloud-platform');
  assert.equal(c.exp - c.iat, 3600);
  assert.ok(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url')));
});

test('conversion du schéma : types en majuscules, sans additionalProperties, ordre conservé', () => {
  const converted = toVertexSchema({
    type: 'object',
    properties: {
      b: { type: 'string', description: 'B' },
      a: { type: 'array', items: { type: 'object', properties: { y: { type: 'integer' } }, additionalProperties: false, required: ['y'] } },
    },
    additionalProperties: false,
    required: ['b', 'a'],
  });
  assert.deepEqual(converted, {
    type: 'OBJECT',
    properties: {
      b: { type: 'STRING', description: 'B' },
      a: { type: 'ARRAY', items: { type: 'OBJECT', properties: { y: { type: 'INTEGER' } }, propertyOrdering: ['y'], required: ['y'] } },
    },
    propertyOrdering: ['b', 'a'],
    required: ['b', 'a'],
  });
});

test('texte de la réponse : pensées ignorées, réponse tronquée ou bloquée refusée', () => {
  const ok = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'réflexion', thought: true }, { text: '{"a":' }, { text: '1}' }] } }] };
  assert.equal(responseText(ok), '{"a":1}');
  assert.throws(() => responseText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"a"' }] } }] }), /incomplète \(MAX_TOKENS\)/);
  assert.throws(() => responseText({ promptFeedback: { blockReason: 'SAFETY' } }), /bloquée : SAFETY/);
});

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'jeton-123', expires_in: 3600 }), { status: 200 });
    }
    return responses.shift();
  };
  return { calls, impl };
}
const geminiOk = (obj) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

test('generateJson : jeton puis appel au point d\'accès européen, PDF transmis, JSON renvoyé', async () => {
  const { calls, impl } = fakeFetch([geminiOk({ ok: true })]);
  const result = await generateJson(
    { parts: [{ inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } }, { text: 'consigne' }], schema: { type: 'object', properties: { ok: { type: 'boolean' } } }, model: 'gemini-test' },
    { env: ENV, fetchImpl: impl }
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0].init.body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
  assert.equal(calls[1].url, 'https://aiplatform.eu.rep.googleapis.com/v1/projects/projet-test/locations/eu/publishers/google/models/gemini-test:generateContent');
  assert.equal(calls[1].init.headers.authorization, 'Bearer jeton-123');
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'application/pdf');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.responseSchema.type, 'OBJECT');
});

test('generateJson : le jeton est réutilisé d\'un appel à l\'autre', async () => {
  const { calls, impl } = fakeFetch([geminiOk({ n: 1 }), geminiOk({ n: 2 })]);
  await generateJson({ parts: [{ text: 'a' }], schema: { type: 'object' } }, { env: ENV, fetchImpl: impl });
  await generateJson({ parts: [{ text: 'b' }], schema: { type: 'object' } }, { env: ENV, fetchImpl: impl });
  assert.equal(calls.filter((c) => c.url.startsWith('https://oauth2')).length, 1);
});

test('generateJson : réessaie après une saturation (429), puis abandonne avec une erreur', async () => {
  const sleeps = [];
  const { impl } = fakeFetch([new Response('quota', { status: 429 }), geminiOk({ ok: 1 })]);
  assert.deepEqual(await generateJson({ parts: [{ text: 'a' }], schema: {} }, { env: ENV, fetchImpl: impl, sleep: async (ms) => sleeps.push(ms) }), { ok: 1 });
  assert.deepEqual(sleeps, [2000]);

  resetVertexCache();
  const { impl: failing } = fakeFetch([429, 429, 429].map((s) => new Response('quota', { status: s })));
  await assert.rejects(
    generateJson({ parts: [{ text: 'a' }], schema: {} }, { env: ENV, fetchImpl: failing, sleep: async () => {} }),
    /Erreur API Gemini \(429\)/
  );
});

test('generateJson : une erreur non passagère n\'est pas réessayée', async () => {
  let generateCalls = 0;
  const impl = async (url) => {
    if (url.startsWith('https://oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    generateCalls++;
    return new Response('{"error":{"message":"Permission denied"}}', { status: 403 });
  };
  await assert.rejects(generateJson({ parts: [{ text: 'a' }], schema: {} }, { env: ENV, fetchImpl: impl, sleep: async () => {} }), /\(403\)/);
  assert.equal(generateCalls, 1);
});

test('configuration : point d\'accès global refusé, fichier de clé obligatoire', async () => {
  await assert.rejects(generateJson({ parts: [], schema: {} }, { env: { ...ENV, VERTEX_LOCATION: 'global' }, fetchImpl: async () => { throw new Error('aucun appel'); } }), /VERTEX_LOCATION refusée/);
  resetVertexCache();
  await assert.rejects(generateJson({ parts: [], schema: {} }, { env: {}, fetchImpl: async () => { throw new Error('aucun appel'); } }), /GOOGLE_SERVICE_ACCOUNT_FILE absente/);
});
