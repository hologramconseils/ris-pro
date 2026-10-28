// Envoi des e-mails transactionnels (confirmation de paiement, lien d'accès) par Brevo, société
// française dont les serveurs sont dans l'Union européenne. Remplace Resend (États-Unis).
// Appel direct de l'API HTTP de Brevo avec `fetch` : aucune dépendance.
//
// Variables d'environnement : BREVO_API_KEY (clé d'API v3), et facultativement MAIL_FROM_EMAIL /
// MAIL_FROM_NAME. L'adresse expéditrice doit être validée dans Brevo (domaine authentifié SPF/DKIM).

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_FROM_EMAIL = 'bertrand.saulnerond@hologramconseils.com';
const DEFAULT_FROM_NAME = 'RIS Pro';

export function isMailConfigured() {
  return Boolean(process.env.BREVO_API_KEY);
}

// Ne lève jamais d'exception : renvoie { error: null } en cas de succès, sinon { error: { name, message } }.
// L'appelant journalise l'échec sans bloquer le reste du traitement du paiement.
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { error: { name: 'NotConfigured', message: 'BREVO_API_KEY absente' } };

  const sender = {
    name: process.env.MAIL_FROM_NAME || DEFAULT_FROM_NAME,
    email: process.env.MAIL_FROM_EMAIL || DEFAULT_FROM_EMAIL,
  };
  const recipients = [].concat(to).filter(Boolean).map((email) => ({ email }));
  if (recipients.length === 0) return { error: { name: 'NoRecipient', message: 'Aucun destinataire' } };

  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender, to: recipients, subject, htmlContent: html }),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      return { error: { name: `HTTP ${response.status}`, message: detail } };
    }
    return { error: null };
  } catch (error) {
    return { error: { name: error?.name || 'Error', message: error?.message || String(error) } };
  }
}
