// Réception des rapports de la politique de sécurité du contenu (CSP), déployée pour l'instant en
// mode « Report-Only » (vercel.json) : le navigateur ne bloque rien, il signale seulement ce qu'il
// bloquerait. Les violations sont écrites dans les journaux Vercel (« [CSP] ... ») pour ajuster la
// politique avant de l'activer réellement.

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_LOGGED = 20;

// Ne garde que l'origine d'une URL : les chemins et paramètres peuvent contenir des jetons ou
// des identifiants (ex. ?file=... dans l'URL du bilan) qui n'ont rien à faire dans les journaux.
function originOnly(value) {
  if (!value || typeof value !== 'string') return '';
  if (!/^https?:/i.test(value)) return value.slice(0, 40); // 'inline', 'eval', 'data', 'blob'...
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function pathOnly(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return '';
  }
}

// Accepte les deux formats envoyés par les navigateurs : `report-uri` ({"csp-report": {...}})
// et `report-to` / Reporting API ([{ type: "csp-violation", body: {...} }]).
export function summarizeCspReports(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  return items
    .map((item) => {
      if (item && item['csp-report']) {
        const r = item['csp-report'];
        return {
          directive: r['effective-directive'] || r['violated-directive'] || '',
          blocked: originOnly(r['blocked-uri']),
          page: pathOnly(r['document-uri']),
        };
      }
      if (item && item.type === 'csp-violation' && item.body) {
        const r = item.body;
        return {
          directive: r.effectiveDirective || '',
          blocked: originOnly(r.blockedURL),
          page: pathOnly(r.documentURL),
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, MAX_REPORTS_LOGGED);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return res.status(413).end();
    chunks.push(chunk);
  }

  try {
    const reports = summarizeCspReports(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    for (const r of reports) {
      console.warn(`[CSP] ${r.directive} bloquerait ${r.blocked || '(inconnu)'} sur ${r.page || '/'}`);
    }
  } catch {
    // Rapport illisible : ignoré.
  }
  return res.status(204).end();
}
