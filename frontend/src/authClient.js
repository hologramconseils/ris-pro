// Appels au serveur d'authentification (/api/auth). Le navigateur envoie lui-même le cookie de session
// (HttpOnly : le code de la page ne voit jamais le jeton).

async function call(action, { method = 'POST', body } = {}) {
  let response;
  try {
    response = await fetch(`/api/auth?action=${action}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: 'Le service est momentanément indisponible. Merci de réessayer.' };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data, error: response.ok ? null : data.error || 'Une erreur est survenue. Merci de réessayer.' };
}

export const authApi = {
  me: () => call('me', { method: 'GET' }),
  register: (email) => call('register', { body: { email } }),
  activate: (token, password) => call('activate', { body: { token, password } }),
  login: (email, password) => call('login', { body: { email, password } }),
  logout: () => call('logout'),
  forgot: (email) => call('forgot', { body: { email } }),
  reset: (token, password) => call('reset', { body: { token, password } }),
  magic: (token) => call('magic', { body: { token } }),
};

// Redirection après connexion : uniquement un chemin du site (jamais une adresse extérieure).
export function safeRedirect(value, fallback = '/') {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback;
}
