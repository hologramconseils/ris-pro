import { put } from '@vercel/blob';
import { getDb } from './db.js';
import { createClerkClient } from '@clerk/backend';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS setup
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://ris.hologramconseils.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
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
    const filename = req.query.filename || `upload_${Date.now()}.pdf`;
    
    // Auth validation
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      try {
        const verified = await clerk.verifyToken(token);
        userId = verified.sub;
      } catch (e) {
        console.warn("Invalid token during upload, proceeding as guest", e.message);
      }
    }

    // Upload to Vercel Blob
    const blob = await put(filename, req, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    const filePath = blob.url;

    // Create pending analysis record in Postgres
    const pool = getDb();
    await pool.query(
      `INSERT INTO analyses (file_path, status, user_id, results, nir_hash, created_at, updated_at)
       VALUES ($1, 'pending', $2, '{}'::jsonb, NULL, NOW(), NOW())`,
      [filePath, userId]
    );

    res.status(200).json({ filePath });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier.' });
  }
}
