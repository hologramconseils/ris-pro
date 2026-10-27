// Adaptateur minimal : fait fonctionner les fonctions de frontend/api/*.js (écrites pour Vercel)
// sur un serveur Node classique. Il ajoute req.query, req.body (JSON) et les helpers
// res.status(), res.json() et res.send() que Vercel fournit automatiquement.

export function adaptResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (!res.headersSent && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return res;
  };
  res.send = (body) => {
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body);
    res.end(body);
    return res;
  };
  return res;
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Prépare la requête pour un handler. `raw` est le corps déjà lu (ou null si le handler lit
// lui-même le flux, comme upload.js ou webhook.js, qui désactivent bodyParser).
export function adaptRequest(req, url, raw) {
  req.query = Object.fromEntries(url.searchParams);
  req.body = undefined;
  const type = String(req.headers['content-type'] || '');
  if (raw && raw.length > 0 && type.includes('application/json')) {
    req.body = JSON.parse(raw.toString('utf8'));
  } else if (raw && raw.length > 0 && type.includes('application/x-www-form-urlencoded')) {
    req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  }
  if (req.body === undefined) req.body = {};
  return req;
}
