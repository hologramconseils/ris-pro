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

async def generate_ai_audit(anomalies: list, filename: str, raw_text: str = "", images: list = None):
    """
    Routage Intelligent : 
    - Si IMAGES (Scan) : GEMINI (Primaire/Vision) -> MISTRAL (Fallback)
    - Si TEXTE (Natif) : MISTRAL (Primaire/Français) -> GEMINI (Fallback)
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
    
    prompt = f"""Tu es un expert en audit de relevés de carrière retraite française.
{vision_mode_desc}

Mission : Analyse EXHAUSTIVE du RIS ({filename}). JSON uniquement. 
Règle : Analyse année par année de la première à la dernière. Pas de markdown (**).

Données :
{raw_text}
"""

    # --- ROUTAGE INTELLIGENT ---
    
    if is_scan:
        # 1. SCAN/IMAGE : Gemini gagne (Vision)
        if GEMINI_API_KEY:
            res = await _call_gemini(prompt, images)
            if not res.startswith("Erreur"): return res
            print(f"⚠️ Gemini Vision failed, using Mistral OCR... ({res[:50]})")

        if MISTRAL_API_KEY:
            res = await _call_mistral(prompt)
            if not res.startswith("Erreur"): return res

    else:
        # 2. TEXTE NATIF : Mistral gagne (Expertise FR)
        if MISTRAL_API_KEY:
            res = await _call_mistral(prompt)
            if not res.startswith("Erreur"): return res
            print(f"⚠️ Mistral failed, falling back to Gemini... ({res[:50]})")

        if GEMINI_API_KEY:
            res = await _call_gemini(prompt, images)
            if not res.startswith("Erreur"): return res

    # --- 3. ULTIME RECOURS ---
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
                return response.json()['candidates'][0]['content']['parts'][0]['text']
            return f"Erreur Gemini ({response.status_code})"
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
            return f"Erreur Mistral ({response.status_code})"
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
            return f"Erreur Ollama ({response.status_code})"
    except Exception as e:
        return f"Service IA non disponible : {str(e)}"
