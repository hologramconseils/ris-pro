import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialisation de Supabase (Admin pour lire les fichiers privés)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialisation du moteur d'analyse
// On utilise la clé du projet ou la clé de secours validée
const apiKey = process.env.GOOGLE_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export default async function handler(req, res) {
  // Gestion CORS pour Vercel Functions
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'Analysis engine is ready', version: 'v2.2-20260507' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  if (!genAI) {
    return res.status(500).json({ error: 'Le moteur d\'IA n\'est pas configuré (Clé API manquante)' });
  }

  const { filePath, userId } = req.body;
  console.log("--- START ANALYSIS ---");
  console.log("File:", filePath);
  console.log("User:", userId);

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  const nirSalt = process.env.NIR_SALT || 'default_salt_for_ris_pro';

  try {
    console.log(`Analyse demandée pour : ${filePath} (User: ${userId || 'Public'})`);

    // 1. Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) {
       console.error("Erreur téléchargement Supabase:", downloadError);
       throw new Error(`Impossible de récupérer le document : ${downloadError.message}`);
    }

    // Convertir le fichier en buffer/base64 pour le moteur
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 2. Appeler le moteur d'expertise (stratégie de fallback multi-modèles)
    // On privilégie 1.5-flash pour la rapidité et l'OCR performant sur Vercel (limite 10s)
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"];
    let analysisResults = null;
    let nir = null;
    let lastError = null;

    console.log("Starting Gemini analysis...");
    
    const prompt = `
      Tu es l'expert retraite de Hologram Conseils spécialisé dans l'audit des relevés de carrière (RIS / EIG). 
      
      TON OBJECTIF : 
      Extraire avec une précision de 100% les données de carrière du document PDF fourni. 
      Le document peut être un PDF natif ou un document scanné (OCR requis).
      
      EXTRACTION CRITIQUE :
      - NIR : Identifie le Numéro de Sécurité Sociale (15 chiffres). Il est souvent en haut du document.
      - CARRIÈRE : Liste toutes les années travaillées. Pour chaque année, identifie :
        - Les trimestres validés (ex: 4/4).
        - Les points Agirc-Arrco (souvent dans une colonne dédiée à la fin).
        - L'employeur ou le régime.
      
      RÈGLES D'AUDIT RIS PRO :
      1. Ignorer l'année en cours.
      2. ANOMALIE si : Trimestres < 4 OU Points < 1 (pour les salariés du privé).
      3. Ignorer les années conformes (4 trimestres et points > 0).
      
      INSTRUCTIONS SPÉCIALES POUR LES SCANS :
      - Si le texte est mal reconnu, utilise le contexte visuel pour déduire les chiffres.
      - Les montants de salaires doivent être extraits sans les symboles monétaires.
      
      STRUCTURE JSON ATTENDUE :
      {
        "nir": "XXXXXXXXXXXXXXX",
        "anomalies": [
          {
            "year": "YYYY",
            "title": "Titre explicatif",
            "description": "Détail de l'anomalie",
            "employer": "Nom de l'employeur",
            "salary": "Montant",
            "trimesters": "X/4",
            "points": "X.XX",
            "reason": "Explication technique",
            "solution": "Comment corriger ?",
            "docs": ["Justificatif 1", "Justificatif 2"],
            "severity": "high/medium"
          }
        ],
        "summary": "Message personnalisé pour l'utilisateur"
      }
    `;
    for (const modelName of modelsToTry) {
      try {
        const startTime = Date.now();
        console.log(`Tentative avec le modèle : ${modelName}`);
        
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { 
              responseMimeType: "application/json",
              temperature: 0.1,
              topP: 0.95,
            }
        });
        
        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf"
            }
          }
        ]);

        const responseText = result.response.text();
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Réponse reçue de ${modelName} en ${duration}s`);

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            if (parsed.nir || parsed.anomalies) {
              nir = (parsed.nir || "").replace(/\s/g, '');
              analysisResults = parsed;
              console.log(`Analyse réussie avec ${modelName}`);
              break; 
            }
          } catch (parseErr) {
            console.warn(`Erreur parsing JSON de ${modelName}:`, responseText.substring(0, 100));
            lastError = new Error(`JSON invalide retourné par l'IA`);
          }
        }
      } catch (err) {
        console.error(`Échec avec ${modelName}:`, err.message);
        lastError = err;
        // Si c'est un timeout ou quota, on continue vers le suivant
      }
    }

    if (!analysisResults) {
      const finalError = lastError ? lastError.message : "Le moteur d'analyse n'a pas pu extraire de données valides.";
      
      // On log l'échec dans Supabase pour le diagnostic
      await supabase.from('analyses').update({ 
        status: 'failed', 
        results: { error: finalError, timestamp: new Date().toISOString() } 
      }).eq('file_path', filePath);

      throw new Error(finalError);
    }

    // 3. Gestion de la sécurité et des crédits (NIR Hashing)
    const cleanNir = nir || "000000000000000";
    const nirHash = crypto.createHash('sha256').update(cleanNir + nirSalt).digest('hex');
    
    // On met à jour l'enregistrement dans Supabase
    const { error: updateError } = await supabase
      .from('analyses')
      .update({ 
        status: 'completed',
        results: analysisResults,
        nir_hash: nirHash,
        user_id: userId
      })
      .eq('file_path', filePath);

    if (updateError) {
        console.warn("Erreur mise à jour base de données:", updateError.message);
    }

    return res.status(200).json(analysisResults);

  } catch (error) {
    console.error("CRITICAL API ERROR:", error);
    
    // Tentative de log de l'erreur fatale
    try {
      await supabase.from('analyses').update({ 
        status: 'error', 
        results: { error: error.message, stack: error.stack } 
      }).eq('file_path', filePath);
    } catch (e) {}

    return res.status(500).json({ 
      error: "L'analyse a échoué", 
      details: error.message,
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}
