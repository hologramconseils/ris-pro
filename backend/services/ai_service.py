import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "deepseek-r1:14b"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"

async def generate_ai_audit(anomalies: list, filename: str, raw_text: str = "", images: list = None):
    """
    Sends the raw extracted text and/or page images to Gemini.
    The AI performs an exhaustive year-by-year analysis.
    Returns structured JSON string.
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

    # If no raw text available, build from anomalies as fallback
    if not raw_text:
        raw_text = "\n".join([f"- {a['title']}: {a['description']}" for a in anomalies])
    
    vision_mode_desc = "⚠️ MODE VISION ACTIVÉ : On t'a fourni des images du document car le texte est illisible ou scanné. Analyse VISUELLEMENT les images pour extraire les données." if images else ""
    
    prompt = f"""Tu es un expert en audit de relevés de carrière retraite française.
{vision_mode_desc}

Mission :
Analyser de manière EXHAUSTIVE le relevé de carrière (RIS) fourni ({filename}).

Méthodologie obligatoire — analyse année par année :
1. Identifie la PREMIÈRE année d'activité et la DERNIÈRE année mentionnée d'activité dans le document.
2. Effectue une analyse séquentielle pour CHAQUE année sans exception, de la première à la dernière.
3. Pour chaque année, détermine :
   - Le statut : "complet" (4 trimestres), "incomplet" (< 4 trimestres), "manquant" (année absente du doc).
   - Le nombre de trimestres validés (0 à 4).
   - Le nombre de trimestres manquants (4 - validés).
   - Le montant des points de retraite complémentaire (Agirc-Arrco, Ircantec, etc.).
   - Un résumé de l'activité ou de l'inactivité (Employeur, Chômage, Maladie, etc.).
4. Détecte les anomalies (ex: Années manquantes, trimestres oubliés, absence de points complémentaires).

Règles impératives :
- Travaille UNIQUEMENT à partir du contenu fourni (Images ou Texte).
- Sois EXHAUSTIF : CHAQUE année entre la première et la dernière doit figurer dans le JSON.
- Réponds uniquement en JSON valide, sans texte superflu, sans markdown.

Format de sortie obligatoire :
{{
  "anomalie_detectee": "oui/non",
  "niveau_risque": "faible/moyen/élevé",
  "resume_global": "synthèse concise et bien aérée de l'état du relevé (utilise des sauts de ligne \\n\\n pour séparer les idées)",
  "premiere_annee": "XXXX",
  "derniere_annee": "XXXX",
  "full_timeline": [
    {{
      "annee": "XXXX",
      "statut": "complet/incomplet/manquant",
      "trimestres_valides": N,
      "trimestres_manquants": M,
      "points_complementaires": "valeur ou 0",
      "activite": "Résumé (ex: Salarié chez X, Chômage KLESIA, etc.)",
      "anomalie_specifique": "explication précise si le statut n'est pas complet, sinon null"
    }}
  ],
  "compte_rendu": "Compte-rendu d'expert extrêmement détaillé. Si des anomalies sont détectées, TU DOIS OBLIGATOIREMENT utiliser des puces (•) pour lister chaque point de vigilance critique, et aérer le texte avec des sauts de ligne (\\n\\n) entre chaque anomalie."
}}

Réponds uniquement en JSON valide.
N'ajoute aucun texte avant ou après.
Pas de markdown (n'utilise JAMAIS d'astérisques ** pour mettre du texte en gras).
Pas de bloc ```json.

Voici les données textuelles (partielles si scan) :
{raw_text}
"""

    if GEMINI_API_KEY:
        return await _call_gemini(prompt, images)
    else:
        return await _call_ollama(prompt)

async def _call_gemini(prompt: str, images: list = None):
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            parts = [{"text": prompt}]
            
            if images:
                for img_b64 in images:
                    parts.append({
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": img_b64
                        }
                    })
            
            payload = {
                "contents": [{"parts": parts}]
            }
            
            response = await client.post(GEMINI_URL, json=payload)
            if response.status_code == 200:
                result = response.json()
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                error_detail = response.text
                print(f"Gemini API Error {response.status_code}: {error_detail}")
                return f"Erreur Gemini ({response.status_code}). Détail : {error_detail[:200]}"
    except Exception as e:
        return f"Erreur de connexion Gemini : {str(e)}"

async def _call_ollama(prompt: str):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            })
            
            if response.status_code == 200:
                result = response.json()
                text = result.get("response", "")
                if "<think>" in text and "</think>" in text:
                    text = text.split("</think>")[-1].strip()
                return text
            else:
                return f"Erreur Ollama ({response.status_code}) : Impossible de générer l'analyse."
    except Exception as e:
        return f"Service IA non disponible (Ollama non accessible) : {str(e)}"
