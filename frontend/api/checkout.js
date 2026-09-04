import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';
import { getDb } from './db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { userEmail, filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  // Seul un token Clerk vérifié peut établir l'identité de l'acheteur : un
  // userId fourni par le client ne doit jamais être fait confiance tel quel
  // (il est ensuite utilisé par le webhook pour créditer un compte et
  // générer un lien de connexion magique).
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

  const userId = authenticatedUser?.id || null;

  try {
    const pool = getDb();
    const { rows: analysisRows } = await pool.query(
      `SELECT user_id FROM analyses WHERE file_path = $1 LIMIT 1`,
      [filePath]
    );
    const analysisRecord = analysisRows.length > 0 ? analysisRows[0] : null;

    if (!analysisRecord) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    if (analysisRecord.user_id && analysisRecord.user_id !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé à ce document' });
    }

    const idempotencyKey = `checkout_${userId || 'guest'}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Pack 4 Analyses RIS Pro',
              description: 'Accès complet pour 4 analyses détaillées de relevés de carrière (RIS / EIG).',
            },
            unit_amount: 3900,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: userEmail,
      ...(userId && { client_reference_id: userId }),
      metadata: {
        filePath: filePath
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://' + req.headers.host}/bilan?success=true&file=${encodeURIComponent(filePath)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://' + req.headers.host}/diagnostic?file=${encodeURIComponent(filePath)}`,
    }, {
      idempotencyKey: idempotencyKey
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe Session:', error);
    return res.status(500).json({ error: error.message });
  }
}
