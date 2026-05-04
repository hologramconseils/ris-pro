import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

import logging
import time

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ai_service")

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "deepseek-r1:14b"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_DISABLED = os.getenv("MISTRAL_DISABLED", "false").lower() == "true"

def is_valid_json(text: str) -> bool:
    """Vérifie si la réponse contient un JSON valide."""
    if not text: return False
    text = text.strip()
    # Check if there's at least one { and }
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end < start:
        return False
    try:
        json_content = text[start:end+1]
        json.loads(json_content)
        return True
    except:
        return False

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
    Priorité Mistral avec Fallback Gemini.
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
    has_career_data = (career_data is not None and len(career_data) > 0)
    
    # Vision description only for Gemini
    vision_mode_desc = """⚠️ MODE VISION ACTIVÉ : Tu analyses des IMAGES (scans ou photos).
- CONSIGNE VISION : Les documents peuvent être de travers, flous ou avoir un faible contraste.
- EXTRACTION : Analyse très précisément chaque ligne du tableau de carrière. Si tu vois une année, regarde les colonnes à droite pour les trimestres et les points.
- IDENTITÉ : Cherche le nom et le prénom de l'assuré en haut des pages (près de 'Nom d'usage' ou 'Prénom').
- TABLEAUX : Fais attention aux décalages visuels. L'année est à gauche, l'employeur au milieu, les trimestres/points à droite.
- SALAIRES : Extrais le salaire brut annuel pour chaque année de carrière si disponible.
- POINTS : Extrais les points de retraite complémentaire (Agirc-Arrco, Ircantec, etc.) pour chaque année."""
    
    # --- Expert Calculation Engine Integration ---
    from services.rules_engine import RetirementRulesEngine
    
    # 1. Perform automated verification for each year if career_data is present
    expert_audit_notes = []
    reliability_score = 100
    career_projection = {}
    base_pension = None
    comp_pension = None
    
    # NOTE: `career_data` is now passed as an argument.
    birth_year = kwargs.get("birth_year", 1980)
    birth_month = kwargs.get("birth_month", 1)
    
    if has_career_data:
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
        last_entry = career_data[-1]
        total_q = sum(int(e.get("ris_quarters", 0)) for e in career_data)
        total_pts = sum(float(e.get("ris_points", 0.0)) for e in career_data)
        
        projection = RetirementRulesEngine.project_future_career(
            total_points=total_pts,
            birth_year=birth_year,
            current_salary=last_entry.get("salary", 40000.0),
            current_quarters=total_q,
            birth_month=birth_month,
            career_data=career_data
        )
        
        # Technical Pension Estimate based on consolidated formulas
        sam = RetirementRulesEngine.calculate_sam(career_data)
        base_pension = RetirementRulesEngine.calculate_base_pension(
            sam, 
            projection.get("projected_quarters", total_q),
            projection.get("required_quarters", 172)
        )
        
        # Agirc-Arrco value from rules engine (use get_year_data, not RETIREMENT_RESOURCES)
        service_val = 1.4386
        resource_2025 = RetirementRulesEngine.get_year_data(2025) or {}
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

    # --- Build expert context ---
    if has_career_data:
        expert_context = f"""
**RÈGLES AGIRC-ARRCO :**
- Valeur d'achat du point (2025: 19,6321€ | 2024: 18,7669€ | 2023: 17,4316€).
- PASS : 2025: 47 100€ | 2024: 46 368€ | 2023: 43 992€.

**SYSTÈME DE RETRAITE :**
- Âge légal : {career_projection.get('legal_age_display', '64 ans')} pour la génération {birth_year}.
- Trimestres requis : {career_projection.get('required_quarters', 172)}.

**VÉRIFICATION EXPERTE :**
- Score de fiabilité : {reliability_score}/100
- Salaire Annuel Moyen (SAM) : {career_projection.get('sam', 0)}€
- Projection estimée : {career_projection.get('technical_monthly_estimate', 'N/A')}€ / mois.
- Notes d'audit : {" | ".join(expert_audit_notes) if expert_audit_notes else "Aucun écart majeur détecté."}
"""
    else:
        gen_params = RetirementRulesEngine.get_generation_parameters(birth_year, birth_month)
        expert_context = f"""
**SYSTÈME DE RETRAITE :**
- Âge légal : {gen_params['legal_age_years']} ans{' et ' + str(gen_params['legal_age_months']) + ' mois' if gen_params['legal_age_months'] > 0 else ''}.
- Trimestres requis : {gen_params['required_quarters']}.
"""

    base_prompt = f"""Tu es l'expert retraite de Hologram Conseils. Analyse ce Relevé Individuel de Situation (RIS) pour identifier précisément les anomalies et les justificatifs de régularisation ({filename}).
[MODE: {"SCAN (OCR)" if is_scan else "NATIF"}]

{expert_context}

**MISSION ET PÉRIODE D’ANALYSE :**
- Analyse jusqu'à l'année **{target_year}**.
- Recalcule les droits selon les notes d'audit.
- Vérifie chômage/maladie.
- Score de fiabilité : {reliability_score}/100.
- Analyse impérativement les régimes complémentaires (Agirc-Arrco, Ircantec, etc.).

**RÈGLES DE RÉDACTION :**
- Détecte le nom et prénom. Commence le `resume_global` par "Bonjour [Prénom] [Nom], ...".
- Pas de Markdown (** ou #). Texte brut pur.
- Listes à puces (•) pour les détails.

Format de sortie attendu (JSON valide) :
{{
  "anomalie_detectee": "oui/non",
  "niveau_risque": "faible/moyen/élevé",
  "resume_global": "Texte d'accueil direct sans puce...",
  "premiere_annee": "XXXX",
  "derniere_annee": "XXXX",
  "full_timeline": [
    {{
      "annee": "XXXX",
      "statut": "manquant/incomplet/complet",
      "salaire_brut": N.NN,
      "trimestres_valides": N,
      "points_complementaires": N.NN,
      "activite": "Employeur / Statut",
      "anomalie_specifique": "Explication",
      "justificatif_suggere": "• Liste justificatifs"
    }}
  ],
  "compte_rendu": "• Observations"
}}
"""


    # --- STRATÉGIE DE ROUTAGE HIÉRARCHIQUE (Mistral > Gemini > Ollama) ---
    res = None
    
    # 1. Priorité MISTRAL (Texte uniquement)
    # OPTIMISATION : Si c'est un scan et qu'on a presque pas de texte (pas d'OCR), on saute Mistral
    skip_mistral = is_scan and len(raw_text.strip()) < 200
    
    if MISTRAL_API_KEY and not MISTRAL_DISABLED and not skip_mistral:
        logger.info(f"Début analyse Mistral pour {filename}...")
        mistral_prompt = base_prompt + f"\n\nDonnées pré-analysées :\n{json.dumps(anomalies, ensure_ascii=False, indent=2)}\n\nTexte extrait :\n{raw_text}"
        start_time = time.time()
        try:
            res = await _call_mistral(mistral_prompt)
            latency = time.time() - start_time
            if is_valid_json(res):
                # Seuil de qualité : un scan nécessite souvent une réponse plus longue pour être crédible
                quality_threshold = 800 if is_scan else 200
                if len(res) >= quality_threshold:
                    logger.info(f"Analyse Mistral réussie en {latency:.2f}s")
                    return await _finalize_response(res)
                else:
                    logger.warning(f"Réponse Mistral insuffisante ({len(res)} chars), tentative fallback Gemini Vision...")
            else:
                logger.warning(f"Réponse Mistral invalide ou incomplète en {latency:.2f}s, tentative fallback Gemini Vision...")
        except Exception as e:
            logger.error(f"Erreur critique Mistral : {str(e)}")
            logger.warning("Basculement immédiat vers Gemini suite à erreur Mistral.")

    # 2. Backup 1 : GEMINI VISION (Si Mistral échoue ou document scanné nécessitant vision)
    if GEMINI_API_KEY:
        logger.info(f"Appel Gemini Vision (Primary/Fallback) pour {filename}...")
        gemini_prompt = base_prompt + f"\n\n{vision_mode_desc if is_scan else ''}\n\nDonnées pré-analysées :\n{json.dumps(anomalies, ensure_ascii=False, indent=2)}\n\nTexte extrait :\n{raw_text}"
        start_time = time.time()
        try:
            res = await _call_gemini(gemini_prompt, images)
            latency = time.time() - start_time
            if is_valid_json(res):
                logger.info(f"Analyse Gemini réussie en {latency:.2f}s")
                return await _finalize_response(res)
            else:
                logger.error(f"Réponse Gemini invalide en {latency:.2f}s")
        except Exception as e:
            logger.error(f"Erreur critique Gemini : {str(e)}")

    # 3. Backup 2 : OLLAMA (Local, dernier recours)
    logger.warning(f"Tous les services cloud ont échoué pour {filename}, tentative Ollama local...")
    try:
        ollama_prompt = base_prompt + f"\n\nDonnées pré-analysées :\n{json.dumps(anomalies, ensure_ascii=False, indent=2)}\n\nTexte extrait :\n{raw_text}"
        res = await _call_ollama(ollama_prompt)
        if is_valid_json(res):
            logger.info("Analyse Ollama réussie.")
            return await _finalize_response(res)
    except Exception as e:
        logger.error(f"Erreur critique Ollama : {str(e)}")
        
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
