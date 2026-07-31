import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';
import { Resend } from 'resend';
import { getDb } from './db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Méthode non autorisée');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const userEmail = session.customer_details?.email || session.customer_email;

    let finalUserId = userId;
    let isNewUser = false;
    let magicLink = null;

    console.log(`[Webhook] Session reçue. email: ${userEmail}`);

    if (userEmail) {
      if (!finalUserId) {
        try {
          console.log(`[Webhook] Recherche utilisateur Clerk pour: ${userEmail}`);
          const usersResponse = await clerkClient.users.getUserList({ emailAddress: [userEmail] });
          
          if (usersResponse.data && usersResponse.data.length > 0) {
            finalUserId = usersResponse.data[0].id;
            console.log(`[Webhook] Utilisateur trouvé: ${finalUserId}`);
          } else {
            isNewUser = true;
            const newUser = await clerkClient.users.createUser({
              emailAddress: [userEmail],
              firstName: 'Client',
              lastName: 'RIS Pro',
              skipPasswordRequirement: true
            });
            finalUserId = newUser.id;
            console.log(`[Webhook] Nouvel utilisateur Clerk créé: ${finalUserId}`);
            
            // Initialiser le profil dans Postgres
            const db = getDb();
            await db.query('INSERT INTO profiles (id, analysis_credits) VALUES ($1, 0) ON CONFLICT (id) DO NOTHING', [finalUserId]);
          }
        } catch (err) {
          console.error("[Webhook] Erreur Clerk:", err);
        }
      }

      if (finalUserId) {
        const db = getDb();
        try {
          // Incrémenter les crédits
          await db.query(
            'UPDATE profiles SET analysis_credits = analysis_credits + 4 WHERE id = $1',
            [finalUserId]
          );

          const filePath = session.metadata?.filePath;
          if (filePath) {
            await db.query(
              'UPDATE analyses SET user_id = $1 WHERE file_path ILIKE $2',
              [finalUserId, filePath]
            );
          }

          // Création du lien magique
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;
          try {
            const signInToken = await clerkClient.signInTokens.createSignInToken({
              userId: finalUserId,
              expiresInSeconds: 7 * 24 * 60 * 60
            });
            
            // signInToken.url permet de se connecter automatiquement
            // On peut ajouter un paramètre de redirection après connexion
            const redirectUrl = encodeURIComponent(`${siteUrl}/bilan?success=true&file=${encodeURIComponent(filePath || '')}`);
            magicLink = `${signInToken.url}?redirect_url=${redirectUrl}`;
          } catch (err) {
            console.error("[Webhook] Erreur génération lien Clerk:", err);
          }

          if (process.env.RESEND_API_KEY) {
            let emailHtml = '';
            if (magicLink) {
              emailHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                  <h1 style="color: #1a56db;">Merci pour votre confiance !</h1>
                  <p>Votre paiement a bien été validé et votre accès <strong>RIS Pro</strong> est actif.</p>
                  <p>Vous disposez désormais de :</p>
                  <ul style="background: #f3f4f6; padding: 1.5rem 2.5rem; border-radius: 8px; list-style: none;">
                    <li>✅ <strong>4 analyses détaillées</strong> de relevés de carrière</li>
                  </ul>
                  <p>Pour consulter le bilan complet et détaillé de votre analyse immédiatement sans mot de passe, cliquez sur ce lien sécurisé :</p>
                  <p style="text-align: center; margin: 2rem 0;">
                    <a href="${magicLink}" style="background-color: #1a56db; color: white; padding: 0.8rem 1.8rem; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">Consulter mon Bilan Premium</a>
                  </p>
                  <p style="font-size: 0.9rem; color: #666;">Ce lien est à usage unique et sécurisé. ${
                    isNewUser 
                      ? 'Lors de vos prochaines visites, vous pourrez configurer un mot de passe ou vous connecter directement avec votre email.' 
                      : 'Vous pouvez également vous connecter avec votre méthode habituelle.'
                  }</p>
                </div>
              `;
            } else {
              emailHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                  <h1 style="color: #1a56db;">Merci pour votre confiance !</h1>
                  <p>Vos 4 analyses détaillées ont été ajoutées à votre compte.</p>
                  <p>Connectez-vous avec votre adresse email pour commencer : <a href="${siteUrl}" style="color: #1a56db; font-weight: bold;">Accéder à RIS Pro</a></p>
                </div>
              `;
            }

            await resend.emails.send({
              from: 'RIS Pro <bertrand.saulnerond@hologramconseils.com>',
              to: [userEmail],
              subject: 'Confirmation de votre accès RIS Pro',
              html: emailHtml
            });
          }
        } catch (dbErr) {
           console.error("[Webhook] Erreur BDD Postgres:", dbErr);
        }
      }
    }
  }

  res.json({ received: true });
}
