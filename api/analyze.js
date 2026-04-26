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
      
      Recherche spécifiquement :
      - Les trimestres manquants (moins de 4 trimestres par an sans raison apparente).
      - Les erreurs d'employeurs (orthographe, périodes incohérentes).
      - Les jobs d'été, stages ou jobs étudiants oubliés.
      - Les périodes de chômage, maladie ou service militaire non validées.

      IMPORTANT : Ta réponse doit être un objet JSON valide uniquement.
      TU DOIS RÉPONDRE EXCLUSIVEMENT EN FRANÇAIS. CHAQUE CHAMP TEXTE DOIT ÊTRE EN FRANÇAIS.
      Structure attendue pour CHAQUE anomalie :
      {
        "anomalies": [
          {
            "year": "YYYY",
            "title": "Titre court de l'anomalie (OBLIGATOIREMENT EN FRANÇAIS)",
            "description": "Description concise (OBLIGATOIREMENT EN FRANÇAIS)",
            "employer": "Nom de l'employeur ou organisme",
            "salary": "Salaire brut ou 'Indemnités'",
            "trimesters": "X/4",
            "points": "Nombre de points ou 0",
            "reason": "Explication détaillée de l'anomalie (OBLIGATOIREMENT EN FRANÇAIS)",
            "solution": "Action concrète pour régulariser (OBLIGATOIREMENT EN FRANÇAIS)",
            "docs": ["Document 1 en français", "Document 2 en français"],
            "severity": "high" | "medium" | "low"
          }
        ],
        "summary": "Résumé de l'audit en une phrase (OBLIGATOIREMENT EN FRANÇAIS)."
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
