// Déconnexion automatique après inactivité (cf. components/IdleLogout.jsx).
// La date de dernière activité est gardée dans localStorage, par session Clerk : une activité
// dans un autre onglet du site compte aussi, et rouvrir le site après une longue absence avec
// une session encore ouverte déconnecte immédiatement.

export const IDLE_LIMIT_MS = 10 * 60 * 1000;
export const WARNING_MS = 60 * 1000;

const STORAGE_PREFIX = 'ris_last_activity_';

export function activityKey(sessionId) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

// Temps restant avant déconnexion. Sans activité enregistrée (session qui vient de s'ouvrir),
// le délai complet reste disponible.
export function remainingMs(lastActivity, now) {
  if (!Number.isFinite(lastActivity)) return IDLE_LIMIT_MS;
  return IDLE_LIMIT_MS - (now - lastActivity);
}

export function readLastActivity(storage, sessionId) {
  try {
    const value = Number(storage.getItem(activityKey(sessionId)));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastActivity(storage, sessionId, now) {
  try {
    storage.setItem(activityKey(sessionId), String(now));
  } catch {
    // Stockage indisponible (navigation privée stricte) : la minuterie de l'onglet suffit.
  }
}

// Efface ce que le navigateur garde des analyses et des minuteries, à la déconnexion.
export function clearLocalTraces(local, session) {
  try {
    Object.keys(session).filter((k) => k.startsWith('ris_pro_analysis_')).forEach((k) => session.removeItem(k));
    Object.keys(local).filter((k) => k.startsWith(STORAGE_PREFIX)).forEach((k) => local.removeItem(k));
  } catch {
    // Rien à faire : stockage indisponible.
  }
}
