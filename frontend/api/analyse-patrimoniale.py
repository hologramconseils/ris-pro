import os
import tempfile
import httpx
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import Document

# Charger les variables d'environnement
load_dotenv()

# Mapper GOOGLE_API_KEY de Vercel vers GEMINI_API_KEY requis par l'agent
if "GOOGLE_API_KEY" in os.environ and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

app = FastAPI()

# Configuration CORS pour autoriser l'accès depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Définition du schéma de sortie structuré pour le conseil patrimonial
class StrategieOptimisation(BaseModel):
    titre: str = Field(description="Titre de la stratégie recommandée (ex: Rachat de trimestres, Cumul emploi-retraite)")
    description: str = Field(description="Explication détaillée de la stratégie et de son intérêt pour l'utilisateur")
    impact_estime: str = Field(description="Estimation qualitative ou quantitative de l'impact financier ou temporel")

class ConseilPatrimonial(BaseModel):
    synthese_situation: str = Field(description="Synthèse globale de la situation de carrière analysée")
    age_taux_plein_estime: str = Field(description="Âge estimé d'obtention du taux plein (ex: '64 ans et 3 mois')")
    anomalies_detectees_count: int = Field(description="Nombre d'anomalies détectées sur le relevé de carrière")
    strategies: list[StrategieOptimisation] = Field(description="Liste des stratégies de conseil patrimonial personnalisées et actionnables")
    commentaire_conseil: str = Field(description="Commentaire rédigé de manière bienveillante et professionnelle à l'attention du client")

# 2. Définition de l'outil pour lire la base de règles locale
def recuperer_regles_retraite(type_regle: str) -> str:
    """Permet de récupérer les règles de retraite 2023 officielles locales pour guider le conseil patrimonial.
    
    Args:
        type_regle: Le type de règle à récupérer. Doit être l'un des suivants:
                    - 'depart_anticipe' (règles de départ anticipé pour carrières longues, etc.)
                    - 'gestion' (règles de gestion courante de la retraite)
                    - 'optimisation' (règles d'optimisation de la retraite et cumul)
    """
    filename = f"regles_{type_regle}_2023.md"
    paths_to_try = [
        filename,
        os.path.join("..", filename),
        os.path.join("backend", filename),
        os.path.join(os.path.dirname(__file__), "..", "backend", "uploads", filename),
        os.path.join(os.path.dirname(__file__), "..", "..", filename),
        os.path.join(os.path.dirname(__file__), "..", filename)
    ]
    for path in paths_to_try:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                return f"Erreur de lecture du fichier {path}: {str(e)}"
    return f"Aucune règle trouvée pour '{type_regle}'."

async def telecharger_fichier_supabase(file_path: str) -> bytes:
    """Télécharge le fichier PDF depuis Supabase Storage."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase configuration is missing in environment variables.")
        
    url = f"{supabase_url}/storage/v1/object/authenticated/documents/{file_path}"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.content
        raise Exception(f"Failed to download file from Supabase storage (status {response.status_code}): {response.text}")

async def fallback_direct_gemini(file_bytes: bytes, file_path_param: str) -> dict:
    """Fallback résilient utilisant le client Google GenAI standard (sans binaires locaux)."""
    try:
        from google import genai
        from google.genai import types
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("No API Key found for Gemini fallback.")
            
        client = genai.Client(api_key=api_key)
        
        regles_dep = recuperer_regles_retraite("depart_anticipe")
        regles_opt = recuperer_regles_retraite("optimisation")
        
        prompt = f"""
        Vous êtes un conseiller en gestion de patrimoine (CGP) d'élite, expert en retraite.
        Analysez le relevé de carrière fourni en format PDF et rédigez un rapport structuré.
        
        RÈGLES RÉGLEMENTAIRES APPLICABLES :
        ---
        Règles de départ anticipé :
        {regles_dep}
        
        Règles d'optimisation :
        {regles_opt}
        ---
        
        Votre réponse doit impérativement respecter le schéma structuré demandé (JSON).
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type="application/pdf"),
                prompt
            ],
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                response_mime_type="application/json",
                response_schema=ConseilPatrimonial,
            ),
        )
        
        return json.loads(response.text)
    except Exception as fallback_err:
        raise Exception(f"Le fallback de secours direct a échoué: {str(fallback_err)}")

@app.post("/api/analyse-patrimoniale")
async def api_analyse_patrimoniale(data: dict):
    """Génère un conseil patrimonial personnalisé. Tente l'agent Antigravity, sinon utilise le fallback Gemini."""
    file_path_param = data.get("filePath") or data.get("filename")
    if not file_path_param:
        raise HTTPException(status_code=400, detail="Missing filePath or filename parameter")

    # 1. Télécharger le fichier depuis Supabase
    try:
        file_bytes = await telecharger_fichier_supabase(file_path_param)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur Supabase: {str(e)}")

    # 2. Tenter l'analyse via l'agent Google Antigravity
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(file_bytes)
            temp_file_path = temp_file.name

        config = LocalAgentConfig(
            system_instructions=(
                "Vous êtes un conseiller en gestion de patrimoine (CGP) d'élite, expert en optimisation de la retraite. "
                "Votre mission est d'analyser le relevé de carrière (RIS/EIG) fourni en format PDF et de rédiger un rapport "
                "de conseil patrimonial personnalisé de haute qualité.\n\n"
                "Pour formuler vos conseils, vous devez obligatoirement :\n"
                "1. Interroger l'outil 'recuperer_regles_retraite' pour vous baser sur la réglementation exacte (départ anticipé, gestion, optimisation).\n"
                "2. Analyser les périodes d'activité et estimer l'âge idéal du taux plein.\n"
                "3. Rédiger un commentaire bienveillant, clair et incitatif.\n\n"
                "Votre réponse doit être strictement structurée selon le schéma response_schema."
            ),
            tools=[recuperer_regles_retraite],
            response_schema=ConseilPatrimonial
        )

        async with Agent(config=config) as agent:
            pdf_document = Document.from_file(temp_file_path)
            prompt = (
                "Veuillez lire ce relevé de carrière PDF, analyser les anomalies potentielles, "
                "et formuler des recommandations stratégiques de conseil patrimonial."
            )
            response = await agent.chat([prompt, pdf_document])
            result = await response.structured_output()
            return result
            
    except Exception as agent_err:
        # En cas d'erreur de compatibilité binaire (comme GLIBC sur Vercel serverless)
        # on exécute le fallback résilient direct sur Gemini
        print(f"[Warning] L'agent Antigravity a échoué (erreur de compatibilité binaire attendue sur Vercel) : {str(agent_err)}")
        print("[Info] Lancement du fallback de secours résilient via le client GenAI direct...")
        try:
            fallback_result = await fallback_direct_gemini(file_bytes, file_path_param)
            return fallback_result
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))
            
    finally:
        # S'assurer de nettoyer le fichier temporaire
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as clean_err:
                print(f"Failed to remove temp file {temp_file_path}: {clean_err}")
