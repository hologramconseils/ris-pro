// Points d'accès d'authentification (remplace Clerk) : inscription, activation, connexion, déconnexion,
// utilisateur courant, mot de passe oublié, réinitialisation, connexion par lien (après un paiement).
// La fabrique reçoit ses dépendances (base, e-mails, limitation, mots de passe) : le comportement se teste
// sans réseau ni base. api/auth.js l'assemble avec les vraies dépendances.
//
// Principes de sécurité :
// - L'inscription ne demande QUE l'adresse : le mot de passe est choisi via le lien reçu par e-mail, donc seul le
//   propriétaire de la boîte peut le définir (pas de « pré-détournement » d'un compte par un tiers).
// - Mêmes réponses que le compte existe ou non (inscription, mot de passe oublié, connexion) ; les e-mails partent
//   en tâche de fond pour que la durée de la réponse ne révèle rien ; empreinte factice quand l'adresse est inconnue.
// - Limitation des essais par adresse IP et par adresse e-mail, qui refuse en cas de panne de la base.
// - Contrôle de l'origine sur toute requête qui modifie quelque chose ; réponses jamais mises en cache.
// - Un jeton ne sert qu'une fois ; un changement de mot de passe ferme toutes les sessions.

import { clientIp, siteOrigin, isSameOriginRequest, sendJson } from './authRequest.js';
import { readSessionToken, sessionCookie, clearedSessionCookie } from './authCookie.js';
import { normalizeEmail } from './authStore.js';
import { validatePassword, PASSWORD_MAX_LENGTH } from './passwords.js';
import { activationEmail, resetEmail, alreadyRegisteredEmail } from './authEmails.js';
import { maskEmail } from './security.js';

export const AUTH_LIMITS = {
  login_ip: { max: 30, windowMinutes: 15 },
  login_email: { max: 10, windowMinutes: 15 },
  register_ip: { max: 10, windowMinutes: 60 },
  register_email: { max: 3, windowMinutes: 60 },
  forgot_ip: { max: 10, windowMinutes: 60 },
  forgot_email: { max: 3, windowMinutes: 60 },
  token_ip: { max: 30, windowMinutes: 60 },
};

const MSG = {
  invalid: 'Requête invalide.',
  badEmail: 'Adresse e-mail invalide.',
  badCredentials: 'Adresse e-mail ou mot de passe incorrect.',
  tooMany: 'Trop de tentatives. Merci de réessayer dans quelques minutes.',
  badLink: 'Ce lien n\'est plus valable. Demandez-en un nouveau.',
  forbidden: 'Requête refusée.',
  failure: 'Une erreur est survenue. Merci de réessayer.',
  registerSent: 'Si cette adresse peut être utilisée, un e-mail vient de vous être envoyé. Cliquez sur le lien qu\'il contient pour activer votre compte.',
  forgotSent: 'Si un compte existe avec cette adresse, un e-mail vient de vous être envoyé pour choisir un nouveau mot de passe.',
};

const text = (value, max) => (typeof value === 'string' && value.length <= max ? value : null);

