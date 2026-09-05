import { getDb } from './db.js';
import { verifyToken } from '@clerk/backend';

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
    res.setHeader('Access-Control-Allow-Origin', 'https://ris.hologramconseils.com');
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const token = authHeader.split(' ')[1];
    let verified = null;
    try {
      verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    } catch (authErr) {
      console.error("[Auth] Échec de la vérification du token JWT:", authErr.message);
    }

    if (!verified || !verified.sub) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const userId = verified.sub;
    const pool = getDb();

    // Fetch profile
    const { rows: profileRows } = await pool.query(
      `SELECT * FROM profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );

    // Fetch analysis count
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as exact_count FROM analyses WHERE user_id = $1`,
      [userId]
    );

    let profile = profileRows.length > 0 ? profileRows[0] : null;
    const userAnalysisCount = parseInt(countRows[0].exact_count, 10) || 0;

    // Default values if no profile yet (webhooks might be delayed)
    if (!profile) {
      profile = {
        id: userId,
        analysis_credits: 0,
        role: 'user',
        is_paid: false
      };
    }

    res.status(200).json({
      ...profile,
      analysis_credits: profile.analysis_credits || 0,
      analysis_count: userAnalysisCount
    });

  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
}
