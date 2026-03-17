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

async def generate_ai_audit(anomalies: list, filename: str, raw_text: str = "", images: list = None):
    """
    Routage Expertise Adaptatif (Stabilité & Quotas) + Détection Justinificatifs Exhaustive.
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
    vision_mode_desc = "⚠️ MODE VISION : Analyse VISUELLEMENT les images pour extraire les données. C'est un SCAN." if is_scan else ""
    
    prompt = f"""Tu es l'expert retraite de Hologram Conseils. Analyse ce Relevé Individuel de Situation (RIS) pour identifier précisément les anomalies et les justificatifs de régularisation ({filename}).
{vision_mode_desc}

Mission : Analyse EXHAUSTIVE année par année. JSON valide uniquement.

**RÈGLES DE RÉDACTION (STRICTES ET CRITIQUES) :**
- Ne mentionne JAMAIS ton mode de fonctionnement technique. Parle exclusivement en tant qu'expert retraite de Hologram Conseils.
- Utilise une langue française impeccable, sans aucune faute d'orthographe, de syntaxe ou de grammaire.
- Respecte scrupuleusement l'usage des apostrophes françaises (ex: l'obtention, d'une, n'est, l'année, d'apprentissage).
- **INTERDICTION FORMELLE DE FORMATAGE MARKDOWN** : N'utilise JAMAIS d'astérisques (**) pour mettre en gras, de dièses (#) pour les titres, ou de tout autre symbole de formatage technique. Le texte doit être du texte brut pur et professionnel.
- **STRUCTURE DE LA SYNTHÈSE :** Pour `resume_global` et `compte_rendu`, tu DOIS utiliser des listes à puces simples (•).

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
      "activite": "Employeur / Statut",
      "anomalie_specifique": "Explication rapide",
      "justificatif_suggere": "• Premier justificatif\\n• Deuxième justificatif"
    }}
  ],
  "compte_rendu": "• Observation 1\\n• Observation 2"
}}

**CONSIGNE DE RAPIDITÉ :** Ne génère un élément dans `full_timeline` QUE si c'est une anomalie (incomplet/manquant) ou un point critique. Ignore les années "complet" sans problème.

Données à analyser :
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
