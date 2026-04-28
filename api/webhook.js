import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = {
  api: {
    bodyParser: false, // Nécessaire pour la vérification de signature Stripe
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

    if (userId) {
      console.log(`[Webhook] Activation pour userId: ${userId}`);
      
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('analysis_credits')
        .eq('id', userId)
        .single();

      const newCredits = (currentProfile?.analysis_credits || 0) + 4;

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_paid: true,
          analysis_credits: newCredits 
        })
        .eq('id', userId);

      if (error) {
        console.error("[Webhook] Erreur mise à jour profil :", error.message);
      } else {
        // Envoi email de bienvenue (Contenu mis à jour selon instructions)
        if (process.env.RESEND_API_KEY && userEmail) {
          try {
            await resend.emails.send({
              from: 'RIS Pro <bertrand.saulnerond@hologramconseils.com>',
              to: [userEmail],
              subject: 'Confirmation de votre accès RIS Pro',
              html: `
                <h1>Confirmation de votre accès RIS Pro</h1>
                <p>Votre paiement a bien été pris en compte.</p>
                <p>Vous bénéficiez désormais de :</p>
                <ul>
                  <li><strong>4 analyses détaillées</strong> de relevés de carrière</li>
                </ul>
                <p>Chaque analyse correspond à une identité unique.</p>
                <p>Vous pouvez vous reconnecter à tout moment avec votre adresse email pour continuer vos analyses. Un compteur vous indiquera le nombre d'analyses restantes.</p>
                <p>Une fois les 4 analyses utilisées, un nouveau paiement sera nécessaire pour accéder à un nouveau pack.</p>
                <br/>
                <p>L'équipe RIS Pro</p>
              `
            });
          } catch (resendError) {
            console.error("Erreur Resend :", resendError);
          }
        }
      }
    }
  }

  res.json({ received: true });
}
