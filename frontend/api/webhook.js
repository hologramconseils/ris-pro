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

    let finalUserId = userId;
    let isNewUser = false;
    let magicLink = null;

    console.log(`[Webhook] Session reçue. userId: ${userId}, email: ${userEmail}`);

    if (userEmail) {
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Si pas de userId, on cherche ou crée l'utilisateur par email
      if (!finalUserId) {
        try {
          console.log(`[Webhook] Recherche de l'utilisateur pour l'email: ${userEmail}`);
          
          // 1. Tenter la recherche par RPC get_user_id_by_email (rapide & performant)
          let existingUserId = null;
          try {
            const { data: rpcUserId, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', {
              email_to_search: userEmail
            });
            if (!rpcError && rpcUserId) {
              existingUserId = rpcUserId;
              console.log(`[Webhook] Utilisateur trouvé via RPC pour ${userEmail} : ${existingUserId}`);
            } else if (rpcError) {
              console.log(`[Webhook] RPC get_user_id_by_email non disponible ou en erreur :`, rpcError.message);
            }
          } catch (rpcErr) {
            console.log(`[Webhook] Échec de l'appel RPC (fonction SQL peut-être manquante) :`, rpcErr.message);
          }

          // 2. Si RPC a échoué/indisponible, tenter via listUsers (fallback d'administration sécurisé)
          if (!existingUserId) {
            try {
              const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                perPage: 1000,
                page: 1
              });
              if (!listError && listData?.users) {
                const foundUser = listData.users.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
                if (foundUser) {
                  existingUserId = foundUser.id;
                  console.log(`[Webhook] Utilisateur trouvé via fallback listUsers pour ${userEmail} : ${existingUserId}`);
                }
              } else if (listError) {
                console.error("[Webhook] Erreur fallback listUsers :", listError.message);
              }
            } catch (listErr) {
              console.error("[Webhook] Échec critique du fallback listUsers :", listErr.message);
            }
          }

          if (existingUserId) {
            finalUserId = existingUserId;
          } else {
            // 3. Créer un nouvel utilisateur s'il n'existe nulle part
            isNewUser = true;
            const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            
            const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: userEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { first_name: 'Client', last_name: 'RIS Pro' }
            });

            if (createError) {
              console.error("[Webhook] Erreur lors de la création de l'utilisateur :", createError.message);
            } else if (createdUser?.user) {
              finalUserId = createdUser.user.id;
              console.log(`[Webhook] Nouvel utilisateur créé pour l'email ${userEmail} : ${finalUserId}`);
            }
          }
        } catch (err) {
          console.error("[Webhook] Erreur lors de la recherche/création d'utilisateur :", err);
        }
      }

      // Si nous avons un utilisateur valide
      if (finalUserId) {
        console.log(`[Webhook] Activation pour userId: ${finalUserId}`);

        // Appel RPC atomique pour incrémenter les crédits et marquer le profil comme payant (SEC-004)
        const { error: profileError } = await supabaseAdmin.rpc('increment_credits', {
          target_user_id: finalUserId,
          qty: 4
        });

        if (profileError) {
          console.error("[Webhook] Erreur mise à jour profil :", profileError.message);
        } else {
          // Associer l'analyse en cours si filePath est présent dans les métadonnées Stripe
          const filePath = session.metadata?.filePath;
          if (filePath) {
            console.log(`[Webhook] Association du fichier ${filePath} à l'utilisateur ${finalUserId}`);
            await supabaseAdmin
              .from('analyses')
              .update({ user_id: finalUserId })
              .ilike('file_path', filePath);
          }

          // Générer le lien de connexion directe pour tous les utilisateurs (nouveaux et existants)
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: userEmail,
              options: {
                redirectTo: `${siteUrl}/bilan?success=true&file=${encodeURIComponent(filePath || '')}`
              }
            });

            if (!linkError && linkData?.properties?.action_link) {
              magicLink = linkData.properties.action_link;
              console.log("[Webhook] Lien de connexion généré avec succès.");
            } else if (linkError) {
              console.error("[Webhook] Erreur generateLink :", linkError.message);
            }
          } catch (err) {
            console.error("[Webhook] Erreur génération lien magique :", err);
          }

          // Envoi email de bienvenue (Contenu mis à jour selon instructions)
          if (process.env.RESEND_API_KEY) {
            try {
              let emailHtml = '';
              if (magicLink) {
                emailHtml = `
                  <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #1a56db;">Merci pour votre confiance !</h1>
                    <p>Votre paiement de <strong>29 €</strong> a bien été validé et votre accès <strong>RIS Pro</strong> est actif.</p>
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
                        ? 'Lors de vos prochaines visites, vous pourrez utiliser la fonction "Mot de passe oublié" avec votre email pour définir un mot de passe permanent.' 
                        : 'Vous pouvez également utiliser votre mot de passe habituel pour vous connecter.'
                    }</p>
                    <br/>
                    <p>L'équipe Hologram Conseils</p>
                  </div>
                `;
              } else {
                emailHtml = `
                  <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #1a56db;">Merci pour votre confiance !</h1>
                    <p>Votre paiement de <strong>29 €</strong> a bien été validé.</p>
                    <p>Vous disposez désormais d'un pack de :</p>
                    <ul style="background: #f3f4f6; padding: 1.5rem 2.5rem; border-radius: 8px; list-style: none;">
                      <li>✅ <strong>4 analyses détaillées</strong> de relevés de carrière</li>
                    </ul>
                    <p>Chaque analyse est décomptée lors de l'étude d'une identité unique. Votre solde de crédits est consultable à tout moment sur votre tableau de bord.</p>
                    <p>Connectez-vous avec votre adresse email pour commencer : <a href="https://ris.hologramconseils.com" style="color: #1a56db; font-weight: bold;">Accéder à RIS Pro</a></p>
                    <br/>
                    <p>L'équipe Hologram Conseils</p>
                  </div>
                `;
              }

              await resend.emails.send({
                from: 'RIS Pro <bertrand.saulnerond@hologramconseils.com>',
                to: [userEmail],
                subject: 'Confirmation de votre accès RIS Pro',
                html: emailHtml
              });
              console.log("[Webhook] Email de bienvenue envoyé.");
            } catch (resendError) {
              console.error("Erreur Resend :", resendError);
            }
          }
        }
      }
    }
  }

  res.json({ received: true });
}
