// Stockage des relevés PDF sur OVHcloud Object Storage (API compatible S3, région Gravelines).
// Remplace Vercel Blob (États-Unis) : les fichiers restent chez un hébergeur européen.
// Implémentation volontairement sans dépendance : signature AWS Signature V4 avec `crypto`, appels
// HTTP avec `fetch`. Les quatre opérations utilisées (écrire, lire, supprimer) tiennent en peu de code.
//
// Variables d'environnement : OVH_S3_ENDPOINT (ex. https://s3.gra.io.cloud.ovh.net), OVH_S3_REGION
// (ex. gra), OVH_S3_BUCKET, OVH_S3_ACCESS_KEY, OVH_S3_SECRET_KEY.
//
// Dans la colonne analyses.file_path, un fichier stocké ici est référencé par « ovh:<clé> » : le site
// traite cette valeur comme un identifiant opaque. Les anciens relevés (adresse https de Vercel Blob)
// gardent leur valeur d'origine et leur copie en base (file_base64) jusqu'à leur suppression à 6 mois.

import { createHash, createHmac } from 'node:crypto';

const REF_PREFIX = 'ovh:';

export function toRef(key) {
  return `${REF_PREFIX}${key}`;
}

export function isOvhRef(value) {
  return typeof value === 'string' && value.startsWith(REF_PREFIX);
}

export function keyFromRef(ref) {
  if (!isOvhRef(ref)) throw new Error('Référence de stockage invalide');
  return ref.slice(REF_PREFIX.length);
}

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

// Encodage d'un segment de chemin comme l'exige la signature S3 (RFC 3986, « / » conservé).
export function encodeKey(key) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

// Calcule les en-têtes à ajouter à une requête pour la signer (AWS Signature V4, service « s3 »).
// `headers` : en-têtes propres à la requête (content-type, range...) qui seront signés aussi.
export function signRequest({ method, host, path, query = '', headers = {}, payloadHash, region, accessKey, secretKey, date = new Date() }) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const signed = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  for (const [name, value] of Object.entries(headers)) {
    signed[name.toLowerCase()] = String(value).trim().replace(/\s+/g, ' ');
  }
  const names = Object.keys(signed).sort();
  const canonicalHeaders = names.map((n) => `${n}:${signed[n]}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const out = { ...signed };
  delete out.host; // fetch renseigne lui-même l'en-tête Host
  out.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: out, signature };
}

function getConfig() {
  const { OVH_S3_ENDPOINT, OVH_S3_REGION, OVH_S3_BUCKET, OVH_S3_ACCESS_KEY, OVH_S3_SECRET_KEY } = process.env;
  if (!OVH_S3_ENDPOINT || !OVH_S3_REGION || !OVH_S3_BUCKET || !OVH_S3_ACCESS_KEY || !OVH_S3_SECRET_KEY) {
    throw new Error('Stockage OVH non configuré (variables OVH_S3_* manquantes)');
  }
  const url = new URL(OVH_S3_ENDPOINT);
  return {
    host: url.host,
    origin: url.origin,
    region: OVH_S3_REGION,
    bucket: OVH_S3_BUCKET,
    accessKey: OVH_S3_ACCESS_KEY,
    secretKey: OVH_S3_SECRET_KEY,
  };
}

async function request(method, key, { body, contentType } = {}) {
  const cfg = getConfig();
  const path = `/${cfg.bucket}/${encodeKey(key)}`;
  const payload = body ?? '';
  const { headers } = signRequest({
    method,
    host: cfg.host,
    path,
    headers: contentType ? { 'content-type': contentType } : {},
    payloadHash: sha256Hex(payload),
    region: cfg.region,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
  });
  const response = await fetch(`${cfg.origin}${path}`, { method, headers, body });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    const error = new Error(`Stockage OVH : ${method} ${response.status} ${detail}`.trim());
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function putObject(key, buffer, contentType = 'application/pdf') {
  await request('PUT', key, { body: buffer, contentType });
}

export async function getObject(key) {
  const response = await request('GET', key);
  return Buffer.from(await response.arrayBuffer());
}

// S3 répond 204 même si l'objet n'existe plus : une suppression répétée n'est donc pas une erreur.
export async function deleteObject(key) {
  await request('DELETE', key);
}
