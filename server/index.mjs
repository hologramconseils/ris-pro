// Serveur Node de RIS Pro (remplace Vercel) : sert le site compilé (frontend/dist) et lance les
// fonctions de frontend/api/*.js sur /api/<nom>. Écoute uniquement sur 127.0.0.1 : Caddy (cf.
// server/Caddyfile) gère le HTTPS et transmet les requêtes ici.
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { adaptRequest, adaptResponse, readBody } from './adapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const API = path.join(ROOT, 'frontend', 'api');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
};

// Les en-têtes de sécurité viennent de vercel.json (une seule source de vérité) : ils sont
// appliqués aussi par ce serveur.
async function loadSecurityHeaders() {
  const config = JSON.parse(await fs.readFile(path.join(ROOT, 'vercel.json'), 'utf8'));
  const headers = {};
  for (const route of config.routes || []) {
    if (route.headers) Object.assign(headers, route.headers);
  }
  return headers;
}

const securityHeaders = await loadSecurityHeaders();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, url, name) {
  const file = path.join(API, `${name}.js`);
  let mod;
  try {
    await fs.access(file);
    mod = await import(pathToFileURL(file).href);
  } catch {
    return sendJson(res, 404, { error: 'Introuvable' });
  }
  const handler = mod.default;
  if (typeof handler !== 'function') return sendJson(res, 500, { error: 'Fonction invalide' });

  adaptResponse(res);
  const rawBodyWanted = mod.config?.api?.bodyParser !== false;
  try {
    const raw = rawBodyWanted ? await readBody(req) : null;
    adaptRequest(req, url, raw);
  } catch {
    return sendJson(res, 400, { error: 'Corps de requête invalide' });
  }
  return handler(req, res);
}

async function serveStatic(res, pathname) {
  const requested = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  if (!requested.startsWith(DIST)) return false;
  try {
    const stat = await fs.stat(requested);
    if (!stat.isFile()) return false;
    const ext = path.extname(requested).toLowerCase();
    // Les fichiers de build portent un hash dans leur nom : on peut les garder longtemps.
    const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    createReadStream(requested).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      const name = pathname.slice('/api/'.length);
      if (!/^[a-z0-9-]+$/.test(name)) return sendJson(res, 404, { error: 'Introuvable' });
      return await handleApi(req, res, url, name);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Méthode non autorisée' });
    if (await serveStatic(res, pathname)) return;

    // Page inconnue : on renvoie l'application (routage côté navigateur), comme vercel.json.
    const index = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    createReadStream(index).pipe(res);
  } catch (error) {
    console.error('[Serveur] Erreur :', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erreur interne' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`RIS Pro à l'écoute sur ${HOST}:${PORT}`);
});
