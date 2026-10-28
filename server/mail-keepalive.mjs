// Contrôle mensuel de l'envoi d'e-mails : envoie un court message à l'adresse de l'administrateur.
// Brevo désactive une clé d'API restée 90 jours sans usage ; RIS Pro n'envoie un e-mail qu'après un
// paiement, donc une période calme éteindrait la clé en silence et le prochain client ne recevrait
// pas son lien d'accès. Cet envoi mensuel la garde active et prouve que la chaîne fonctionne.
// En cas d'échec, le script se termine en erreur : « systemctl status ris-pro-mail-keepalive » et
// « journalctl -u ris-pro-mail-keepalive » en donnent la cause (clé révoquée, domaine non authentifié...).
// Lancé par ris-pro-mail-keepalive.timer (le 1er de chaque mois), avec /etc/ris-pro/env.

import { pathToFileURL } from 'node:url';
import { sendEmail, isMailConfigured } from '../frontend/lib/mailer.js';

export async function runKeepalive({ send = sendEmail, configured = isMailConfigured, env = process.env, now = new Date() } = {}) {
  if (!configured()) return { ok: false, message: 'BREVO_API_KEY absente : aucun e-mail ne peut partir.' };
  const to = env.MAIL_REPLY_TO || 'bertrand.saulnerond@hologramconseils.com';
  const date = now.toISOString().slice(0, 10);
  const { error } = await send({
    to,
    subject: `RIS Pro : contrôle mensuel de l'envoi d'e-mails (${date})`,
    html: `<p>Contrôle automatique du ${date} : l'envoi d'e-mails de RIS Pro (Brevo) fonctionne.</p>
<p>Ce message garde aussi la clé d'API active (Brevo la désactive après 90 jours sans usage). Rien à faire.</p>`,
  });
  if (error) return { ok: false, message: `Échec de l'envoi (${error.name}) : ${error.message}` };
  return { ok: true, message: `Contrôle envoyé à ${to}.` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runKeepalive();
  console.log(`[Contrôle e-mails] ${result.message}`);
  process.exit(result.ok ? 0 : 1);
}
