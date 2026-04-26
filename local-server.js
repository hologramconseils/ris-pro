import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { Resend } from 'resend';


dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());

// ROUTE WEBHOOK (DOIT ÊTRE AVANT express.json() pour garder le body brut)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      event = req.body;
      if (typeof event === 'string') event = JSON.parse(event);
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const userEmail = session.customer_details?.email || session.customer_email;

    if (userId) {
      console.log(`[Webhook] Tentative d'activation pour userId: ${userId}`);
      
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        console.warn("[Webhook] ATTENTION : SUPABASE_SERVICE_ROLE_KEY manquante. L'activation risque d'échouer (RLS).");
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        serviceKey || process.env.VITE_SUPABASE_ANON_KEY
      );

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ has_paid: true })
        .eq('id', userId)
        .select();

      if (error) {
        console.error("[Webhook] Erreur mise à jour profil :", error.message);
        console.error("[Webhook] Détails :", error);
      } else {
        console.log(`[Webhook] Succès ! Accès débloqué pour ${userId}`);
        if (process.env.RESEND_API_KEY && userEmail) {
          try {
            await resend.emails.send({
              from: 'RIS Pro <bertrand.saulnerond@hologramconseils.com>',
              to: [userEmail],
              subject: 'Bienvenue sur RIS Pro - Accès illimité activé !',
              html: `
                <h1>Merci pour votre confiance !</h1>
                <p>Votre paiement de 29€ a bien été validé. Vous disposez désormais d'un accès illimité à vie pour toutes vos analyses détaillées.</p>
                <p>Connectez-vous à tout moment sur RIS Pro avec votre adresse email et votre mot de passe pour réaliser de nouvelles analyses.</p>
                <br/>
                <p>L'équipe Hologram Conseils</p>
              `
            });
            console.log("Email de bienvenue envoyé à", userEmail);
          } catch (resendError) {
            console.error("Erreur Resend :", resendError);
          }
        }
      }
    }
  }
  res.json({ received: true });
});

app.use(express.json());

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock');

app.post('/api/analyze', async (req, res) => {
  const { filePath } = req.body;
  console.log("Analyse demandée pour :", filePath);

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `
      Tu es un moteur d'expertise en analyse de retraite française.
      Analyse ce relevé de carrière (RIS) et identifie STRICTEMENT ET EXCLUSIVEMENT les anomalies.
      
      RÈGLES IMPÉRATIVES D'EXTRACTION :
      1. Démarre l'analyse IMPÉRATIVEMENT à partir de l'année la plus ancienne présente dans le relevé d'origine.
      2. Conserve l'intégralité de la chronologie jusqu'à la période la plus récente, en respectant strictement l'ordre naturel du document source (de la plus ancienne en haut à la plus récente en bas).
      3. Affiche EXCLUSIVEMENT les années présentant une anomalie (exclus toute année conforme de la restitution finale, mais analyse-les bien dans l'ordre).
      4. Le cas échéant, affiche uniquement les périodes concernées au sein d'une année partiellement en anomalie.
      
      CONTRAINTES DE RESTITUTION POUR CHAQUE ANOMALIE :
      Pour chaque année/période en anomalie, tu DOIS obligatoirement restituer avec exactitude :
      - Le nombre de trimestres validés (régime de base).
      - Le nombre de points acquis (régimes complémentaires Agirc-Arrco).
      - Le salaire brut annuel.
      - La liste EXHAUSTIVE des employeurs présents sur l'année concernée.
      
      Maintiens la cohérence des informations même en présence d'anomalies partielles sur une année.

      IMPORTANT : Ta réponse doit être un objet JSON valide uniquement.
      TU DOIS RÉPONDRE EXCLUSIVEMENT EN FRANÇAIS. CHAQUE CHAMP TEXTE DOIT ÊTRE EN FRANÇAIS.
      Structure attendue pour CHAQUE anomalie :
      {
        "anomalies": [
          {
            "year": "YYYY (ou période spécifique)",
            "title": "Titre court de l'anomalie (OBLIGATOIREMENT EN FRANÇAIS)",
            "description": "Description concise (OBLIGATOIREMENT EN FRANÇAIS)",
            "employer": "Liste exhaustive des employeurs de l'année/période",
            "salary": "Salaire brut annuel",
            "trimesters": "Nombre de trimestres validés (ex: X/4)",
            "points": "Nombre de points acquis (Agirc-Arrco)",
            "reason": "Explication détaillée de l'anomalie (OBLIGATOIREMENT EN FRANÇAIS)",
            "solution": "Action concrète pour régulariser (OBLIGATOIREMENT EN FRANÇAIS)",
            "docs": ["Document 1 en français", "Document 2 en français"],
            "severity": "high" | "medium" | "low"
          }
        ],
        "summary": "Résumé de l'audit ciblé en une phrase (OBLIGATOIREMENT EN FRANÇAIS)."
      }
    `;


    console.log("Clé API utilisée (tronquée) :", process.env.GOOGLE_API_KEY?.substring(0, 5) + "...");
    
    // Modèles recommandés en 2026
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Tentative d'analyse avec le modèle ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent([
          { inlineData: { data: base64Data, mimeType: "application/pdf" } },
          prompt
        ]);
        if (result) {
          console.log(`Succès de l'expertise avec ${modelName}.`);
          break;
        }
      } catch (err) {
        console.error(`Erreur avec ${modelName} :`, err.message);
        lastError = err;
      }
    }

    if (!result) throw new Error("Le moteur d'analyse n'a pas pu traiter le document.");

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Le moteur d'analyse n'a pas renvoyé un format JSON valide");
    const analysisResults = JSON.parse(jsonMatch[0]);

    // 3. Suppression immédiate du fichier sur le storage pour garantir la confidentialité
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([filePath]);

    if (deleteError) {
      console.error("Erreur lors de la suppression du fichier :", deleteError);
    } else {
      console.log("Fichier supprimé du storage avec succès (Zéro conservation).");
    }

    res.json(analysisResults);
  } catch (error) {
    console.error("Erreur finale d'analyse :", error);
    res.status(500).json({ error: error.message });
  }
});

// --- STRIPE & AUTHENTICATION ENDPOINTS ---

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, userEmail, filePath } = req.body;
    
    // Simulate a successful checkout session for local development if keys are not configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log("Simulation de paiement Stripe pour :", userEmail);
      return res.json({ url: `http://localhost:5174/bilan?success=true&mock=true&userId=${userId}&file=${encodeURIComponent(filePath)}` });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Accès illimité aux Bilan Détaillés RIS Pro',
              description: 'Débloquez toutes les analyses d\'expertise à vie.',
            },
            unit_amount: 2900, // 29.00 €
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:5174/bilan?success=true&file=${encodeURIComponent(filePath)}`,
      cancel_url: `http://localhost:5174/diagnostic?canceled=true&file=${encodeURIComponent(filePath)}`,
      client_reference_id: userId,
      customer_email: userEmail,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});



const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Serveur d'analyse local démarré sur http://localhost:${PORT}`);
});

// Forcer le processus à rester ouvert
setInterval(() => {}, 1000);
