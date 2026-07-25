import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getDb } from "./db.js";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { filePath, userId } = req.body;

  const nirSalt = process.env.NIR_SALT;
  if (!nirSalt && process.env.NODE_ENV === 'production') {
    console.error("FATAL: NIR_SALT est manquant en production.");
    return res.status(500).json({ error: "Erreur de configuration serveur" });
  }
  const salt = nirSalt || 'ris_pro_v2_salt_2026';

  if (!filePath) {
    return res.status(400).json({ error: 'Chemin du fichier manquant' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  let authenticatedUser = null;

  if (token) {
    try {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const verified = await clerk.verifyToken(token);
      if (verified && verified.sub) {
        authenticatedUser = { id: verified.sub };
      }
    } catch (authErr) {
      console.error("[Auth] Échec de la vérification du token JWT:", authErr.message);
    }
  }

  const pool = getDb();
  let dbFilePath = filePath;

  try {
    const { rows: analysisRows } = await pool.query(
      `SELECT user_id, status, file_path, results FROM analyses WHERE file_path = $1 LIMIT 1`,
      [filePath]
    );
    
    const analysisRecord = analysisRows.length > 0 ? analysisRows[0] : null;
    dbFilePath = analysisRecord?.file_path || filePath;

    if (!analysisRecord) {
      return res.status(404).json({ error: 'Document introuvable dans la base de données' });
    }

    if (analysisRecord.user_id && (!authenticatedUser || authenticatedUser.id !== analysisRecord.user_id)) {
      let isAdmin = false;
      if (authenticatedUser) {
        const { rows: profileRows } = await pool.query(`SELECT role FROM profiles WHERE id = $1 LIMIT 1`, [authenticatedUser.id]);
        if (profileRows.length > 0 && profileRows[0].role === 'admin') isAdmin = true;
      }
      if (!isAdmin) return res.status(403).json({ error: 'Accès non autorisé à ce document' });
    }

    let base64Data;
    try {
      const { rows } = await pool.query('SELECT file_base64 FROM analyses WHERE file_path = $1 LIMIT 1', [dbFilePath]);
      if (rows.length > 0 && rows[0].file_base64) base64Data = rows[0].file_base64;
      else throw new Error("Contenu du fichier introuvable dans la base de données.");
    } catch (dbErr) {
      throw new Error(`Impossible de récupérer le contenu du fichier: ${dbErr.message}`);
    }

    let analysisResults = null;

    if (analysisRecord && analysisRecord.status === 'completed' && analysisRecord.results && !analysisRecord.results.is_restricted) {
      analysisResults = analysisRecord.results;
    } else {
      
      const fs = await import('fs');
      const path = await import('path');
      
      const allRuleFiles = [
        "regles_conge_naissance.md",
        "regles_cumul_emploi_retraite_createur_droits.md",
        "regles_depart_anticipe_2023.md",
        "regles_expatriation_internationale.md",
        "regles_gestion_retraite_2023.md",
        "regles_independants_fonctionnaires.md",
        "regles_minima_sociaux_aspa.md",
        "regles_nouveau_conge_naissance_retraite.md",
        "regles_optimisation_retraite_2023.md",
        "regles_pension_reversion_2023.md",
        "regles_polypensionnes_lura.md",
        "regles_retraite_progressive_60_ans.md"
      ];

      const getRuleContent = (filename) => {
        const paths = [
          path.join(process.cwd(), filename),
          path.join(process.cwd(), '..', filename)
        ];
        for (const p of paths) {
          if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
        }
        return "";
      };

      let allRulesContent = "";
      for (const file of allRuleFiles) {
        allRulesContent += getRuleContent(file) + "\n\n";
      }

      // --- AGENT 1 : EXTRACTEUR (IA) ---
      console.log("Démarrage Agent 1 : Extracteur...");
      const extractorPrompt = `
<role>Tu es un outil d'extraction de données automatisé (Extracteur expert). Ta tâche exclusive est d'analyser le document PDF (Relevé de Carrière, RIS ou EIG) et d'en extraire les données brutes avec une précision absolue, sans aucune interprétation.</role>

<instructions>
1. Repère le NIR (Numéro de Sécurité Sociale) pour valider le document.
2. Parcourt le document année par année, ligne par ligne.
3. Pour chaque ligne de carrière, extrais l'année, le nom de l'employeur (ou la nature: Chômage, Maladie, Service Militaire), les trimestres validés (ou "trimestres retenus"), les points de retraite complémentaire, et le revenu/salaire brut.
</instructions>

<regles_strictes>
- ZERO HALLUCINATION : N'invente jamais une année ou un employeur. Si la page est illisible, n'invente rien.
- Sépare bien les lignes si une année comporte plusieurs employeurs.
- Si une colonne est vide, absente, ou non chiffrée pour une ligne spécifique : 
  - Trimestres : 0
  - Points : 0.0
  - Salaire : "N/A"
- Ne consolide pas les lignes, n'additionne pas, copie fidèlement le tableau.
</regles_strictes>

<few_shot_example>
Si tu lis "1998 | Renault | 4 | 125,40 | 15000", tu dois renvoyer :
{"year": 1998, "employer": "Renault", "trimesters": 4, "points": 125.40, "salary": "15000"}
</few_shot_example>
      `;

      const extractorSchema = {
        type: SchemaType.OBJECT,
        properties: {
          is_valid_document: { type: SchemaType.BOOLEAN, description: "True si le document est un relevé de carrière (RIS ou EIG) valide, false sinon." },
          nir: { type: SchemaType.STRING, description: "Numéro de sécurité sociale (sans les clés)." },
          carrieres: {
            type: SchemaType.ARRAY,
            description: "Liste de toutes les années travaillées extraites",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                year: { type: SchemaType.INTEGER, description: "L'année (ex: 1998)" },
                employer: { type: SchemaType.STRING, description: "Nom de l'employeur ou nature de l'activité" },
                trimesters: { type: SchemaType.INTEGER, description: "Nombre de trimestres validés pour cette année (0 à 4)" },
                points: { type: SchemaType.NUMBER, description: "Nombre de points de retraite acquis" },
                salary: { type: SchemaType.STRING, description: "Salaire brut ou 'N/A' si absent" }
              },
              required: ["year", "employer", "trimesters", "points", "salary"]
            }
          }
        },
        required: ["is_valid_document", "nir", "carrieres"]
      };

      const extractorModel = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro",
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: extractorSchema 
        }
      });

      const extractorResult = await extractorModel.generateContent([
        { inlineData: { data: base64Data, mimeType: "application/pdf" } },
        { text: extractorPrompt }
      ]);

      const extractedData = JSON.parse(extractorResult.response.text());
      if (!extractedData.is_valid_document) {
        throw new Error("Le document fourni n'est pas un relevé de carrière (RIS) officiel ou exploitable.");
      }

      // --- AGENT 2 : CALCULATEUR (Code JS) ---
      console.log("Démarrage Agent 2 : Calculateur...");
      let trimestres_valides = 0;
      let trimestres_requis = 172; 
      let rawAnomalies = [];
      let earliestYear = 9999;
      let latestYear = 0;

      if (extractedData.nir) {
        const cleanNirStr = extractedData.nir.replace(/\s/g, '');
        if (cleanNirStr.length >= 3) {
           const birthYearSuffix = parseInt(cleanNirStr.substring(1, 3));
           const birthYear = birthYearSuffix > 26 ? 1900 + birthYearSuffix : 2000 + birthYearSuffix;
           if (birthYear >= 1973) trimestres_requis = 172;
           else if (birthYear >= 1968) trimestres_requis = 172;
           else if (birthYear === 1967) trimestres_requis = 171;
           else if (birthYear >= 1964) trimestres_requis = 171;
           else trimestres_requis = 170;
        }
      }

      const carrieres = extractedData.carrieres || [];
      carrieres.forEach(c => {
        const y = parseInt(c.year);
        if (y > 1900 && y < 2100) {
          if (y < earliestYear) earliestYear = y;
          if (y > latestYear) latestYear = y;
        }
      });

      const currentYear = new Date().getFullYear();

      if (earliestYear < 9999) {
        for (let y = earliestYear; y <= latestYear; y++) {
          if (y >= currentYear) continue; // Exclure l'année en cours
          
          const yearsData = carrieres.filter(c => parseInt(c.year) === y);
          if (yearsData.length === 0) {
            rawAnomalies.push({
              year: y.toString(),
              employer: "Aucun",
              trimesters: 0,
              points: 0,
              salary: "0",
              reason_code: "CAS 5: Année absente du relevé"
            });
            continue;
          }
          
          let yearTrim = 0;
          let yearPoints = 0;
          let employers = new Set();
          let totalSalary = 0;
          
          yearsData.forEach(yd => {
            yearTrim += parseInt(yd.trimesters) || 0;
            yearPoints += parseFloat(yd.points) || 0;
            if (yd.employer) employers.add(yd.employer);
            const sal = parseFloat(String(yd.salary).replace(/[^0-9.-]+/g,""));
            if (!isNaN(sal)) totalSalary += sal;
          });
          
          if (yearTrim > 4) yearTrim = 4;
          trimestres_valides += yearTrim;
          
          if (yearTrim < 4 || yearPoints <= 0) {
             if (totalSalary > 0 || yearTrim > 0 || yearPoints > 0) {
               // Filtrage intelligent : on ne remonte au LLM que les années avec une vraie incohérence mathématique
               const isPotentialAnomaly = 
                  (totalSalary > 1500 && yearTrim === 0) || 
                  (totalSalary > 6000 && yearTrim < 4) ||
                  (totalSalary > 2000 && yearPoints === 0) || 
                  (yearTrim === 0 && employers.size > 0 && Array.from(employers)[0] !== "Aucun");

               if (isPotentialAnomaly) {
                 rawAnomalies.push({
                   year: y.toString(),
                   employer: Array.from(employers).join(", "),
                   trimesters: yearTrim,
                   points: yearPoints,
                   salary: totalSalary > 0 ? totalSalary.toString() : "N/A",
                   reason_code: yearTrim < 4 ? "Suspicion de trimestres manquants (salaire significatif)" : "Suspicion de points manquants (salaire significatif)"
                 });
               }
             }
          }
        }
      }

      // --- AGENT 3 : RÉDACTEUR (IA) ---
      console.log("Démarrage Agent 3 : Rédacteur...");
      const writerPrompt = `
<role>Tu es le conseiller expert en retraite de RIS Pro. Tu rédiges le bilan final en te basant STRICTEMENT sur les données calculées.</role>

<contexte_et_donnees>
- Trimestres validés : ${trimestres_valides}
- Trimestres requis : ${trimestres_requis}
- Anomalies détectées (faits incontestables) : ${JSON.stringify(rawAnomalies)}
</contexte_et_donnees>

<regles_constitutionnelles>
1. Interdiction formelle de modifier les totaux calculés fournis (Trimestres validés, requis).
2. Les anomalies détectées (brutes) te sont fournies. Ton rôle est de les ANALYSER et de NE CONSERVER QUE LES VÉRITABLES ERREURS de l'administration. 
- Règle A : Moins de 4 trimestres N'EST PAS une anomalie si le salaire est faible ou si c'est une année incomplète logique (début de carrière, chômage, stage). Un trimestre nécessite environ 150h au SMIC (soit environ 1500€). Si le salaire de l'année justifie moins de 4 trimestres, IGNORE l'anomalie.
- Règle B : Ne garde une anomalie "Moins de 4 trimestres" QUE SI le salaire est manifestement assez élevé pour justifier plus de trimestres.
- Règle C : Ne garde une anomalie "0 point" QUE SI le régime du travailleur attribue normalement des points (ex: cadre, salarié privé) et que le salaire est significatif.
3. Tu ne dois renvoyer dans le JSON QUE les anomalies que tu estimes pertinentes et justifiées après ton tri d'expert. Il est tout à fait normal de renvoyer une liste vide \`[]\` si aucune anomalie n'est avérée.
4. Pour chaque anomalie retenue, enrichis-la avec un titre professionnel, une description (le constat), une explication réglementaire (expliquant par exemple le seuil de validation du trimestre pour cette année-là), la solution, et les documents à réclamer au client. Conserve scrupuleusement l'année et les chiffres.
5. Ne mentionne JAMAIS les mots "agent", "IA", ou "algorithme". Utilise "expert", "bilan", "notre analyse".
6. Si tu utilises ta capacité de recherche Google pour vérifier ou compléter une loi, tu as l'OBLIGATION ABSOLUE de te restreindre aux sources officielles (Journal officiel, legifrance.gouv.fr, lassuranceretraite.fr, info-retraite.fr, Ircantec, SRE, agirc-arrco.fr). Ajoute 'site:legifrance.gouv.fr OR site:lassuranceretraite.fr' à tes recherches si nécessaire. N'utilise AUCUNE information provenant d'un blog, forum ou site commercial.
</regles_constitutionnelles>

<regles_reglementaires>
1. L'âge d'annulation automatique de la décote est de 67 ans pour les générations nées en 1958 et après (Article L351-8 du CSS).
2. L'âge du taux plein cotisé est l'âge d'atteinte de ${trimestres_requis} trimestres.
${allRulesContent}
</regles_reglementaires>

<format_summary>
Le champ 'summary' DOIT être un 'BILAN RETRAITE PREMIUM' exhaustif formaté en Markdown. 
Rédige des paragraphes fluides, aérés, formels et humains.
Bannis totalement les listes à puces (aucun tiret '-', aucune puce '•', aucun astérisque '*'). 
N'utilise jamais d'astérisques (**) pour le gras. Utilise EXCLUSIVEMENT la balise HTML <strong>texte</strong> pour mettre en évidence les mots clés, âges et trimestres.
Dans le bilan, indique explicitement l'âge d'annulation de la décote à 67 ans.
</format_summary>

<strategies_et_plan>
Même si aucune anomalie n'a été détectée, tu DOIS IMPÉRATIVEMENT fournir 2 à 3 stratégies d'optimisation (rachat de trimestres, cumul emploi-retraite, surcote, retraite progressive, etc.) dans le tableau 'strategies', et un 'action_plan' exhaustif avec des étapes claires pour préparer le départ à la retraite. Ne laisse jamais ces champs vides.
</strategies_et_plan>
      `;

      const writerSchema = {
        type: SchemaType.OBJECT,
        properties: {
          anomalies: {
            type: SchemaType.ARRAY,
            description: "Liste des anomalies enrichies",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                year: { type: SchemaType.STRING },
                employer: { type: SchemaType.STRING },
                title: { type: SchemaType.STRING, description: "Titre synthétique du problème" },
                description: { type: SchemaType.STRING, description: "Description courte (constat)" },
                reason: { type: SchemaType.STRING, description: "Explication réglementaire" },
                solution: { type: SchemaType.STRING, description: "Action de correction spécifique" },
                docs: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Documents justificatifs" },
                salary: { type: SchemaType.STRING },
                trimesters: { type: SchemaType.STRING },
                points: { type: SchemaType.STRING },
                severity: { type: SchemaType.STRING, description: "high, medium, ou low" }
              },
              required: ["year", "employer", "title", "description", "reason", "solution", "docs", "salary", "trimesters", "points", "severity"]
            }
          },
          summary: { type: SchemaType.STRING, description: "BILAN RETRAITE PREMIUM rédigé en Markdown (sans listes à puces)." },
          strategies: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                priority: { type: SchemaType.STRING }
              },
              required: ["title", "description", "priority"]
            }
          },
          action_plan: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                step: { type: SchemaType.INTEGER },
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              },
              required: ["step", "title", "description"]
            }
          }
        },
        required: ["anomalies", "summary", "strategies", "action_plan"]
      };

      const writerModel = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: writerSchema 
        }
      });

      const writerResult = await writerModel.generateContent(writerPrompt);

      const writerData = JSON.parse(writerResult.response.text());

      // Assemblage final
      analysisResults = {
        is_valid_document: true,
        nir: extractedData.nir,
        trimestres_valides: trimestres_valides,
        trimestres_requis: trimestres_requis,
        anomalies: writerData.anomalies || [],
        summary: writerData.summary || "",
        strategies: writerData.strategies || [],
        action_plan: writerData.action_plan || []
      };

      console.log("Analyse à 3 agents réussie !");
    }

    const cleanNir = (analysisResults.nir || "").replace(/\s/g, '') || "000000000000000";
    const nirHash = crypto.createHash('sha256').update(cleanNir + salt).digest('hex');

    let hasPremiumAccess = false;
    const targetUserId = authenticatedUser?.id || userId;

    if (targetUserId) {
      try {
        if (analysisRecord && !analysisRecord.user_id) {
          await pool.query(`UPDATE analyses SET user_id = $1 WHERE file_path = $2`, [targetUserId, dbFilePath]);
        }
        const { rows: existingAnalysisList } = await pool.query(
          `SELECT id, results FROM analyses WHERE user_id = $1 AND nir_hash = $2 AND status = 'completed' LIMIT 1`,
          [targetUserId, nirHash]
        );
        const existingAnalysis = existingAnalysisList.length > 0 ? existingAnalysisList[0] : null;
        const isNewIdentity = !existingAnalysis;
        const wasRestricted = existingAnalysis && existingAnalysis.results && existingAnalysis.results.is_restricted === true;

        const { rows: profileRows } = await pool.query(`SELECT analysis_credits, role, email FROM profiles WHERE id = $1 LIMIT 1`, [targetUserId]);
        const profile = profileRows.length > 0 ? profileRows[0] : null;
        let currentCredits = profile?.analysis_credits || 0;
        const isAdmin = profile?.role === 'admin' || profile?.email === 'btsaulnerond@icloud.com';

        if (isAdmin || currentCredits > 0) hasPremiumAccess = true;

        if (!isAdmin && currentCredits > 0 && (isNewIdentity || wasRestricted)) {
          await pool.query(`UPDATE profiles SET analysis_credits = analysis_credits - 1 WHERE id = $1`, [targetUserId]);
        }
      } catch (dbError) {
        console.error("[Credits] Erreur DB:", dbError.message);
      }
    }

    let clientResponse = analysisResults;

    if (!hasPremiumAccess) {
      clientResponse = JSON.parse(JSON.stringify(analysisResults));
      clientResponse.is_restricted = true;
      const rawAnomalies = clientResponse.anomalies || [];
      const currentYear = new Date().getFullYear();

      const sortedAnomalies = [...rawAnomalies].sort((a, b) => {
        const yearA = parseInt(String(a.year).match(/\d{4}/)?.[0] || '0');
        const yearB = parseInt(String(b.year).match(/\d{4}/)?.[0] || '0');
        return yearA - yearB;
      });

      const validAnomalies = sortedAnomalies.filter(a => parseInt(String(a.year).match(/\d{4}/)?.[0] || '0') < currentYear);

      const freemiumIndices = new Set();
      if (validAnomalies.length > 0) {
        freemiumIndices.add(rawAnomalies.indexOf(validAnomalies[0]));
        freemiumIndices.add(rawAnomalies.indexOf(validAnomalies[validAnomalies.length - 1]));
      }

      clientResponse.anomalies = rawAnomalies.map((anom, idx) => {
        if (freemiumIndices.has(idx)) {
          return { ...anom, is_premium: false };
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

    const dbResults = { ...analysisResults };
    if (!hasPremiumAccess) dbResults.is_restricted = true;
    else delete dbResults.is_restricted;

    try {
      await pool.query(
        `UPDATE analyses SET status = $1, results = $2, nir_hash = $3, user_id = COALESCE($4, user_id), updated_at = NOW() WHERE file_path = $5`,
        ['completed', JSON.stringify(dbResults), nirHash, targetUserId, dbFilePath]
      );
    } catch (e) {
      console.error("Erreur mise à jour analyse completed :", e);
    }

    return res.status(200).json(clientResponse);

  } catch (error) {
    console.error("CRITICAL API ERROR:", error);
    try {
      await pool.query(
        `UPDATE analyses SET status = 'failed', results = $1, updated_at = NOW() WHERE file_path = $2`,
        [JSON.stringify({ error: error.message }), dbFilePath]
      );
    } catch (e) {}

    return res.status(500).json({ error: "L'analyse a échoué", message: error.message });
  }
}
