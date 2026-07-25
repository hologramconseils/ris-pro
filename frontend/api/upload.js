import { put } from '@vercel/blob';
import { getDb } from './db.js';
import { createClerkClient } from '@clerk/backend';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const filename = req.query.filename 
      ? decodeURIComponent(req.query.filename) 
      : `upload_${Date.now()}.pdf`;
    const safeName = `ris-pro/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Auth Clerk (optionnel)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && process.env.CLERK_SECRET_KEY) {
      const token = authHeader.split(' ')[1];
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const verified = await clerk.verifyToken(token);
        userId = verified.sub;
      } catch (e) {
        console.warn('Token invalide, upload en mode anonyme:', e.message);
      }
    }

    // Lire le body en Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Fichier vide reçu.' });
    }

    // Upload vers Vercel Blob
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false,
    });

    const filePath = blob.url;

    // Enregistrement en base Neon
    try {
      const pool = getDb();
      
      // Créer le profil si inexistant (premier upload)
      if (userId) {
        await pool.query(
          `INSERT INTO profiles (id, analysis_credits, is_paid, created_at, updated_at)
           VALUES ($1, 0, false, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId]
        );
      }

      await pool.query(
        `INSERT INTO analyses (file_path, status, user_id, results, created_at, updated_at)
         VALUES ($1, 'pending', $2, '{}'::jsonb, NOW(), NOW())`,
        [filePath, userId]
      );
    } catch (dbError) {
      // L'upload Blob a réussi, on retourne quand même l'URL
      console.error('Erreur DB (non bloquante):', dbError.message);
    }

    return res.status(200).json({ filePath });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Erreur lors du téléchargement du fichier.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
