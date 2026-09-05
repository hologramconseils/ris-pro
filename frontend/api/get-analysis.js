import { getDb, ensureProfilesEmailColumn } from "./db.js";
import { verifyToken } from "@clerk/backend";
import { buildRestrictedResults, isAdminProfile } from "./analysisRestriction.js";

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
    res.setHeader('Access-Control-Allow-Origin', 'https://ris.hologramconseils.com');
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  let authenticatedUser = null;

  if (token) {
    try {
      const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
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
      `SELECT user_id, status, file_path, results FROM analyses WHERE file_path = $1 LIMIT 1`,
      [filePath]
    );

    const analysisRecord = analysisRows.length > 0 ? analysisRows[0] : null;

    if (!analysisRecord) {
      return res.status(404).json({ error: 'Document introuvable dans la base de données' });
    }

    // Profil chargé une seule fois : sert à la fois pour l'exception IDOR admin ci-dessous et
    // pour décider si le masquage freemium doit s'appliquer plus bas. isAdminProfile()
    // couvre le rôle ET l'email de contact — l'ancienne vérification IDOR ne testait que le
    // rôle, ce qui aurait pu refuser l'accès admin si la colonne `role` n'était pas renseignée.
    let isAdmin = false;
    if (authenticatedUser) {
      try {
        await ensureProfilesEmailColumn(pool);
        const { rows: profileRows } = await pool.query(
          `SELECT role, email FROM profiles WHERE id = $1 LIMIT 1`,
          [authenticatedUser.id]
        );
        isAdmin = isAdminProfile(profileRows.length > 0 ? profileRows[0] : null);
      } catch (profileErr) {
        // Ne jamais laisser une erreur sur cette requête annexe faire échouer toute la
        // récupération de l'analyse avec un 500 — on continue simplement sans statut admin.
        console.error("[Admin check] Erreur DB:", profileErr.message);
      }
    }

    // Protection IDOR
    if (analysisRecord.user_id && (!authenticatedUser || authenticatedUser.id !== analysisRecord.user_id) && !isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé à ce document' });
    }

    // Associer l'analyse au compte utilisateur s'il était déconnecté lors de la soumission mais est connecté maintenant
    if (!analysisRecord.user_id && authenticatedUser) {
      try {
        await pool.query(
          `UPDATE analyses SET user_id = $1 WHERE file_path = $2`,
          [authenticatedUser.id, analysisRecord.file_path]
        );
      } catch (e) {
        console.error("Erreur lors de l'association de l'analyse au compte:", e);
      }
    }

    // L'accès premium payant est acquis une fois pour toutes lors de l'analyse (analyze.js) et
    // persisté via le flag is_restricted. On ne le recalcule pas ici à partir du solde de
    // crédits courant : sinon un utilisateur ayant déjà débloqué ce document perdrait l'accès
    // dès que son solde retombe à 0 (crédit dépensé sur un autre document).
    // L'admin est une exception distincte et voit TOUJOURS tout, y compris un document dont le
    // flag stocké dit "restreint" (ex: analysé une première fois par un autre utilisateur ou en
    // session anonyme, avant que l'admin ne le consulte).
    if (!isAdmin && analysisRecord.status === 'completed' && analysisRecord.results && analysisRecord.results.is_restricted === true) {
      analysisRecord.results = buildRestrictedResults(analysisRecord.results);
    }

    return res.status(200).json(analysisRecord);

  } catch (error) {
    console.error("GET Analysis Error:", error);
    return res.status(500).json({ error: 'Erreur lors de la récupération de l\'analyse' });
  }
}
