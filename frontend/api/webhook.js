import { buffer } from 'micro';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../lib/stripeConfig.js';
import { createClerkClient } from '@clerk/backend';
import { sendEmail, isMailConfigured } from '../lib/mailer.js';
import { getDb } from '../lib/db.js';
import { maskEmail } from '../lib/security.js';
import { creditsToGrant, unlockPaidDocument } from '../lib/paymentCredits.js';
import { ensureProcessedPaymentsSchema, claimPayment, releasePayment } from '../lib/paymentIdempotency.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
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

    console.log(`[Webhook] Session reçue. email: ${maskEmail(userEmail)}`);

    // Un même paiement n'est traité qu'une fois (cf. lib/paymentIdempotency.js). Si la base est
    // injoignable, on traite quand même : un doublon se rattrape, un paiement perdu non.
    let paymentClaimed = false;
    try {
      const claimDb = getDb();
      await ensureProcessedPaymentsSchema(claimDb);
      if (!(await claimPayment(claimDb, session.id))) {
        console.warn(`[Webhook] Paiement déjà traité (session ${session.id}) : livraison en double ignorée.`);
        return res.json({ received: true, duplicate: true });
      }
      paymentClaimed = true;
    } catch (claimErr) {
      console.error("[Webhook] Impossible d'enregistrer le paiement, traitement quand même :", claimErr.message);
    }

    if (userEmail) {
      if (!finalUserId) {
        try {
          console.log(`[Webhook] Recherche utilisateur Clerk pour: ${maskEmail(userEmail)}`);
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
          // Débloque d'abord le relevé payé : le pack comprend 4 analyses EN TOUT, dont celle de ce
          // relevé (cf. lib/paymentCredits.js). Retirer is_restricted du JSONB stocké le débloque
          // immédiatement : Bilan.jsx ne rappelle jamais /api/analyze après un paiement, il relit
          // /api/get-analysis, qui se fie au flag déjà stocké. Sans cette mise à jour ici, le
          // document resterait affiché masqué indéfiniment malgré le paiement.
          const filePath = session.metadata?.filePath;
          let unlockedDocument = false;
          if (filePath) {
            try {
              unlockedDocument = await unlockPaidDocument(db, finalUserId, filePath);
            } catch (unlockErr) {
              console.error("[Webhook] Erreur lors du déblocage du relevé:", unlockErr.message);
            }
          }

          // Incrémenter les crédits (4, moins 1 si le relevé payé vient d'être débloqué)
          await db.query(
            'UPDATE profiles SET analysis_credits = analysis_credits + $2 WHERE id = $1',
            [finalUserId, creditsToGrant(unlockedDocument)]
          );

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

          if (isMailConfigured()) {
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

            // sendEmail ne lève pas d'exception quand l'envoi échoue : l'erreur est renvoyée dans
            // `error`. Sans cette vérification, un e-mail refusé passait totalement inaperçu.
            const { error: emailError } = await sendEmail({
              to: userEmail,
              subject: 'Confirmation de votre accès RIS Pro',
              html: emailHtml
            });
            if (emailError) {
              console.error(`[Webhook] Échec de l'envoi de l'e-mail à ${maskEmail(userEmail)} :`, emailError.name, emailError.message);
            }
          } else {
            console.warn("[Webhook] BREVO_API_KEY absente : aucun e-mail de confirmation envoyé.");
          }
        } catch (dbErr) {
           console.error("[Webhook] Erreur BDD Postgres:", dbErr);
           // Rien n'a été accordé : on libère le paiement pour qu'un renvoi de l'événement (tableau de
           // bord Stripe) puisse être traité au lieu d'être pris pour un doublon.
           if (paymentClaimed) await releasePayment(db, session.id).catch(() => {});
        }
      } else if (paymentClaimed) {
        console.error(`[Webhook] Aucun compte pour le paiement ${session.id} : paiement libéré, à traiter manuellement.`);
        await releasePayment(getDb(), session.id).catch(() => {});
      }
    }
  }

  res.json({ received: true });
}
