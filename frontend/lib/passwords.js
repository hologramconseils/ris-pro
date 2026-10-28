// Mots de passe : hachage scrypt (fonction lente et gourmande en mémoire, recommandée par l'OWASP pour
// stocker des mots de passe) avec un sel aléatoire par mot de passe. Aucune dépendance : module `crypto` de Node.
// Format stocké : scrypt$N$r$p$sel$empreinte (sel et empreinte en base64), ce qui permet de relever les
// paramètres plus tard : un mot de passe haché avec d'anciens paramètres est réhaché à la connexion suivante.

import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 3 }; // 32 Mo de mémoire par calcul
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 128 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128; // borne la durée d'un calcul : un mot de passe démesuré ne doit pas saturer le serveur

async function derive(password, salt, { N, r, p }) {
  return scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY });
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const { N, r, p } = SCRYPT_PARAMS;
  const hash = await derive(password, salt, SCRYPT_PARAMS);
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function parseStored(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 2 || r < 1 || p < 1) return null;
  const salt = Buffer.from(parts[4], 'base64');
  const hash = Buffer.from(parts[5], 'base64');
  if (salt.length === 0 || hash.length !== KEY_LENGTH) return null;
  return { N, r, p, salt, hash };
}

export async function verifyPassword(password, stored) {
  const parsed = parseStored(stored);
  if (!parsed || typeof password !== 'string' || password.length > PASSWORD_MAX_LENGTH) return false;
  const candidate = await derive(password, parsed.salt, parsed);
  return timingSafeEqual(candidate, parsed.hash);
}

// Vrai si l'empreinte a été calculée avec d'autres paramètres que les paramètres actuels.
export function passwordNeedsRehash(stored) {
  const parsed = parseStored(stored);
  if (!parsed) return true;
  return parsed.N !== SCRYPT_PARAMS.N || parsed.r !== SCRYPT_PARAMS.r || parsed.p !== SCRYPT_PARAMS.p;
}

// Empreinte d'un mot de passe inexistant : vérifiée quand l'adresse saisie ne correspond à aucun compte, pour
// que la durée de la réponse ne révèle pas si un compte existe.
export const DUMMY_PASSWORD_HASH = await hashPassword(randomBytes(16).toString('hex'));

// Mots de passe les plus courants, refusés quel que soit le reste (liste volontairement courte : la longueur
// minimale élimine déjà l'essentiel ; une liste plus complète pourra être ajoutée plus tard).
const COMMON_PASSWORDS = new Set([
  'motdepasse123', 'motdepasse1234', 'azertyuiop12', 'azertyazerty', 'azerty123456', 'password1234',
  'password12345', 'password123456', '123456789012', '1234567890123', 'qwertyuiop12', 'qwerty123456',
  'azertyuiopqs', 'bonjour12345', 'bienvenue123', 'iloveyou1234', 'administrateur', 'changeme1234',
  'ris-pro-motdepasse', 'hologramconseils',
]);

// Renvoie un message à afficher à l'utilisateur, ou null si le mot de passe est acceptable.
export function validatePassword(password, { email = '' } = {}) {
  if (typeof password !== 'string') return 'Le mot de passe est obligatoire.';
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  const lower = password.toLowerCase();
  const local = String(email).toLowerCase().split('@')[0];
  if (COMMON_PASSWORDS.has(lower)) return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  if (email && (lower === String(email).toLowerCase() || (local.length >= 4 && lower.includes(local)))) {
    return 'Le mot de passe ne doit pas contenir votre adresse e-mail.';
  }
  if (/^(.)\1+$/.test(password)) return 'Le mot de passe ne doit pas répéter un seul caractère.';
  return null;
}
