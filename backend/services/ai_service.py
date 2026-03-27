import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "deepseek-r1:14b"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

def is_valid_json(text: str) -> bool:
    """Vérifie si la réponse ressemble à un JSON valide."""
    if not text: return False
    text = text.strip()
    return text.startswith("{") and text.endswith("}")

def strip_markdown(data):
    """Supprime les astérisques de formatage Markdown récursivement."""
    if isinstance(data, str):
        return data.replace("**", "")
    elif isinstance(data, list):
        return [strip_markdown(item) for item in data]
    elif isinstance(data, dict):
        return {k: strip_markdown(v) for k, v in data.items()}
    return data

async def generate_ai_audit(anomalies: list, filename: str, raw_text: str = "", images: list = None, career_data: list = None, **kwargs):
    """
    Routage Expertise Adaptatif (Stabilité & Quotas) + Détection Justinificatifs Exhaustive.
    """
    from datetime import datetime
    current_year = datetime.now().year
    target_year = current_year - 1

    if not raw_text and not anomalies and not (images and len(images)>0):
        return json.dumps({
            "anomalie_detectee": "non",
            "niveau_risque": "faible",
            "resume_global": "Aucune donnée disponible pour l'analyse.",
            "premiere_annee": "N/A",
            "derniere_annee": "N/A",
            "full_timeline": [],
            "compte_rendu": ""
        })

    if not raw_text:
        raw_text = "\n".join([f"- {a['title']}: {a['description']}" for a in anomalies])
    
    is_scan = (images is not None and len(images) > 0)
    vision_mode_desc = """⚠️ MODE VISION ACTIVÉ : Tu analyses des IMAGES (scans ou photos).
- **CONSIGNE VISION :** Les documents peuvent être de travers, flous ou avoir un faible contraste.
- **EXTRACTION :** Analyse très précisément chaque ligne du tableau de carrière. Si tu vois une année, regarde les colonnes à droite pour les trimestres et les points.
- **IDENTITÉ :** Cherche le nom de l'assuré en haut des pages (près de 'Nom d'usage' ou 'Prénom').
- **TABLEAUX :** Fais attention aux décalages visuels. L'année est à gauche, l'employeur au milieu, les trimestres/points à droite.""" if is_scan else ""
    
    # --- Expert Calculation Engine Integration ---
    from services.rules_engine import RetirementRulesEngine
    
    # 1. Perform automated verification for each year if career_data is present
    expert_audit_notes = []
    reliability_score = 100
    career_projection = {}
    
    # NOTE: `career_data` is now passed as an argument.
    birth_year = kwargs.get("birth_year", 1980)
    
    if career_data:
        verified_periods = []
        for entry in career_data:
            year = entry.get("year")
            salary = entry.get("salary", 0.0)
            ris_pts = entry.get("ris_points", 0.0)
            
            if salary > 0:
                calc_res = RetirementRulesEngine.calculate_theoretical_points(salary, year)
                theo_pts = calc_res.get("points", 0.0)
                verified_periods.append({
                    "year": year,
                    "ris_points": ris_pts,
                    "theo_points": theo_pts
                })
                
                # If significant delta, add to expert notes
                if abs(ris_pts - theo_pts) > 1.0:
                    expert_audit_notes.append(f"Année {year} : Écart détecté. Points RIS: {ris_pts} vs Théorie: {theo_pts} (Basé sur salaire de {salary}€)")

        reliability_score = RetirementRulesEngine.get_reliability_score(verified_periods)
        
        # 2. Career Projection (Expert: uses birth year and total quarters)
        if career_data:
            last_entry = career_data[-1]
            total_q = sum(e.get("ris_quarters", 0) for e in career_data)
            
            total_pts = sum(e.get("ris_points", 0.0) for e in career_data)
            projection = RetirementRulesEngine.project_future_career(
                total_points=total_pts,
                birth_year=birth_year,
                current_salary=last_entry.get("salary", 40000.0),
                current_quarters=total_q
            )
            
            # Technical Pension Estimate based on consolidated formulas
            sam = RetirementRulesEngine.calculate_sam(career_data)
            base_pension = RetirementRulesEngine.calculate_base_pension(
                sam, 
                projection.get("projected_quarters", total_q),
                projection.get("required_quarters", 172)
            )
            
            # Agirc-Arrco value from rules engine or default
            service_val = 1.4386
            resource_2025 = RetirementRulesEngine.RETIREMENT_RESOURCES.get(2025, {})
            if isinstance(resource_2025, dict) and "unified" in resource_2025:
                service_val = float(resource_2025["unified"].get("service", 1.4386))
            
            comp_pension = RetirementRulesEngine.calculate_complementary_pension(
                projection.get("projected_points", total_pts),
                float(service_val)
            )
            
            total_monthly_pension = (base_pension + comp_pension) / 12.0
            career_projection = {
                **projection,
                "technical_monthly_estimate": round(float(total_monthly_pension), 2),
                "sam": round(float(sam), 2)
            }

    expert_context = f"""
**RÈGLES AGIRC-ARRCO (RÉFÉRENTIEL RÉGLEMENTAIRE) :**
- Les points sont calculés sur le SALAIRE DE CALCUL (Tranche 1 : 6,20%, Tranche 2 : 17%).
- Le TAUX D'APPEL est de 127% (ce surplus ne génère pas de points).
- Valeur d'achat du point (2025: 19,6321€ | 2024: 18,7669€ | 2023: 17,4316€).
- PASS (Plafond Sécu) : 2025: 47 100€ | 2024: 46 368€ | 2023: 43 992€.

**SYSTÈME DE RETRAITE (RÉFORME 2023) :**
- Âge légal de départ : {career_projection.get('legal_age_display', '64 ans')} pour la génération {birth_year}.
- Trimestres requis pour le taux plein : {career_projection.get('required_quarters', 172)}.
- Situation projetée : {career_projection.get('projected_quarters', 0)} trimestres à l'âge légal.

**VÉRIFICATION EXPERTE (RÉSULTATS DU MOTEUR) :**
- Score de fiabilité globale : {reliability_score}/100
- Salaire Annuel Moyen (SAM) calculé : {career_projection.get('sam', 0)}€
- Projection estimée (Total) : {career_projection.get('technical_monthly_estimate', 'N/A')}€ / mois à l'âge légal.
- Base : {round(float(base_pension/12.0), 2) if 'base_pension' in locals() else 'N/A'}€ | Complémentaire : {round(float(comp_pension/12.0), 2) if 'comp_pension' in locals() else 'N/A'}€
- Taux plein : {"Oui" if career_projection.get("has_full_rate", False) else "Non (Décote estimée de " + str(career_projection.get("malus_applied", 0)) + "% sur Agirc-Arrco)"}
- Notes d'audit : {" | ".join(expert_audit_notes) if expert_audit_notes else "Aucun écart majeur détecté sur les salaires déclarés."}
"""

    prompt = f"""Tu es l'expert retraite de Hologram Conseils. Analyse ce Relevé Individuel de Situation (RIS) pour identifier précisément les anomalies et les justificatifs de régularisation ({filename}).
{vision_mode_desc}

{expert_context}

**MISSION ET PÉRIODE D’ANALYSE :**
- Analyse la carrière de la toute première activité détectée jusqu'à l'année **{target_year}** (N-1 par rapport à aujourd'hui).
- **RECALCUL DES DROITS :** Utilise les notes d'audit expertes fournies pour signaler les années où les points RIS ne correspondent pas aux salaires déclarés.
- **ANALYSE DES ASSIMILÉS :** Vérifie impérativement si les périodes de chômage ou maladie sont bien suivies de points.
- **SCORE DE FIABILITÉ :** Intègre le score de fiabilité dans ton résumé global.
- **CHRONOLOGIE :** Présente systématiquement les anomalies par ordre chronologique, de la plus ancienne à la plus récente.

- **RÉGIMES COMPLÉMENTAIRES EST ESSENTIEL :** Ne te limite pas au régime de base (trimestres). Analyse impérativement les régimes complémentaires (Agirc-Arrco, Ircantec, RAFP, RCI, etc.) et les POINTS acquis.
- **DÉTECTION HORS TRIMESTRES :** Signale systématiquement si des points apparaissent sur une année sans trimestres, ou si une activité salariée connue n'affiche pas de points complémentaires.
- **CHRONOLOGIE :** Présente systématiquement les anomalies par ordre chronologique, de la plus ancienne à la plus récente.

**RÈGLES DE RÉDACTION (STRICTES ET CRITIQUES) :**
- **INTRODUCTION PERSONNALISÉE :** Détecte le nom et prénom de l'assuré. Commencez impérativement ton `resume_global` par une phrase d'accueil DIRECTE citant son identité (ex: "Bonjour [Prénom] [Nom], j'ai analysé votre situation..."). **INTERDICTION DE METTRE UNE PUCE (•) DEVANT CETTE PREMIÈRE PHRASE.**
- Ne mentionne JAMAIS ton mode de fonctionnement technique. Parle exclusivement en tant qu'expert retraite de Hologram Conseils.
- Utilise une langue française impeccable, sans aucune faute d'orthographe, de syntaxe ou de grammaire.
- Respecte scrupuleusement l'usage des apostrophes françaises (ex: l'obtention, d'une, n'est, l'année, d'apprentissage).
- **INTERDICTION FORMELLE DE FORMATAGE MARKDOWN** : N'utilise JAMAIS d'astérisques (**) pour mettre en gras, de dièses (#) pour les titres, ou de tout autre symbole de formatage technique. Le texte doit être du texte brut pur et professionnel.
- **STRUCTURE DES LISTES :** Après l'introduction, pour `resume_global`, `compte_rendu` et `justificatif_suggere`, tu DOIS utiliser des listes à puces (•). Chaque point DOIT être sur sa propre ligne.

**RÈGLES D'ANALYSE DE L'EXPERT (LOGIQUE DE DÉTECTION SUR SCAN) :**
1. **IDENTIFICATION DES EMPLOYÉURS** : Le nom de l'EMPLOYEUR ou de l'activité est toujours sur la ligne du DESSUS par rapport aux informations de dates et revenus.
2. **DÉTECTION DES TROUS** : Si une année X est présente mais que l'année X+1 ou X+2 est totalement absente du tableau de détail ALORS QUE l'assuré n'est pas encore à la retraite, signale une année "manquante" comme anomalie.
3. **VÉRIFICATION DES TRIMESTRES** : Si une année affiche moins de 4 trimestres, elle est "incomplet". Si elle affiche 0, elle est "manquant".
4. **RÉGIMES PUBLICS** : Contractuel Université/CROUS/Mairie = **IRCANTEC**.

**STATUTS DE L'ANALYSE :**
- 4 trimestres = **complet**
- 1-3 trimestres = **incomplet**
- 0 trimestre ou année absente = **manquant**

**RÈGLES MÉTIER CRITIQUES (Régimes Publics) :**
- Fonctionnaire État ➔ **SRE**
- Fonctionnaire territorial / hospitalier ➔ **CNRACL**
- Contractuel public ➔ **IRCANTEC** (inclut : Universités, CROUS, Mairies)

Lors de l'analyse, impute systématiquement les points au bon régime selon le statut.
9. **EXPLOITATION DES POINTS** : Si le RIS affiche des points Agirc-Arrco, Ircantec ou autres, ils doivent être cités et analysés comme preuve d'activité, même en l'absence de trimestres validés.

--- 📄 CHECKLIST DES PIÈCES À FOURNIR (Source Experte) ---
Selon l'anomalie détectée, tu DOIS suggérer les documents suivants :

1. ANNÉES VIDES OU TOTALEMENT ABSENTES DU RIS :
   - "Attestation sur l'honneur d'activité ou de non activité pour la période concernée"
   - ET soit : "Justificatif d'activité déclarée (Bulletin de salaire, Contrat)"
   - OU : "Attestation de non-activité pour la période concernée"

2. ACTIVITÉ SALARIÉE (Année incomplète) :
   - Priorité : "Bulletins de salaire, Certificats de travail, Contrats de travail"
   - Si entreprise disparue : "Attestation AGS ou Jugement de liquidation"

3. INDÉPENDANTS / NON SALARIÉ :
   - "Extrait Kbis, Attestation URSSAF, Déclarations fiscales professionnelles"

4. PÉRIODES D'INACTIVITÉ (France) :
   - Chômage : "Attestation Pôle Emploi (Historique d'indemnisation)"
   - Maladie / Maternité : "Attestation CPAM, Relevés d'Indemnités Journalières (IJSS)"
   - Congé Parental : "Attestation CAF et Attestation employeur"
   - Service National : "État signalétique et des services ou Livret militaire"

5. ACTIVITÉ À L'ÉTRANGER :
   - Union Européenne (UE/EEE) : "Formulaire européen E205 / P5000"
   - HORS Union Européenne : "Certificats d'emploi locaux, Bulletins de salaire étrangers, Preuve de résidence à l'étranger"

Format de sortie attendu (JSON valide) :
{{
  "anomalie_detectee": "oui/non",
  "niveau_risque": "faible/moyen/élevé",
  "resume_global": "• Premier point\\n• Deuxième point...",
  "premiere_annee": "XXXX",
  "derniere_annee": "XXXX",
  "full_timeline": [
    {{
      "annee": "XXXX",
      "statut": "manquant/incomplet",
      "trimestres_valides": N,
      "points_complementaires": N,
      "activite": "Employeur / Statut",
      "anomalie_specifique": "Explication rapide",
      "justificatif_suggere": "• Premier justificatif\\n• Deuxième justificatif"
    }}
  ],
  "compte_rendu": "• Observation 1\\n• Observation 2"
}}

**CONSIGNE DE RAPIDITÉ :** Ne génère un élément dans `full_timeline` QUE si c'est une anomalie (incomplet/manquant) ou un point critique. Ignore les années "complet" sans problème.

Données pré-analysées par l’algorithme :
{json.dumps(anomalies, ensure_ascii=False, indent=2)}

Texte brut extrait du document :
{raw_text}
"""

    # --- STRATÉGIE DE ROUTAGE HIÉRARCHIQUE (Gemini > Mistral > Ollama) ---
    res = None
    
    # 1. Tentative avec GEMINI (Primaire par défaut pour tout)
    if GEMINI_API_KEY:
        res = await _call_gemini(prompt, images)
        if is_valid_json(res):
            return await _finalize_response(res)
    
    # 2. Backup 1 : MISTRAL (Si Gemini échoue ou pas de clé)
    if MISTRAL_API_KEY:
        res = await _call_mistral(prompt)
        if is_valid_json(res):
            return await _finalize_response(res)
            
    # 3. Backup 2 : OLLAMA (Local, si tout le reste échoue)
    res = await _call_ollama(prompt)
    if is_valid_json(res):
        return await _finalize_response(res)
        
    return res or json.dumps({"error": "Aucun service d'analyse disponible ou fonctionnel."})

