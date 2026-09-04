import { getDb } from "./db.js";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";
import { buildRestrictedResults, resolvePremiumAccess } from "./analysisRestriction.js";
import { estimateMonthlyPension } from "./pensionEstimate.js";

export const maxDuration = 300;

const MISTRAL_API_URL = "https://api.mistral.ai";

async function mistralRequest(path, body) {
  const response = await fetch(`${MISTRAL_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erreur API Mistral (${response.status}): ${errText}`);
  }
  return response.json();
}

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

  const { filePath } = req.body;

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

    // Un résultat "completed" dégénéré (extraction passée précédemment vide malgré un
    // document valide) ne doit jamais être resservi indéfiniment : on force une nouvelle
    // analyse plutôt que d'afficher éternellement un bilan à 0 trimestre / 0 anomalie.
    const isDegenerateResult = (results) =>
      !(Number(results.trimestres_valides) > 0) &&
      (!Array.isArray(results.action_plan) || results.action_plan.length === 0) &&
      (!Array.isArray(results.anomalies) || results.anomalies.length === 0);

    if (
      analysisRecord &&
      analysisRecord.status === 'completed' &&
      analysisRecord.results &&
      !analysisRecord.results.is_restricted &&
      !isDegenerateResult(analysisRecord.results)
    ) {
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
<role>Tu es un outil d'extraction de données automatisé (Extracteur expert). Ta tâche exclusive est d'analyser le document PDF (Relevé de Carrière, RIS ou EIG) et d'en extraire deux tableaux distincts sans essayer de les fusionner.</role>

<instructions>
1. Repère le NIR (Numéro de Sécurité Sociale) pour valider le document.
2. Cherche dans le document (généralement au début, dans un encadré ou une synthèse) les totaux officiels : le nombre total de trimestres validés/enregistrés et le nombre de trimestres requis pour le taux plein.
3. Extrais le tableau de synthèse des trimestres par année (il liste toutes les années avec une colonne "Durée" ou "Trimestres" et parfois "Points"). Pour chaque ligne (année), extrait l'année, le total des trimestres validés, et la somme des points. Mets ces données dans "synthese_annees".
4. Extrais le tableau détaillé de carrière (il liste les périodes d'emploi avec employeur, date de début, date de fin, et revenus/salaires). Mets ces données dans "detail_employeurs".
</instructions>

<regles_strictes>
- ZERO HALLUCINATION : Ne fusionne pas les tableaux. N'invente rien.
- Si une colonne est vide, mets 0 (ou "N/A" pour les textes).
- Pour detail_employeurs, l'année de début (start_year) et de fin (end_year) doivent être déduites de "Date début" et "Date fin" (ex: "01/09/2000" => 2000). Si l'année est absente, déduis-la du contexte de la page.
- Copie exactement le revenu brut avec sa devise (ex: "3 744 FRF" ou "2 386 €").
- DÉDUPLICATION VITALE DES SALAIRES : Le document affiche souvent le MÊME salaire sur deux lignes pour la même année (ex: Régime Général ET AGIRC-ARRCO). Si tu vois le même salaire (ou très proche) pour la même année, ne l'extrais qu'une seule fois.
- EXHAUSTIVITÉ : Le document PDF comporte souvent de très nombreuses pages (jusqu'à 15 pages). Tu dois analyser et extraire ABSOLUMENT TOUTES LES ANNÉES ET TOUS LES EMPLOYEURS, de la toute première à la toute dernière année. Ne t'arrête pas à la première page.
</regles_strictes>
      `;

      const extractorSchema = {
        type: "object",
        properties: {
          is_valid_document: { type: "boolean", description: "True si le document est un relevé de carrière (RIS, EIG ou autre document de retraite officiel) valide, false sinon." },
          nir: { type: "string", description: "Numéro de sécurité sociale (sans les clés)." },
          total_trimestres_enregistres: { type: "integer", description: "Le nombre total de trimestres déjà enregistrés/validés par les différents régimes, indiqué globalement dans le document." },
          total_trimestres_requis: { type: "integer", description: "Le nombre total de trimestres requis/nécessaires pour pouvoir partir à taux plein, indiqué globalement dans le document." },
          synthese_annees: {
            type: "array",
            description: "Tableau de synthèse donnant le nombre total de trimestres par année (Durée tous régimes).",
            items: {
              type: "object",
              properties: {
                year: { type: "integer", description: "L'année (ex: 1998)" },
                trimesters: { type: "integer", description: "Nombre total de trimestres validés pour cette année (0 à 4)" },
                points: { type: "number", description: "Nombre de points de retraite acquis (ex: 34.5)" }
              },
              additionalProperties: false,
              required: ["year", "trimesters", "points"]
            }
          },
          detail_employeurs: {
            type: "array",
            description: "Tableau des employeurs avec dates de début, dates de fin et revenus.",
            items: {
              type: "object",
              properties: {
                employer: { type: "string", description: "Nom de l'employeur ou de l'activité (CHÔMAGE, MALADIE...)" },
                start_year: { type: "integer", description: "Année de début (ex: 2000)" },
                end_year: { type: "integer", description: "Année de fin (ex: 2001)" },
                salary: { type: "string", description: "Revenus bruts (exactement comme écrit, ex: '3 744 FRF', '25 €' ou 'N/A')" }
              },
              additionalProperties: false,
              required: ["employer", "start_year", "end_year", "salary"]
            }
          }
        },
        additionalProperties: false,
        required: ["is_valid_document", "nir", "synthese_annees", "detail_employeurs"]
      };

      const runExtraction = async () => {
        const ocrResult = await mistralRequest("/v1/ocr", {
          model: "mistral-ocr-latest",
          document: {
            type: "document_url",
            document_url: `data:application/pdf;base64,${base64Data}`
          },
          document_annotation_format: {
            type: "json_schema",
            json_schema: {
              name: "extraction_releve_carriere",
              schema: extractorSchema,
              strict: true
            }
          },
          document_annotation_prompt: extractorPrompt
        });
        return JSON.parse(ocrResult.document_annotation);
      };

      let extractedData = await runExtraction();
      if (!extractedData.is_valid_document) {
        throw new Error("Le document fourni n'est pas un relevé de carrière (RIS) officiel ou exploitable.");
      }

      // Un document valide doit contenir au moins un total global ou une synthèse par année.
      // Si l'extraction est vide malgré is_valid_document=true, l'IA a échoué silencieusement :
      // on retente une fois avant d'échouer explicitement plutôt que de produire un bilan à 0.
      const isExtractionEmpty = (data) =>
        !(data.total_trimestres_enregistres > 0) &&
        !(Array.isArray(data.synthese_annees) && data.synthese_annees.length > 0);

      if (isExtractionEmpty(extractedData)) {
        console.warn("[Extracteur] Extraction vide malgré un document valide, nouvelle tentative...");
        extractedData = await runExtraction();
        if (isExtractionEmpty(extractedData)) {
          throw new Error("L'extraction n'a pas pu identifier de données de trimestres dans ce document. Le fichier est peut-être illisible ou mal numérisé.");
        }
      }

      // --- AGENT 2 : CALCULATEUR (Code JS) ---
      console.log("Démarrage Agent 2 : Calculateur...");
      
      const synthese = extractedData.synthese_annees || [];
      const employeurs = extractedData.detail_employeurs || [];
      const carrieres = [];
      
      // Fusion (Merge) et conversion des devises
      synthese.forEach(s => {
        const year = parseInt(s.year);
        if (isNaN(year)) return;
        
        // Trouver tous les employeurs de cette année
        const activeEmp = employeurs.filter(e => parseInt(e.start_year) <= year && parseInt(e.end_year) >= year);
        
        let totalSalaryEur = 0;
        let empNames = new Set();
        let processedSalaries = []; // Empêcher la double-comptabilisation (Régime de base vs Complémentaire)
        
        activeEmp.forEach(emp => {
          if (emp.employer && emp.employer !== 'N/A') empNames.add(emp.employer);
          if (emp.salary && emp.salary !== 'N/A') {
            const isFrf = emp.salary.toUpperCase().includes('FRF') || emp.salary.toUpperCase().includes('F');
            let val = parseFloat(String(emp.salary).replace(/[^0-9,.-]+/g,"").replace(',', '.'));
            if (!isNaN(val)) {
               if (isFrf) {
                 val = val / 6.55957; // Conversion Francs en Euros
               }
               // Déduplication robuste : on ignore les salaires identiques (à 1€ près) dans la même année
               const isDuplicate = processedSalaries.some(s => Math.abs(s - val) < 1.0);
               if (!isDuplicate) {
                 totalSalaryEur += val;
                 processedSalaries.push(val);
               }
            }
          }
        });
        
        carrieres.push({
          year: year,
          employer: empNames.size > 0 ? Array.from(empNames).join(", ") : "Aucun",
          trimesters: s.trimesters || 0,
          points: s.points || 0,
          salary: totalSalaryEur > 0 ? totalSalaryEur.toFixed(2) : "N/A"
        });
      });

      let calculated_trimestres = 0;
      let rawAnomalies = [];
      let earliestYear = 9999;
      let latestYear = 0;
      let fallback_trimestres_requis = 172;
      
      if (extractedData.nir) {
        const cleanNirStr = extractedData.nir.replace(/\s/g, '');
        if (cleanNirStr.length >= 3) {
           const birthYearSuffix = parseInt(cleanNirStr.substring(1, 3));
           const birthYear = birthYearSuffix > 26 ? 1900 + birthYearSuffix : 2000 + birthYearSuffix;
           if (birthYear >= 1973) fallback_trimestres_requis = 172;
           else if (birthYear >= 1968) fallback_trimestres_requis = 172;
           else if (birthYear === 1967) fallback_trimestres_requis = 171;
           else if (birthYear >= 1964) fallback_trimestres_requis = 171;
           else fallback_trimestres_requis = 170;
        }
      }
      
      const currentYear = new Date().getFullYear();

      carrieres.forEach(c => {
        const y = parseInt(c.year);
        if (y > 1900 && y < 2100) {
          if (y < earliestYear) earliestYear = y;
          if (y > latestYear) latestYear = y;
        }
      });

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
            if (yd.employer && yd.employer !== "Aucun") employers.add(yd.employer);
            const sal = parseFloat(String(yd.salary).replace(/[^0-9.-]+/g,""));
            if (!isNaN(sal)) totalSalary += sal;
          });
          
          if (yearTrim > 4) yearTrim = 4;
          calculated_trimestres += yearTrim;
          
          if (yearTrim < 4 || yearPoints <= 0) {
             // Anomalie si et seulement si : moins de 4 trimestres, 0 point de retraite
             // complémentaire, ou année absente (CAS 5, gérée plus haut). Aucun autre critère
             // (salaire, présence d'un employeur) ne conditionne la remontée à l'Agent 3 — y
             // compris une année confirmée totalement vide (0 trimestre, 0 point, 0€), qui reste
             // une anomalie au même titre que les autres.
             rawAnomalies.push({
               year: y.toString(),
               employer: Array.from(employers).join(", ") || "Aucun",
               trimesters: yearTrim,
               points: yearPoints,
               salary: totalSalary > 0 ? totalSalary.toString() : "N/A",
               reason_code: yearTrim < 4 ? "Suspicion de trimestres manquants" : "Suspicion de points manquants"
             });
          }
        }
      }

      // Utiliser les totaux explicites extraits du document s'ils existent, sinon se rabattre sur le calcul
      let trimestres_valides = extractedData.total_trimestres_enregistres || calculated_trimestres;
      let trimestres_requis = extractedData.total_trimestres_requis || fallback_trimestres_requis;

      // --- AGENT 3 : RÉDACTEUR (IA) ---
      const careerUpToNow = carrieres.filter(c => parseInt(c.year) <= currentYear);
      const simplifiedCarrieres = careerUpToNow.map(c => ({
        year: c.year,
        employer: c.employer,
        salary: c.salary,
        trimesters: c.trimesters
      }));

      const totalPoints = careerUpToNow.reduce((sum, c) => sum + (parseFloat(c.points) || 0), 0);
      const pensionEstimate = estimateMonthlyPension({
        careerData: careerUpToNow,
        validatedQuarters: trimestres_valides,
        requiredQuarters: trimestres_requis,
        totalPoints
      });

      const writerPrompt = `
<role>Tu es le conseiller expert en retraite de RIS Pro. Tu rédiges le bilan final en te basant STRICTEMENT sur les données calculées.</role>

<contexte_et_donnees>
- Trimestres validés : ${trimestres_valides}
- Trimestres requis : ${trimestres_requis}
- Anomalies détectées (faits incontestables) : ${JSON.stringify(rawAnomalies)}
- Historique de carrière détaillé du client (pour personnaliser les stratégies) : ${JSON.stringify(simplifiedCarrieres)}
</contexte_et_donnees>

<estimation_pension>
Ces montants sont CALCULÉS (pas une estimation de ta part) — approximation simplifiée (sans revalorisation historique des salaires, sans plafond de sécurité sociale, sans décote/surcote) :
- Salaire Annuel Moyen (SAM), moyenne des 25 meilleures années : ${pensionEstimate.sam}€
- Pension de base annuelle estimée : ${pensionEstimate.base_pension_annual}€
- Pension complémentaire Agirc-Arrco annuelle estimée : ${pensionEstimate.complementary_pension_annual}€${pensionEstimate.complementary_pension_reliable ? '' : " (⚠️ mise à 0 : les points Agirc-Arrco extraits du document étaient incohérents avec le salaire, donnée à ne pas exploiter)"}
- ESTIMATION MENSUELLE TOTALE ACTUELLE : ${pensionEstimate.total_monthly_estimate}€/mois${pensionEstimate.complementary_pension_reliable ? '' : ' (base uniquement, hors complémentaire)'}
${pensionEstimate.complementary_pension_reliable ? '' : 'IMPORTANT : Dans le bilan, précise explicitement que la pension complémentaire Agirc-Arrco n\'a pas pu être estimée de façon fiable faute de points exploitables dans le document, et recommande au client de vérifier son relevé de points Agirc-Arrco directement.'}
</estimation_pension>

<regles_constitutionnelles>
1. Interdiction formelle de modifier les totaux calculés fournis (Trimestres validés, requis, et les montants de <estimation_pension>).
2. Les anomalies détectées (brutes) te sont fournies. Une anomalie apparaît SI ET SEULEMENT SI l'année a moins de 4 trimestres, 0 point de retraite complémentaire, ou est absente du relevé — ce tri est déjà fait en amont, AVANT que tu reçoives la liste. Tu DOIS conserver et enrichir TOUTES les anomalies brutes fournies ci-dessus, sans exception : tu n'as PAS le pouvoir d'en écarter une, quels que soient le salaire de l'année, le contexte (début de carrière, chômage, stage) ou ton propre jugement sur la plausibilité. Ta mission ici est uniquement de rédiger l'enrichissement de chaque anomalie fournie, jamais de décider si elle doit figurer ou non dans le bilan.
- Dans le champ 'reason' des anomalies "Suspicion de trimestres manquants" : n'indique JAMAIS un montant précis en euros ou en francs pour le SMIC ou le seuil d'une année qui n'est pas l'année en cours (${currentYear}) — tu n'as pas ces données historiques exactes en mémoire de façon fiable, et un chiffre inventé (même formulé avec assurance) induit le client en erreur. Décris le critère uniquement en termes qualitatifs (ex: "un salaire annuel jugé insuffisant au regard du SMIC en vigueur en [année]", "un trimestre nécessite un salaire minimal fixé par le SMIC en vigueur cette année-là"), jamais de valeur chiffrée du SMIC lui-même.
3. Le tableau JSON 'anomalies' doit contenir EXACTEMENT le même nombre d'entrées que la liste brute fournie ci-dessus — ni plus, ni moins. Une liste vide \`[]\` n'est possible QUE SI la liste brute fournie était elle-même vide.
4. Pour chaque anomalie, enrichis-la avec un titre professionnel, une description (le constat), une explication réglementaire (expliquant par exemple le seuil de validation du trimestre pour cette année-là), la solution, et les documents à réclamer au client. Conserve scrupuleusement l'année et les chiffres.
5. Ne mentionne JAMAIS les mots "agent", "IA", ou "algorithme". Utilise "expert", "bilan", "notre analyse".
6. Tu n'as PAS accès à internet. Fonde-toi EXCLUSIVEMENT sur les règles réglementaires fournies ci-dessous dans <regles_reglementaires> ; n'invente et ne suppose aucune loi ou seuil qui n'y figure pas.
</regles_constitutionnelles>

<regles_reglementaires>
1. L'âge d'annulation automatique de la décote est de 67 ans pour les générations nées en 1958 et après (Article L351-8 du CSS).
2. L'âge du taux plein cotisé est l'âge d'atteinte de ${trimestres_requis} trimestres.
${allRulesContent}
</regles_reglementaires>

<format_summary>
Le champ 'summary' DOIT être un 'BILAN RETRAITE' ou 'ANALYSE DE CARRIÈRE' exhaustif formaté en Markdown standard. Ne mentionne PAS le mot "Premium".
Rédige des paragraphes fluides, aérés, formels et humains. N'hésite pas à utiliser le gras (**) pour mettre en évidence les chiffres, les mots clés et les âges importants.
Bannis totalement les listes à puces (aucun tiret '-', aucune puce '•', aucun astérisque '*').
Dans le bilan, indique explicitement l'âge d'annulation de la décote à 67 ans.
TRÈS IMPORTANT : Le bilan textuel (summary) doit couvrir TOUTES les anomalies du tableau JSON 'anomalies' (elles y figurent toutes obligatoirement, cf. règle 3 ci-dessus). Si ce tableau est vide, indique explicitement dans le bilan qu'aucune erreur n'a été détectée.
</format_summary>

<strategies_et_plan>
Même si aucune anomalie n'a été détectée, tu DOIS IMPÉRATIVEMENT fournir AU MOINS 2 stratégies d'optimisation pertinentes (rachat de trimestres, cumul emploi-retraite, surcote, retraite progressive, etc.) dans le tableau 'strategies'. Adapte le nombre de stratégies à la richesse réelle de la carrière : une situation complexe (plusieurs statuts, anomalies multiples, carrière longue ou fragmentée) mérite davantage de stratégies (jusqu'à 5) qu'une carrière simple. Ne te limite JAMAIS artificiellement à 2 ou 3 si la situation du client en justifie plus.
Pour CHAQUE stratégie, renseigne obligatoirement le champ 'impact' avec un effet concret et exprimé UNIQUEMENT en trimestres validés, en mois/années de décote évités, ou en âge de départ anticipé (ex : "+8 trimestres validés", "Départ anticipé possible de 6 mois", "Passage de 172 à 164 trimestres requis pour le taux plein"). N'INDIQUE JAMAIS de montant en euros dans ce champ, même en partant de l'ESTIMATION MENSUELLE TOTALE ACTUELLE fournie dans <estimation_pension> — tu n'es pas fiable pour calculer toi-même une projection proportionnelle (un test réel a montré une erreur de plus de 30% sur ce type de calcul). Le seul montant en euros que tu peux citer dans TOUT le bilan est l'ESTIMATION MENSUELLE TOTALE ACTUELLE elle-même, reproduite telle quelle sans recalcul, jamais une valeur dérivée ou projetée. N'écris jamais une valeur vide ou générique comme "à déterminer".
Fournis également un 'action_plan' exhaustif avec des étapes claires pour préparer le départ à la retraite. Ne laisse jamais ces champs vides.
</strategies_et_plan>
      `;

      const writerSchema = {
        type: "object",
        properties: {
          anomalies: {
            type: "array",
            description: "Liste des anomalies enrichies",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                year: { type: "string" },
                employer: { type: "string" },
                title: { type: "string", description: "Titre synthétique du problème" },
                description: { type: "string", description: "Description courte (constat)" },
                reason: { type: "string", description: "Explication réglementaire" },
                solution: { type: "string", description: "Action de correction spécifique" },
                docs: { type: "array", items: { type: "string" }, description: "Documents justificatifs" },
                salary: { type: "string" },
                trimesters: { type: "string" },
                points: { type: "string" },
                severity: { type: "string", description: "high, medium, ou low" }
              },
              additionalProperties: false,
              required: ["year", "employer", "title", "description", "reason", "solution", "docs", "salary", "trimesters", "points", "severity"]
            }
          },
          summary: { type: "string", description: "BILAN RETRAITE PREMIUM rédigé en Markdown (sans listes à puces)." },
          strategies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string" },
                impact: { type: "string", description: "Impact concret exprimé en trimestres, en mois/années de décote évités, ou en âge de départ anticipé. JAMAIS de montant en euros (l'IA n'est pas fiable pour recalculer une projection monétaire). Ex: '+8 trimestres', 'Départ anticipé de 6 mois'." }
              },
              additionalProperties: false,
              required: ["title", "description", "priority", "impact"]
            }
          },
          action_plan: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "integer" },
                title: { type: "string" },
                description: { type: "string" }
              },
              additionalProperties: false,
              required: ["step", "title", "description"]
            }
          }
        },
        additionalProperties: false,
        required: ["anomalies", "summary", "strategies", "action_plan"]
      };

      const writerResult = await mistralRequest("/v1/chat/completions", {
        model: "mistral-large-latest",
        messages: [{ role: "user", content: writerPrompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "bilan_retraite",
            schema: writerSchema,
            strict: true
          }
        }
      });

      const writerData = JSON.parse(writerResult.choices[0].message.content);

      // Assemblage final
      analysisResults = {
        is_valid_document: true,
        nir: extractedData.nir,
        pension_estimate: pensionEstimate,
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
    const targetUserId = authenticatedUser?.id;

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

        const access = resolvePremiumAccess({ isAdmin, isNewIdentity, wasRestricted, currentCredits });
        hasPremiumAccess = access.hasPremiumAccess;

        if (access.shouldDeductCredit) {
          await pool.query(`UPDATE profiles SET analysis_credits = analysis_credits - 1 WHERE id = $1`, [targetUserId]);
        }
      } catch (dbError) {
        console.error("[Credits] Erreur DB:", dbError.message);
      }
    }

    let clientResponse = analysisResults;

    if (!hasPremiumAccess) {
      clientResponse = buildRestrictedResults(analysisResults);
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
