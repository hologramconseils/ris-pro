// Appels à Gemini via Vertex AI (Google Cloud), sur un point d'accès européen : lecture des relevés PDF et
// rédaction du bilan premium. Remplace Mistral.
// Implémentation sans dépendance : authentification par compte de service (jeton OAuth obtenu avec une
// assertion JWT signée par `crypto`), appels HTTP avec `fetch`.
//
// Variables d'environnement :
// - GOOGLE_SERVICE_ACCOUNT_FILE : chemin du fichier de clé JSON du compte de service (rôle « Vertex AI User ») ;
// - VERTEX_LOCATION : « eu » (par défaut : multi-région Union européenne) ou une région « europe-… » ;
//   le point d'accès « global » est refusé, car il ne garantit pas que le traitement reste en Europe ;
// - GOOGLE_CLOUD_PROJECT : facultatif, sinon celui du fichier de clé ;
// - GEMINI_EXTRACT_MODEL, GEMINI_WRITER_MODEL : modèles utilisés (cf. DEFAULT_MODEL).

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const DEFAULT_MODEL = 'gemini-3.5-flash';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const RETRY_DELAYS_MS = [2000, 6000];
const RETRYABLE_STATUS = [429, 500, 503];

// --- Point d'accès ---

export function vertexBaseUrl(location) {
  if (location === 'eu') return 'https://aiplatform.eu.rep.googleapis.com';
  if (/^europe-[a-z]+[0-9]+$/.test(location)) return `https://${location}-aiplatform.googleapis.com`;
  throw new Error(`VERTEX_LOCATION refusée (${location}) : seuls « eu » ou une région « europe-… » garantissent un traitement en Europe.`);
}

export function generateContentUrl({ project, location, model }) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project || '')) throw new Error('Projet Google Cloud invalide ou absent.');
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(model || '')) throw new Error('Modèle Gemini invalide.');
  return `${vertexBaseUrl(location)}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

// --- Authentification (compte de service) ---

const base64url = (value) => Buffer.from(value).toString('base64url');

export function signedAssertion({ client_email, private_key }, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(private_key).toString('base64url');
  return `${header}.${claims}.${signature}`;
}

let cachedAccount = null;
function serviceAccount(env) {
  if (cachedAccount) return cachedAccount;
  const file = env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (!file) throw new Error('GOOGLE_SERVICE_ACCOUNT_FILE absente : Vertex AI non configuré.');
  const account = JSON.parse(readFileSync(file, 'utf8'));
  if (!account.client_email || !account.private_key) throw new Error('Fichier de compte de service incomplet.');
  cachedAccount = account;
  return account;
}

// Jeton d'accès conservé jusqu'à 5 minutes avant son expiration.
let cachedToken = null;
async function accessToken(account, fetchImpl, now) {
  if (cachedToken && cachedToken.account === account.client_email && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.value;
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedAssertion(account, Math.floor(now / 1000)),
    }).toString(),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`Authentification Google refusée (${response.status}) : ${detail}`);
  }
  const data = await response.json();
  cachedToken = { account: account.client_email, value: data.access_token, expiresAt: now + (data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

// --- Format de réponse imposé ---

// Les schémas de l'application sont écrits en JSON Schema ; Vertex attend son propre format (types en
// majuscules, pas d'additionalProperties). L'ordre des propriétés est conservé (propertyOrdering).
export function toVertexSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toVertexSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && typeof value === 'string') out.type = value.toUpperCase();
    else if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value).map(([name, sub]) => [name, toVertexSchema(sub)]));
      out.propertyOrdering = Object.keys(value);
    } else if (key === 'items') out.items = toVertexSchema(value);
    else out[key] = value;
  }
  return out;
}

// Texte de la réponse (hors « pensées » du modèle). Une réponse interrompue (limite de longueur, filtre)
// donnerait un JSON tronqué : elle est refusée explicitement.
export function responseText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(`Réponse Gemini vide${reason ? ` (bloquée : ${reason})` : ''}.`);
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Réponse Gemini incomplète (${candidate.finishReason}).`);
  }
  return (candidate.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Envoie `parts` (texte, PDF…) et renvoie l'objet JSON conforme à `schema`.
// Réessaie deux fois sur une saturation passagère (429, 500, 503).
export async function generateJson({ parts, schema, model, maxOutputTokens = 32768 }, {
  env = process.env, fetchImpl = fetch, now = Date.now, sleep = wait,
} = {}) {
  const account = serviceAccount(env);
  const url = generateContentUrl({
    project: env.GOOGLE_CLOUD_PROJECT || account.project_id,
    location: env.VERTEX_LOCATION || 'eu',
    model: model || DEFAULT_MODEL,
  });
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: toVertexSchema(schema), maxOutputTokens },
  });

  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(account, fetchImpl, now());
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body,
    });
    if (response.ok) return JSON.parse(responseText(await response.json()));
    if (RETRYABLE_STATUS.includes(response.status) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Erreur API Gemini (${response.status}): ${detail}`);
  }
}

// Pour les tests : oublie le compte et le jeton mémorisés.
export function resetVertexCache() {
  cachedAccount = null;
  cachedToken = null;
}
