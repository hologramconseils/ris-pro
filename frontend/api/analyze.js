import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const maxDuration = 60; // Timeout Vercel augmenté pour l'analyse PDF

// Initialisation de Supabase (Admin pour lire les fichiers privés)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialisation de Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  // Gestion CORS pour Vercel
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath, userId } = req.body;
  const nirSalt = process.env.NIR_SALT || 'ris_pro_v2_salt_2026';

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  try {
    console.log(`Début de l'analyse pour : ${filePath}`);

    // 1. Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) throw new Error(`Erreur Supabase Download: ${downloadError.message}`);

    // Convertir le fichier en buffer/base64 pour Gemini
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 2. Appeler le moteur d'expertise (stratégie de fallback multi-modèles)
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"];
    let analysisResults = null;
    let lastError = null;

    const prompt = `
      Tu es l'expert retraite de RIS Pro spécialisé dans l'audit des relevés de carrière (RIS / EIG).
      Analyse ce relevé de carrière et identifie toutes les anomalies.
      
      TON OBJECTIF : 
      Extraire avec précision les données de carrière et identifier les erreurs de trimestres ou de points.
      
      EXTRACTION :
      - NIR : Numéro de Sécurité Sociale (15 chiffres).
      - ANOMALIES : Liste des incohérences (ex: trimestres < 4 sur une année travaillée).
      
      STRUCTURE JSON ATTENDUE :
      {
        "nir": "XXXXXXXXXXXXXXX",
        "anomalies": [
          {
            "year": "YYYY",
            "employer": "Nom de l'employeur",
            "title": "Titre court de l'anomalie (ex: Trimestres manquants)",
            "description": "Explication détaillée pour le diagnostic gratuit",
            "reason": "Explication technique détaillée pour le bilan premium",
            "solution": "Action corrective à entreprendre (ex: Contacter la CNAV)",
            "docs": ["Document 1", "Document 2"],
            "salary": "Montant ou nature des revenus",
            "trimesters": "X/4",
            "points": "X.XX",
            "severity": "high/medium"
          }
        ],
        "summary": "Résumé global de l'audit"
      }
    `;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Tentative avec ${modelName}...`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf"
            }
          },
          { text: prompt }
        ]);

        const responseText = result.response.text();
        
        // Nettoyage robuste du JSON (enlève les blocs markdown)
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
        else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
        cleanText = cleanText.trim();

        const parsed = JSON.parse(cleanText);
        if (parsed.anomalies || parsed.nir) {
          analysisResults = parsed;
          console.log(`Analyse réussie avec ${modelName}`);
          break;
        }
      } catch (err) {
        console.error(`Échec avec ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!analysisResults) {
      throw lastError || new Error("L'IA n'a pas pu extraire de données valides.");
    }

    // 3. Gestion de la sécurité (Hashing du NIR)
    const cleanNir = (analysisResults.nir || "").replace(/\s/g, '') || "000000000000000";
    const nirHash = crypto.createHash('sha256').update(cleanNir + nirSalt).digest('hex');

    // 4. Mettre à jour la base de données
    await supabase
      .from('analyses')
      .update({ 
        status: 'completed',
        results: analysisResults,
        nir_hash: nirHash,
        user_id: userId
      })
      .eq('file_path', filePath);

    return res.status(200).json(analysisResults);

  } catch (error) {
    console.error("CRITICAL API ERROR:", error);
    
    // Log de l'erreur dans Supabase
    try {
      await supabase.from('analyses')
        .update({ status: 'failed', results: { error: error.message } })
        .eq('file_path', filePath);
    } catch (e) {}

    return res.status(500).json({ error: "L'analyse a échoué", details: error.message });
  }
}
