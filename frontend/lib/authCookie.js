// Cookie de session. Valeur : jeton aléatoire (cf. authTokens.js), jamais lisible par le JavaScript de la page
// (HttpOnly) ni envoyé en clair (Secure). SameSite=Lax : le cookie n'accompagne pas les requêtes envoyées par
// un autre site (protection contre les requêtes forgées), tout en restant envoyé quand on arrive depuis un lien
// (retour de Stripe, lien reçu par e-mail). Le préfixe « __Host- » interdit à un sous-domaine de le remplacer.

export const SESSION_COOKIE_SECURE = '__Host-ris_session';
export const SESSION_COOKIE_PLAIN = 'ris_session'; // développement local en http uniquement
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function isSecureRequest(req) {
  return String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !(name in cookies)) cookies[name] = value;
  }
  return cookies;
}

// Jeton de session présenté par la requête (ou null).
export function readSessionToken(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[SESSION_COOKIE_SECURE] || (isSecureRequest(req) ? null : cookies[SESSION_COOKIE_PLAIN]);
  return token && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
}

export function sessionCookie(req, token, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const secure = isSecureRequest(req);
  const name = secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN;
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie(req) {
  return sessionCookie(req, '', 0);
}
