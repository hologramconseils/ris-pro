// Détection du type de base selon DATABASE_URL (séparé de db.js pour rester testable sans pilote).
export function isNeonUrl(url) {
  return /(^|[@.])neon\.tech([:/?]|$)/.test(String(url || ''));
}
