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

async def generate_ai_audit(anomalies: list, filename: str, raw_text: str = "", images: list = None):
    """
    Routage IA Adaptatif (Stabilité & Quotas) + Détection Jusitifcatifs Exhaustive.
    """
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
    vision_mode_desc = "⚠️ MODE VISION : Analyse VISUELLEMENT les images pour extraire les données." if is_scan else ""
    
    prompt = f"""Tu es l'Expert Vision Retraite de Hologram Conseils. Analyse ce Relevé Individuel de Situation (RIS) pour identifier précisément les anomalies et les justificatifs de régularisation ({filename}).
{vision_mode_desc}

Mission : Analyse EXHAUSTIVE année par année. JSON valide uniquement.

**RÈGLES DE RÉDACTION (STRICTES ET CRITIQUES) :**
- Ne mentionne JAMAIS que tu es une "Intelligence Artificielle" ou une "IA". Parle en tant qu'Expert Vision Retraite.
- Utilise une langue française impeccable, sans aucune faute d'orthographe, de syntaxe ou de grammaire.
- Respecte scrupuleusement l'usage des apostrophes françaises (ex: l'obtention, d'une, n'est, l'année, d'apprentissage, s'arrête, l'expert).
- **STRUCTURE DE LA SYNTHÈSE :** Pour `resume_global` et `compte_rendu`, tu DOIS utiliser des listes à puces (•) pour chaque point clé et des paragraphes segmentés pour une lisibilité maximale.
- Pour `justificatif_suggere`, utilise obligatoirement un format liste à puces (un point par document).

--- 📄 CHECKLIST DES PIÈCES À FOURNIR (Source Experte) ---
Selon l'anomalie détectée, tu DOIS suggérer les documents suivants :

1. ANNÉES VIDES OU TOTALEMENT ABSENTES DU RIS :
   - "Attestation sur l'honneur de recherche de justificatifs"
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
  "resume_global": "Synthèse structurée avec paragraphes clairs...",
  "premiere_annee": "XXXX",
  "derniere_annee": "XXXX",
  "full_timeline": [
    {{
      "annee": "XXXX",
      "statut": "complet/incomplet/manquant",
      "trimestres_valides": N,
      "activite": "Employeur / Statut",
      "anomalie_specifique": "Explication claire sans markdown",
      "justificatif_suggere": "• Document A\n• Document B\n• Document C"
    }}
  ],
  "compte_rendu": "Analyse détaillée de l'Expert avec points clés (•) et paragraphes aérés."
}}

Données à analyser :
{raw_text}
"""

    # --- STRATÉGIE DE ROUTAGE ---
    if is_scan:
        if GEMINI_API_KEY:
            res = await _call_gemini(prompt, images)
            if is_valid_json(res): return res
        if MISTRAL_API_KEY:
            res = await _call_mistral(prompt)
            if is_valid_json(res): return res
    else:
        if MISTRAL_API_KEY:
            res = await _call_mistral(prompt)
            if is_valid_json(res): return res
        if GEMINI_API_KEY:
            res = await _call_gemini(prompt, images)
            if is_valid_json(res): return res

    return await _call_ollama(prompt)

async def _call_gemini(prompt: str, images: list = None):
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            parts = [{"text": prompt}]
            if images:
                for img_b64 in images:
                    parts.append({"inline_data": {"mime_type": "image/png", "data": img_b64}})
            payload = {"contents": [{"parts": parts}]}
            response = await client.post(GEMINI_URL, json=payload)
            if response.status_code == 200:
                text = response.json()['candidates'][0]['content']['parts'][0]['text']
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
                return response.json()['choices'][0]['message']['content']
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
