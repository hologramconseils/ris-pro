import { buffer } from 'micro';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../lib/stripeConfig.js';
import * as authStore from '../lib/authStore.js';
import { resolvePaymentAccount, createPaymentLoginLink } from '../lib/paymentAccount.js';
import { paymentConfirmationEmail } from '../lib/authEmails.js';
import { siteOrigin } from '../lib/authRequest.js';
import { sendEmail, isMailConfigured } from '../lib/mailer.js';
import { getDb } from '../lib/db.js';
import { maskEmail } from '../lib/security.js';
import { creditsToGrant, unlockPaidDocument } from '../lib/paymentCredits.js';
import { ensureProcessedPaymentsSchema, claimPayment, releasePayment } from '../lib/paymentIdempotency.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

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
      try {
        const db = getDb();
        await authStore.ensureAuthSchema(db);
        ({ userId: finalUserId, isNewUser } = await resolvePaymentAccount({ db, store: authStore, clientUserId: userId, email: userEmail }));
        if (isNewUser) console.log(`[Webhook] Nouveau compte créé: ${finalUserId}`);
      } catch (err) {
        console.error("[Webhook] Erreur lors de la recherche ou de la création du compte:", err);
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

          // Lien de connexion à usage unique menant au bilan payé
          const siteUrl = siteOrigin() || `https://${req.headers.host}`;
          try {
            magicLink = await createPaymentLoginLink({ db, store: authStore, userId: finalUserId, origin: siteOrigin(), filePath });
          } catch (err) {
            console.error("[Webhook] Erreur génération du lien de connexion:", err);
          }

          if (isMailConfigured()) {
            const { subject, html: emailHtml } = paymentConfirmationEmail({ link: magicLink, isNewUser, siteUrl });

            // sendEmail ne lève pas d'exception quand l'envoi échoue : l'erreur est renvoyée dans
            // `error`. Sans cette vérification, un e-mail refusé passait totalement inaperçu.
            const { error: emailError } = await sendEmail({
              to: userEmail,
              subject,
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
