import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { adaptRequest, adaptResponse, readBody } from '../../server/adapter.mjs';

function fakeRequest(headers = {}) {
  return Object.assign(Readable.from([]), { headers });
}

test('adaptRequest : lit le corps JSON et les paramètres de l\'URL', () => {
  const req = fakeRequest({ 'content-type': 'application/json' });
  const raw = Buffer.from('{"filePath":"https://blob.example/a.pdf"}');
  adaptRequest(req, new URL('http://x/api/analyze?foo=bar'), raw);
  assert.deepEqual(req.body, { filePath: 'https://blob.example/a.pdf' });
  assert.deepEqual(req.query, { foo: 'bar' });
});

test('adaptRequest : corps absent => objet vide (comme Vercel)', () => {
  const req = fakeRequest({});
  adaptRequest(req, new URL('http://x/api/get-analysis'), null);
  assert.deepEqual(req.body, {});
});

test('adaptRequest : JSON invalide => erreur (le serveur répond 400)', () => {
  const req = fakeRequest({ 'content-type': 'application/json' });
  assert.throws(() => adaptRequest(req, new URL('http://x/api/analyze'), Buffer.from('{pas du json')));
});

test('adaptResponse : status().json() renvoie le code et le JSON', async () => {
  const chunks = [];
  const fakeRes = {
    headers: {},
    headersSent: false,
    statusCode: 200,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    end(body) { chunks.push(body); this.headersSent = true; },
  };
  adaptResponse(fakeRes);
  fakeRes.status(401).json({ error: 'Non autorisé' });
  assert.equal(fakeRes.statusCode, 401);
  assert.equal(chunks[0], '{"error":"Non autorisé"}');
  assert.match(fakeRes.headers['content-type'], /application\/json/);
});

test('readBody : lit le flux complet en Buffer', async () => {
  const req = Readable.from([Buffer.from('abc'), Buffer.from('def')]);
  assert.equal((await readBody(req)).toString(), 'abcdef');
});
