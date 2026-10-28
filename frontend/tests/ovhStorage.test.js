import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  signRequest, encodeKey, toRef, isOvhRef, keyFromRef, putObject, getObject, deleteObject,
} from '../lib/ovhStorage.js';

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// Exemple « GET Object » avec en-tête Range de la documentation AWS Signature V4 : la signature
// attendue est publiée par AWS, ce qui valide le calcul sans dépendre d'un service réel.
test('signRequest reproduit la signature de référence AWS (GET Object)', () => {
  const { signature, headers } = signRequest({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    headers: { Range: 'bytes=0-9' },
    payloadHash: EMPTY_SHA256,
    region: 'us-east-1',
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    date: new Date('2013-05-24T00:00:00Z'),
  });
  assert.equal(signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.match(headers.authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,/);
  assert.equal(headers.host, undefined);
});

test('encodeKey conserve les / et encode les caractères réservés', () => {
  assert.equal(encodeKey('ris-pro/123_releve (1).pdf'), 'ris-pro/123_releve%20%281%29.pdf');
});

test('les références de stockage sont reconnues et décodées', () => {
  assert.equal(toRef('ris-pro/a.pdf'), 'ovh:ris-pro/a.pdf');
  assert.equal(isOvhRef('ovh:ris-pro/a.pdf'), true);
  assert.equal(isOvhRef('https://blob.example/a.pdf'), false);
  assert.equal(keyFromRef('ovh:ris-pro/a.pdf'), 'ris-pro/a.pdf');
  assert.throws(() => keyFromRef('https://blob.example/a.pdf'));
});

const realFetch = globalThis.fetch;
const savedEnv = { ...process.env };
let calls;

beforeEach(() => {
  calls = [];
  Object.assign(process.env, {
    OVH_S3_ENDPOINT: 'https://s3.gra.io.cloud.ovh.net',
    OVH_S3_REGION: 'gra',
    OVH_S3_BUCKET: 'ris-pro-releves',
    OVH_S3_ACCESS_KEY: 'AKEXAMPLE',
    OVH_S3_SECRET_KEY: 'secret-example',
  });
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

test('putObject envoie le PDF signé vers le conteneur', async () => {
  mockFetch(new Response(null, { status: 200 }));
  const body = Buffer.from('%PDF-1.4 test');
  await putObject('ris-pro/1_a.pdf', body);
  const { url, init } = calls[0];
  assert.equal(url, 'https://s3.gra.io.cloud.ovh.net/ris-pro-releves/ris-pro/1_a.pdf');
  assert.equal(init.method, 'PUT');
  assert.equal(init.body, body);
  assert.equal(init.headers['content-type'], 'application/pdf');
  assert.equal(init.headers['x-amz-content-sha256'], createHash('sha256').update(body).digest('hex'));
  assert.match(init.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKEXAMPLE\/\d{8}\/gra\/s3\/aws4_request,/);
});

test('getObject renvoie le contenu du fichier', async () => {
  mockFetch(new Response(Buffer.from('%PDF-1.4 contenu'), { status: 200 }));
  const data = await getObject('ris-pro/1_a.pdf');
  assert.equal(data.toString(), '%PDF-1.4 contenu');
  assert.equal(calls[0].init.method, 'GET');
});

test('deleteObject envoie une requête DELETE', async () => {
  mockFetch(new Response(null, { status: 204 }));
  await deleteObject('ris-pro/1_a.pdf');
  assert.equal(calls[0].init.method, 'DELETE');
});

test('une réponse d\'erreur lève une erreur portant le statut', async () => {
  mockFetch(new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }));
  await assert.rejects(() => putObject('ris-pro/x.pdf', Buffer.from('x')), (e) => e.status === 403 && /AccessDenied/.test(e.message));
});

test('une configuration incomplète est signalée clairement', async () => {
  delete process.env.OVH_S3_BUCKET;
  await assert.rejects(() => getObject('ris-pro/x.pdf'), /OVH_S3_\*/);
});
