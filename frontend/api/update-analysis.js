import { getDb } from "./db.js";
import { createClerkClient } from "@clerk/backend";

export default async function handler(req, res) {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath, results } = req.body;

  if (!filePath || !results) {
    return res.status(400).json({ error: 'Chemin du fichier ou résultats manquants' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  let authenticatedUser = null;

  if (token) {
    try {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const verified = await clerk.verifyToken(token);
      if (verified && verified.sub) {
        authenticatedUser = { id: verified.sub };
      }
    } catch (authErr) {
      console.error("[Auth] Échec de la vérification du token JWT:", authErr.message);
    }
  }

  const pool = getDb();

  try {
    const { rows: analysisRows } = await pool.query(
      `SELECT user_id, file_path FROM analyses WHERE file_path ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
      [`%${filePath}%`]
    );

    const analysisRecord = analysisRows.length > 0 ? analysisRows[0] : null;

    if (!analysisRecord) {
      return res.status(404).json({ error: 'Document introuvable dans la base de données' });
    }

    // Protection IDOR
    if (analysisRecord.user_id && (!authenticatedUser || authenticatedUser.id !== analysisRecord.user_id)) {
      let isAdmin = false;
      if (authenticatedUser) {
        const { rows: profileRows } = await pool.query(
          `SELECT role FROM profiles WHERE clerk_user_id = $1 LIMIT 1`,
          [authenticatedUser.id]
        );
        if (profileRows.length > 0 && profileRows[0].role === 'admin') {
          isAdmin = true;
        }
      }
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Accès non autorisé à ce document' });
      }
    }

    // Mettre à jour l'analyse
    await pool.query(
      `UPDATE analyses SET results = $1, updated_at = NOW() WHERE file_path = $2`,
      [JSON.stringify(results), analysisRecord.file_path]
    );

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("POST Analysis Update Error:", error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'analyse' });
  }
}
