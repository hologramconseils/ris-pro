import { put } from '@vercel/blob';
import { getDb, ensureProfilesSchema } from './db.js';
import { verifyToken } from '@clerk/backend';
import { MAX_UPLOAD_BYTES, isPdfBuffer, checkRateLimit, RATE_LIMIT_MESSAGE } from './security.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS : mêmes origines autorisées que les autres points d'API (et non plus « * »).
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://ris.hologramconseils.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', origin && allowedOrigins.includes(origin) ? origin : 'https://ris.hologramconseils.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Authentification obligatoire : aucune analyse ne doit pouvoir être lancée sans compte.
  // Rejetée avant tout traitement (avant l'écriture du fichier sur Vercel Blob) plutôt que de
  // retomber silencieusement sur un mode invité comme c'était le cas auparavant.
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token || !process.env.CLERK_SECRET_KEY) {
    return res.status(401).json({ error: 'Authentification requise pour analyser un document.' });
  }

  let userId;
  try {
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    userId = verified.sub;
  } catch (e) {
    console.warn('Token invalide:', e.message);
    return res.status(401).json({ error: 'Authentification requise pour analyser un document.' });
  }

  if (!(await checkRateLimit(getDb(), userId, 'upload'))) {
    return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
  }

  try {
    const filename = req.query.filename
      ? decodeURIComponent(req.query.filename)
      : `upload_${Date.now()}.pdf`;
    const safeName = `ris-pro/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Lire le body en Buffer, en s'arrêtant dès que la taille maximale est dépassée.
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: 'Fichier trop volumineux : 4 Mo maximum.' });
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Fichier vide reçu.' });
    }
    // Le contenu doit réellement être un PDF, quel que soit le nom ou le type annoncé.
    if (!isPdfBuffer(buffer)) {
      return res.status(415).json({ error: 'Seuls les fichiers PDF sont acceptés.' });
    }

    // Upload vers Vercel Blob (store configuré en private)
    const blob = await put(safeName, buffer, {
      access: 'private',
      contentType: 'application/pdf',
      addRandomSuffix: false,
    });

    const filePath = blob.url;

    // Enregistrement en base Neon
    const pool = getDb();

    try {
      // S'assurer que la colonne file_base64 existe (migration auto)
      await pool.query('ALTER TABLE analyses ADD COLUMN IF NOT EXISTS file_base64 TEXT;');
    } catch (dbError) {
      console.error('Erreur migration analyses (non bloquante):', dbError.message);
    }

    // Créer le profil si inexistant (premier upload). Volontairement dans son propre try/catch,
    // séparé de l'INSERT dans `analyses` ci-dessous : un profil qui échoue à se créer (ex.
    // décalage de schéma) ne doit jamais empêcher l'enregistrement du document lui-même, sinon
    // /api/analyze ne le retrouve jamais ensuite (404 "Document introuvable").
    try {
      await ensureProfilesSchema(pool);
      await pool.query(
        `INSERT INTO profiles (id, analysis_credits, is_paid, created_at, updated_at)
         VALUES ($1, 0, false, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [userId]
      );
    } catch (dbError) {
      console.error('Erreur création profil (non bloquante):', dbError.message);
    }

    try {
      const base64Data = buffer.toString('base64');

      await pool.query(
        `INSERT INTO analyses (file_path, status, user_id, results, created_at, updated_at, file_base64)
         VALUES ($1, 'pending', $2, '{}'::jsonb, NOW(), NOW(), $3)`,
        [filePath, userId, base64Data]
      );
    } catch (dbError) {
      // L'upload Blob a réussi, on retourne quand même l'URL
      console.error('Erreur DB (non bloquante):', dbError.message);
    }

    return res.status(200).json({ filePath });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Erreur lors du téléchargement du fichier.'
    });
  }
}
