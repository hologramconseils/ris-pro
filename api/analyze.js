import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Initialisation de Supabase (Admin pour lire les fichiers privés)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialisation du moteur d'analyse
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  try {
    // 1. Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) throw downloadError;

    // Convertir le fichier en buffer/base64 pour le moteur
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 2. Appeler le moteur d'expertise (version stable)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Tu es un expert en retraite française (CNAV, Agirc-Arrco, MSA, Ircantec). 
      Analyse ce relevé de carrière (RIS) et identifie TOUTES les anomalies potentielles.
      
      CRITÈRES DE DÉTECTION (ANOMALIE = ANNÉE NON CONFORME) :
      1. Toute année comportant MOINS de 4 trimestres validés (ex: 0/4, 1/4, 2/4, 3/4).
      2. Toute année comportant 0 point de retraite complémentaire (Agirc-Arrco, etc.), même si elle a 4 trimestres.
      
      RÈGLES MÉTIER :
      - Inclus une entrée pour CHAQUE année en anomalie (incomplète ou sans point).
      - Une année avec 4 trimestres mais 0 point DOIT apparaître.
      - Une année avec moins de 4 trimestres même avec des points DOIT apparaître.
      - Une année avec 4 trimestres ET des points ne doit PAS apparaître (année conforme).
      - Ordonne obligatoirement les résultats de l'année la plus ancienne à la plus récente.

      IMPORTANT : Ta réponse doit être un objet JSON valide uniquement.
      TU DOIS RÉPONDRE EXCLUSIVEMENT EN FRANÇAIS.
      
      Structure attendue :
      {
        "anomalies": [
          {
            "year": "YYYY",
            "title": "Titre court (ex: Année incomplète ou Manque de points)",
            "description": "Description concise de l'impact",
            "employer": "Nom de l'employeur ou organisme",
            "salary": "Salaire brut ou nature des revenus",
            "trimesters": "X/4",
            "points": "Nombre de points ou 0",
            "reason": "Explication détaillée de l'anomalie",
            "solution": "Démarche concrète pour régulariser",
            "docs": ["Liste des justificatifs requis"],
            "severity": "high" | "medium" | "low"
          }
        ],
        "summary": "Résumé de l'audit en une phrase."
      }
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: "application/pdf"
        }
      },
      prompt
    ]);

    const responseText = result.response.text();
    // Nettoyage robuste du JSON (gestion des backticks et du texte superflu)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Le moteur d'analyse n'a pas renvoyé un format JSON valide");
    }
    const analysisResults = JSON.parse(jsonMatch[0]);

    // 3. Mettre à jour le statut et les résultats dans la base de données
    await supabase
      .from('analyses')
      .update({ 
        status: 'completed',
        results: analysisResults 
      })
      .eq('file_path', filePath);

    return res.status(200).json(analysisResults);

  } catch (error) {
    console.error("Erreur du moteur d'analyse :", error);
    return res.status(500).json({ error: "L'analyse a échoué", details: error.message });
  }
}
