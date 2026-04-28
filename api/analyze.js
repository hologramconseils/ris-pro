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

  const { filePath, userId } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  const nirSalt = process.env.NIR_SALT || 'default_salt_for_ris_pro';

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
      
      EXTRACTION CRITIQUE :
      - Extrais le Numéro de Sécurité Sociale (NIR) complet de la personne (15 chiffres).
      
      LOGIQUE GÉNÉRALE D'ANALYSE :
      - Analyser uniquement les années en anomalie.
      - Ordonner strictement les résultats de l'année la plus ancienne à l'année la plus récente (ordre chronologique croissant).
      
      DÉTECTION DES ANOMALIES (ANNÉE NON CONFORME) :
      Une année est une anomalie si :
      - Nombre de trimestres < 4 (régime de base).
      - OU Nombre de points = 0 (retraite complémentaire).
      - OU les deux (trimestres < 4 ET points = 0).

      Une année est CONFORME (ne pas inclure) si :
      - Nombre de trimestres = 4 ET Nombre de points > 0.

      RÈGLES D'INCLUSION SPÉCIFIQUES :
      - 4 trimestres mais 0 point -> ANOMALIE (doit apparaître).
      - Moins de 4 trimestres mais avec des points -> ANOMALIE (doit apparaître).
      - Moins de 4 trimestres et 0 point -> ANOMALIE (doit apparaître).
      - 4 trimestres et des points (>0) -> CONFORME (ne doit pas apparaître).

      IMPORTANT : Ta réponse doit être un objet JSON valide uniquement.
      TU DOIS RÉPONDRE EXCLUSIVEMENT EN FRANÇAIS.
      
      Structure attendue :
      {
        "nir": "XXXXXXXXXXXXXXX",
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
    const nir = analysisResults.nir;
    delete analysisResults.nir; // On ne stocke pas le NIR en clair dans les résultats

    // 3. Gestion de la sécurité et des crédits (NIR Hashing)
    const crypto = await import('crypto');
    const nirHash = crypto.createHash('sha256').update(nir + nirSalt).digest('hex');
    
    if (userId) {
      // Vérifier si cette identité a déjà été analysée par cet utilisateur
      const { data: existingAnalysis } = await supabase
        .from('analyses')
        .select('id')
        .eq('user_id', userId)
        .eq('nir_hash', nirHash)
        .limit(1);

      if (!existingAnalysis || existingAnalysis.length === 0) {
        // Nouvelle identité : vérifier et décrémenter les crédits
        const { data: profile } = await supabase
          .from('profiles')
          .select('analysis_credits, role')
          .eq('id', userId)
          .single();

        if (profile && profile.role !== 'admin') {
          if (profile.analysis_credits <= 0) {
            return res.status(403).json({ 
              error: "Crédits insuffisants", 
              message: "Vous avez utilisé vos 4 analyses. Veuillez renouveler votre pack." 
            });
          }
          
          // Décrémenter via la fonction RPC sécurisée
          await supabase.rpc('decrement_analysis_credits', { user_uuid: userId });
        }
      }
    }

    // 4. Mettre à jour le statut, les résultats et le hash dans la base de données
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
    console.error("Erreur du moteur d'analyse :", error);
    return res.status(500).json({ error: "L'analyse a échoué", details: error.message });
  }
}
