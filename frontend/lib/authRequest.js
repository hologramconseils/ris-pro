// Outils communs aux requêtes d'authentification : adresse IP du visiteur, contrôle de l'origine, réponses JSON.

import { isIP } from 'node:net';

// Adresse IP du visiteur. Derrière Caddy, l'en-tête X-Forwarded-For est écrasé par Caddy (il n'a pas de proxy de
// confiance en amont) : sa première valeur est donc l'adresse réelle et ne peut pas être choisie par le visiteur.
export function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (isIP(forwarded)) return forwarded;
  const direct = req.socket?.remoteAddress;
  return direct && isIP(direct) ? direct : 'inconnue';
}

// Origine du site telle que configurée (jamais lue dans la requête : un en-tête Host falsifié ne doit pas
// pouvoir fabriquer un lien de réinitialisation pointant vers un autre site).
export function siteOrigin(env = process.env) {
  const raw = env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.hostname === 'localhost' ? url.origin : null;
  } catch {
    return null;
  }
}

export function allowedOrigins(env = process.env) {
  const extra = String(env.AUTH_EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  return [siteOrigin(env), ...extra].filter(Boolean);
}

// Protection contre les requêtes forgées depuis un autre site : une requête qui modifie quelque chose doit
// venir du site lui-même. Le navigateur envoie toujours l'en-tête Origin sur un POST ; à défaut, Sec-Fetch-Site.
export function isSameOriginRequest(req, env = process.env) {
  const origin = req.headers?.origin;
  if (origin) return allowedOrigins(env).includes(origin);
  const fetchSite = req.headers?.['sec-fetch-site'];
  return fetchSite === 'same-origin';
}

export function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