export function createAuthHandler({ getDb, store, passwords, sendEmail, rateLimit, background = (promise) => { promise.catch(() => {}); }, env = process.env, log = console }) {
  // Envoie un e-mail sans faire attendre la réponse, et sans jamais faire échouer la requête.
  const mail = (to, { subject, html }) => background(
    Promise.resolve(sendEmail({ to, subject, html })).then(({ error } = {}) => {
      if (error) log.error(`[Auth] E-mail non envoyé à ${maskEmail(to)} : ${error.name} ${error.message}`);
    }).catch((e) => log.error(`[Auth] E-mail non envoyé à ${maskEmail(to)} : ${e.message}`))
  );

  // Vrai si la requête est autorisée par la limitation (par adresse IP, et par adresse e-mail le cas échéant).
  const allowed = async (db, req, kind, email) => {
    if (!(await rateLimit(db, `ip:${clientIp(req)}`, `auth_${kind}_ip`, AUTH_LIMITS[`${kind}_ip`]))) return false;
    if (email && AUTH_LIMITS[`${kind}_email`] && !(await rateLimit(db, `email:${email}`, `auth_${kind}_email`, AUTH_LIMITS[`${kind}_email`]))) return false;
    return true;
  };

  const startSession = async (db, req, res, userId) => {
    const token = await store.createSession(db, userId, { userAgent: req.headers?.['user-agent'] });
    await store.recordLogin(db, userId);
    res.setHeader('Set-Cookie', sessionCookie(req, token));
  };

  const actions = {
    // Utilisateur de la session en cours (ou null). Réponse 200 dans les deux cas : pas d'erreur dans la console du navigateur.
    me: { method: 'GET', run: async ({ db, req, res }) => {
      const user = await store.getSessionUser(db, readSessionToken(req));
      return sendJson(res, 200, { user });
    } },

    register: { method: 'POST', run: async ({ db, req, res, body, origin }) => {
      const email = normalizeEmail(body.email);
      if (!email) return sendJson(res, 400, { error: MSG.badEmail });
      if (!(await allowed(db, req, 'register', email))) return sendJson(res, 429, { error: MSG.tooMany });

      const created = await store.createUser(db, { email });
      const existing = created ? null : await store.findUserByEmail(db, email);
      const target = created || existing;
      if (target && !target.password_hash && !target.email_verified_at) {
        // Nouveau compte, ou compte jamais activé (créé par un paiement par exemple) : lien d'activation.
        mail(email, activationEmail(origin, await store.createAuthToken(db, target.id, 'verify_email')));
      } else if (target) {
        mail(email, alreadyRegisteredEmail(origin));
      }
      return sendJson(res, 200, { ok: true, message: MSG.registerSent });
    } },

    // Choix du mot de passe depuis le lien d'activation, ou de réinitialisation : même traitement.
    activate: { method: 'POST', purpose: 'verify_email', run: (ctx) => setPasswordFromToken(ctx, 'verify_email') },
    reset: { method: 'POST', purpose: 'reset_password', run: (ctx) => setPasswordFromToken(ctx, 'reset_password') },

    login: { method: 'POST', run: async ({ db, req, res, body }) => {
      const email = normalizeEmail(body.email);
      const password = text(body.password, PASSWORD_MAX_LENGTH);
      if (!email || password === null) return sendJson(res, 400, { error: MSG.badCredentials });
      if (!(await allowed(db, req, 'login', email))) return sendJson(res, 429, { error: MSG.tooMany });

      const user = await store.findUserByEmail(db, email);
      // Vérifié même quand le compte n'existe pas, pour que la durée de la réponse ne révèle pas son existence.
      const passwordOk = await passwords.verifyPassword(password, user?.password_hash || passwords.dummyHash);
      if (!user || !user.password_hash || !user.email_verified_at || !passwordOk) {
        return sendJson(res, 401, { error: MSG.badCredentials });
      }
      if (passwords.needsRehash(user.password_hash)) {
        await store.setPassword(db, user.id, await passwords.hashPassword(password));
      }
      await startSession(db, req, res, user.id);
      return sendJson(res, 200, { user: { id: user.id, email: user.email, emailVerified: true } });
    } },

    logout: { method: 'POST', run: async ({ db, req, res }) => {
      await store.deleteSession(db, readSessionToken(req));
      res.setHeader('Set-Cookie', clearedSessionCookie(req));
      return sendJson(res, 200, { ok: true });
    } },

    forgot: { method: 'POST', run: async ({ db, req, res, body, origin }) => {
      const email = normalizeEmail(body.email);
      if (!email) return sendJson(res, 400, { error: MSG.badEmail });
      if (!(await allowed(db, req, 'forgot', email))) return sendJson(res, 429, { error: MSG.tooMany });
      const user = await store.findUserByEmail(db, email);
      if (user) mail(email, resetEmail(origin, await store.createAuthToken(db, user.id, 'reset_password')));
      return sendJson(res, 200, { ok: true, message: MSG.forgotSent });
    } },

    // Connexion par lien reçu par e-mail (après un paiement) : le lien prouve que l'on possède la boîte mail.
    magic: { method: 'POST', run: async ({ db, req, res, body }) => {
      const token = text(body.token, 100);
      if (!token) return sendJson(res, 400, { error: MSG.invalid });
      if (!(await allowed(db, req, 'token'))) return sendJson(res, 429, { error: MSG.tooMany });
      const userId = await store.consumeAuthToken(db, token, 'magic_login');
      if (!userId) return sendJson(res, 400, { error: MSG.badLink });
      await store.markEmailVerified(db, userId);
      await startSession(db, req, res, userId);
      const user = await store.findUserById(db, userId);
      return sendJson(res, 200, { user: { id: user.id, email: user.email, emailVerified: true } });
    } },
  };

  async function setPasswordFromToken({ db, req, res, body }, purpose) {
    const token = text(body.token, 100);
    const password = text(body.password, PASSWORD_MAX_LENGTH);
    if (!token) return sendJson(res, 400, { error: MSG.badLink });
    if (!(await allowed(db, req, 'token'))) return sendJson(res, 429, { error: MSG.tooMany });

    // Contrôle du lien et du mot de passe AVANT de consommer le lien : un mot de passe refusé ne le brûle pas.
    const userId = await store.findValidAuthToken(db, token, purpose);
    if (!userId) return sendJson(res, 400, { error: MSG.badLink });
    const user = await store.findUserById(db, userId);
    const passwordError = validatePassword(password ?? undefined, { email: user?.email });
    if (!user || passwordError) return sendJson(res, 400, { error: passwordError || MSG.badLink });

    if (!(await store.consumeAuthToken(db, token, purpose))) return sendJson(res, 400, { error: MSG.badLink });
    await store.setPassword(db, userId, await passwords.hashPassword(password));
    await store.markEmailVerified(db, userId);
    await store.deleteUserSessions(db, userId); // un changement de mot de passe ferme toutes les sessions ouvertes
    return sendJson(res, 200, { ok: true });
  }

  return async function handler(req, res) {
    const action = actions[String(req.query?.action || '')];
    if (!action) return sendJson(res, 404, { error: MSG.invalid });
    if (req.method !== action.method) {
      res.setHeader('Allow', action.method);
      return sendJson(res, 405, { error: MSG.invalid });
    }
    if (action.method === 'POST' && !isSameOriginRequest(req, env)) return sendJson(res, 403, { error: MSG.forbidden });

    const origin = siteOrigin(env);
    if (!origin) {
      log.error('[Auth] NEXT_PUBLIC_SITE_URL absente ou invalide : authentification indisponible.');
      return sendJson(res, 500, { error: MSG.failure });
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    try {
      return await action.run({ db: getDb(), req, res, body, origin });
    } catch (error) {
      log.error(`[Auth] Erreur (${req.query?.action}) : ${error.message}`);
      return sendJson(res, 500, { error: MSG.failure });
    }
  };
}