async def _finalize_response(res: str):
    """Nettoyage et formatage final du JSON."""
    try:
        data = json.loads(res)
        cleaned_data = strip_markdown(data)
        
        # Post-processing: Remove prohibited bullet from first line of resume_global
        if "resume_global" in cleaned_data and isinstance(cleaned_data["resume_global"], str):
            rg = cleaned_data["resume_global"].strip()
            if rg.startswith("•") or rg.startswith("*") or rg.startswith("-"):
                cleaned_data["resume_global"] = rg[1:].strip()
                
        return json.dumps(cleaned_data, ensure_ascii=False)
    except:
        return res

async def _call_gemini(prompt: str, images: list = None):
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            parts = [{"text": prompt}]
            if images:
                for img_b64 in images:
                    parts.append({"inline_data": {"mime_type": "image/png", "data": img_b64}})
            payload = {"contents": [{"parts": parts}]}
            response = await client.post(GEMINI_URL, json=payload)
            if response.status_code == 200:
                text = response.json()['candidates'][0]['content']['parts'][0]['text']
                # Better JSON extraction: find first '{' and last '}'
                try:
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    if start != -1 and end != 0:
                        return text[start:end]
                except:
                    pass
                return text.strip().replace("```json", "").replace("```", "")
            return f"Erreur Gemini {response.status_code}"
    except Exception as e:
        return f"Erreur Gemini : {str(e)}"

async def _call_mistral(prompt: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": "mistral-small-latest",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            response = await client.post(MISTRAL_URL, json=payload, headers=headers)
            if response.status_code == 200:
                text = response.json()['choices'][0]['message']['content']
                try:
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    if start != -1 and end != 0:
                        return text[start:end]
                except:
                    pass
                return text
            return f"Erreur Mistral {response.status_code}"
    except Exception as e:
        return f"Erreur Mistral : {str(e)}"

async def _call_ollama(prompt: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OLLAMA_URL, json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False})
            if response.status_code == 200:
                text = response.json().get("response", "")
                if "<think>" in text: text = text.split("</think>")[-1].strip()
                return text
            return f"Erreur Ollama {response.status_code}"
    except Exception as e:
        return f"Service non disponible : {str(e)}"
