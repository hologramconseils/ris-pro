import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const maxDuration = 60; // Timeout Vercel augmenté pour l'analyse PDF

// Initialisation de Supabase (Admin pour lire les fichiers privés et profils)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Initialisation de Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  // Gestion CORS sécurisée pour Vercel (SEC-006)
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://ris.hologramconseils.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://ris.hologramconseils.com');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath, userId } = req.body;

  // 1. Validation de la variable NIR_SALT (SEC-005)
  const nirSalt = process.env.NIR_SALT;
  if (!nirSalt && process.env.NODE_ENV === 'production') {
    console.error("FATAL: NIR_SALT est manquant en production.");
    return res.status(500).json({ error: "Erreur de configuration serveur" });
  }
  const salt = nirSalt || 'ris_pro_v2_salt_2026';

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  // 2. Validation de l'identité et Contrôle d'Accès JWT / IDOR (SEC-002)
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  let authenticatedUser = null;

  if (token) {
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && supabaseUser) {
        authenticatedUser = supabaseUser;
      }
    } catch (authErr) {
      console.error("[Auth] Échec de la vérification du token JWT:", authErr.message);
    }
  }

  try {
    console.log(`Vérification de la propriété du document : ${filePath}`);

    // Récupérer le record d'analyse dans Supabase pour vérifier le propriétaire
    const { data: analysisRecord, error: recordError } = await supabase
      .from('analyses')
      .select('user_id, status')
      .eq('file_path', filePath)
      .single();

    if (recordError || !analysisRecord) {
      return res.status(404).json({ error: 'Document introuvable dans la base de données' });
    }

    // Protection IDOR : Si le fichier appartient à quelqu'un d'autre
    if (analysisRecord.user_id && (!authenticatedUser || authenticatedUser.id !== analysisRecord.user_id)) {
      // Vérifier si l'utilisateur est admin
      let isAdmin = false;
      if (authenticatedUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authenticatedUser.id)
          .single();
        if (profile?.role === 'admin') {
          isAdmin = true;
        }
      }
      
      if (!isAdmin) {
        console.warn(`[IDOR Warn] Tentative d'accès non autorisé par ${authenticatedUser?.id || 'Anonyme'} sur le fichier de ${analysisRecord.user_id}`);
        return res.status(403).json({ error: 'Accès non autorisé à ce document' });
      }
    }

    console.log(`Début de l'analyse pour : ${filePath}`);

    // 3. Télécharger le fichier depuis Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) throw new Error(`Erreur Supabase Download: ${downloadError.message}`);

    // Convertir le fichier en buffer/base64 pour Gemini
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 4. Appeler le moteur d'expertise Gemini (ou restaurer depuis la source brute)
    let analysisResults = null;
    let lastError = null;

    // Règle 4 : Reconstruire dataset complet depuis DB si l'analyse existe déjà
    if (analysisRecord && analysisRecord.status === 'completed' && analysisRecord.results && !analysisRecord.results.is_restricted) {
      console.log(`[Cache DB] Données brutes restaurées depuis la DB pour : ${filePath}`);
      analysisResults = analysisRecord.results;
    } else {
      // Sinon, on lance l'analyse IA
      const modelsToTry = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-flash"];

      const prompt = `
        Tu es le conseiller expert en retraite de RIS Pro spécialisé dans l'audit des relevés de carrière (RIS / EIG).
        Ton rôle est d'analyser STRICTEMENT les informations historiques réelles disponibles sur le relevé de carrière téléchargé (PDF) et de les comparer rigoureusement aux textes légaux, réglementaires et législatifs français pour produire un bilan et des prévisions au plus près de la réalité actuelle et future.

        DIRECTIVE TERMINOLOGIQUE :
        Ne mentionne JAMAIS les mots "agent" ou "IA" dans tes descriptions, explications ou résumés. Remplacer par "conseiller", "expert", "bilan" ou "conseil".

        RÈGLES DE DÉTECTION DES ANOMALIES (À COMPARER AUX TEXTES RÉGLEMENTAIRES) :
        Une année est une ANOMALIE si elle remplit l'une des conditions suivantes :
        - CAS 1 : Moins de 4 trimestres validés.
        - CAS 2 : Nombre de points égal à 0.
        - CAS 3 : 4 trimestres validés MAIS avec 0 point.
        - CAS 4 : Toute combinaison où (trimestres < 4) OU (points <= 0).
        - CAS 5 : Année totalement ABSENTE du relevé alors qu'elle se situe entre le début et la fin de la carrière (trou de carrière).

        ANALYSE DE CONTINUITÉ OBLIGATOIRE :
        1. Identifie l'année la plus ancienne et l'année la plus récente du relevé.
        2. Vérifie chaque année dans cet intervalle.
        3. Si une année est manquante, ajoute-la aux anomalies avec le titre "Année absente du relevé".

        DÉFINITION D'UNE ANNÉE NORMALE (À EXCLURE) :
        Une année est NORMALE uniquement si : (Trimestres == 4) ET (Points > 0).
        NE JAMAIS inclure d'année normale dans la liste des anomalies.

        EXCLUSION SYSTÉMATIQUE :
        - Exclure l'année en cours (2026) car non consolidée.

        STRUCTURE JSON ATTENDUE :
        {
          "nir": "XXXXXXXXXXXXXXX",
          "anomalies": [
            {
              "year": "YYYY",
              "employer": "Nom de l'employeur",
              "title": "Titre court de l'anomalie",
              "description": "Explication pour le diagnostic gratuit",
              "reason": "Explication technique pour le bilan premium",
              "solution": "Action corrective à entreprendre",
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
          
          // Nettoyage robuste du JSON
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
    }

    // Hashing du NIR
    const cleanNir = (analysisResults.nir || "").replace(/\s/g, '') || "000000000000000";
    const nirHash = crypto.createHash('sha256').update(cleanNir + salt).digest('hex');

    // 5. Logique de Crédits et Droits d'Accès Premium
    let hasPremiumAccess = false;
    const targetUserId = authenticatedUser?.id || userId;

    if (targetUserId) {
      try {
        // Associer le user_id à la ligne d'analyse s'il n'était pas encore défini (guest login)
        if (!analysisRecord.user_id) {
          await supabase
            .from('analyses')
            .update({ user_id: targetUserId })
            .eq('file_path', filePath);
        }

        // Vérifier si cette identité a déjà été analysée par cet utilisateur
        const { data: existingAnalysis } = await supabase
          .from('analyses')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('nir_hash', nirHash)
          .eq('status', 'completed')
          .limit(1);

        const isNewIdentity = !existingAnalysis || existingAnalysis.length === 0;

        // Récupérer le profil pour vérifier les crédits
        const { data: profile } = await supabase
          .from('profiles')
          .select('analysis_credits, role')
          .eq('id', targetUserId)
          .single();

        const currentCredits = profile?.analysis_credits || 0;
        const isAdmin = profile?.role === 'admin' || (authenticatedUser && authenticatedUser.email === 'btsaulnerond@icloud.com');

        if (isAdmin || currentCredits > 0) {
          hasPremiumAccess = true;
        }

        if (isNewIdentity && !isAdmin && currentCredits > 0) {
          // Décompte sécurisé du crédit d'analyse
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ analysis_credits: currentCredits - 1 })
            .eq('id', targetUserId);
          
          if (updateError) {
            console.error("[Credits] Erreur décrémentation:", updateError.message);
          } else {
            console.log(`[Credits] -1 pour ${targetUserId}. Restant: ${currentCredits - 1}`);
          }
        }
      } catch (dbError) {
        console.error("[Credits] Erreur DB (droits ou colonnes manquantes):", dbError.message);
      }
    }

    // 6. Obfuscation & Rédaction Freemium (SEC-001)
    let clientResponse = analysisResults;

    if (!hasPremiumAccess) {
      clientResponse = JSON.parse(JSON.stringify(analysisResults));
      clientResponse.is_restricted = true;
      const rawAnomalies = clientResponse.anomalies || [];
      const currentYear = new Date().getFullYear();

      // Tri chronologique des anomalies pour identifier la plus ancienne et la plus récente
      const sortedAnomalies = [...rawAnomalies].sort((a, b) => {
        const yearA = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0');
        const yearB = parseInt(String(b.year).match(/\d{4}/)?.[0] || '0');
        return yearA - yearB;
      });

      const validAnomalies = sortedAnomalies.filter(a => {
        const year = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0');
        return year < currentYear;
      });

      // Identifier la plus ancienne et la plus récente
      const freemiumIndices = new Set();
      if (validAnomalies.length > 0) {
        const oldest = validAnomalies[0];
        const newest = validAnomalies[validAnomalies.length - 1];
        
        rawAnomalies.forEach((anom, idx) => {
          if (anom === oldest || anom === newest) {
            freemiumIndices.add(idx);
          }
        });
      }

      // Redacter les anomalies non freemium
      clientResponse.anomalies = rawAnomalies.map((anom, idx) => {
        if (freemiumIndices.has(idx)) {
          return {
            ...anom,
            is_premium: false
          };
        } else {
          return {
            year: anom.year || "Année masquée",
            severity: anom.severity || "medium",
            title: "Anomalie additionnelle détectée",
            description: "Débloquez votre bilan détaillé pour afficher cette anomalie ainsi que la solution corrective.",
            is_restricted: true,
            is_premium: true,
            employer: "Masqué (Premium)",
            reason: "Masqué (Premium)",
            solution: "Masqué (Premium)",
            docs: ["Pièces justificatives masquées"],
            salary: "Masqué",
            trimesters: "X/4",
            points: "X.XX"
          };
        }
      });
    }

    // 7. Mettre à jour la base de données
    const updateData = { 
      status: 'completed',
      results: analysisResults
    };
    if (targetUserId) updateData.user_id = targetUserId;

    try {
      await supabase
        .from('analyses')
        .update({ ...updateData, nir_hash: nirHash })
        .eq('file_path', filePath);
    } catch (e) {
      await supabase
        .from('analyses')
        .update(updateData)
        .eq('file_path', filePath);
    }

    return res.status(200).json(clientResponse);

  } catch (error) {
    console.error("CRITICAL API ERROR:", error);
    
    try {
      await supabase.from('analyses')
        .update({ status: 'failed', results: { error: error.message, stack: error.stack } })
        .eq('file_path', filePath);
    } catch (e) {
      console.error("Failed to log error to Supabase:", e.message);
    }

    return res.status(500).json({ 
      error: "L'analyse a échoué", 
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}
