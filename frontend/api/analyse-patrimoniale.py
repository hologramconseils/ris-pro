import os
import tempfile
import httpx
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.hooks import policy
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
    trimestres_valides: int = Field(description="Nombre total exact de trimestres validés extrait du relevé de carrière (ex: 72). Doit être 100% cohérent avec les données du document.")
    trimestres_requis: int = Field(description="Nombre de trimestres requis pour obtenir le taux plein pour cette génération (ex: 172).")
    anomalies_detectees_count: int = Field(description="Nombre d'anomalies détectées sur le relevé de carrière")
    strategies: list[StrategieOptimisation] = Field(description="Liste des stratégies de conseil patrimonial personnalisées et actionnables")
    commentaire_conseil: str = Field(description="Commentaire rédigé de manière bienveillante et professionnelle à l'attention du client")
    bilan_redige_expert: str = Field(description="Un véritable bilan retraite d'expert complet rédigé en Markdown, adoptant le ton feutré et ultra-professionnel d'un conseiller retraite senior (comme chez Novelvy ou Lys Retraite), structuré avec introduction personnalisée, analyse détaillée par périodes de carrière, opportunités d'optimisation réglementaires (rachat de trimestres, cumul, retraite progressive) et plan d'action précis.")

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
    """Fallback résilient utilisant un workflow en deux étapes :
    Étape 1 : Analyse du PDF avec Recherche Google en temps réel pour obtenir les données à jour.
    Étape 2 : Structuration des résultats au format JSON attendu par Pydantic.
    """
    try:
        from google import genai
        from google.genai import types
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("No API Key found for Gemini fallback.")
            
        client = genai.Client(api_key=api_key)
        
        regles_dep = recuperer_regles_retraite("depart_anticipe")
        regles_opt = recuperer_regles_retraite("optimisation")
        
        # --- ÉTAPE 1 : Recherche Google + Analyse du PDF (Sortie libre) ---
        prompt_analyse = f"""
        Vous êtes un conseiller d'élite, expert en retraite.
        Votre mission est d'analyser le relevé de carrière fourni (PDF) et de rédiger des recommandations d'optimisation.
        
        RÈGLES RÉGLEMENTAIRES ET LÉGISLATIVES IMPORTANTES (Taux Plein & Décote) :
        ---
        1. L'âge d'annulation automatique de la décote (taux plein d'office) est de 67 ans pour les générations nées en 1958 et après (Article L351-8 du Code de la sécurité sociale).
        2. L'âge du taux plein cotisé est l'âge auquel l'assuré atteint le nombre de trimestres requis (ex: 172 trimestres pour une personne née en 1977 comme Bertrand SAULNEROND), soit 73 ans dans son cas s'il continue sa carrière sans interruption.
        3. Ne confondez pas ces deux âges. L'âge du taux plein cotisé (l'âge pour atteindre les trimestres requis) doit être renvoyé comme "age_taux_plein_estime" (ex: "73 ans (fin 2050)"). Cependant, dans votre synthèse de situation, vous devez indiquer de façon claire et explicite que son âge d'annulation automatique de la décote est fixé à 67 ans et qu'à cet âge, sa pension sera calculée au taux plein sans aucune décote (même si la durée d'assurance requise de 172 trimestres n'est pas remplie).
        ---
        Règles de départ anticipé :
        {regles_dep}
        
        Règles d'optimisation :
        {regles_opt}
        ---
        
        Consultez Internet via la recherche Google pour vérifier s'il y a des évolutions post-2023 sur le rachat de trimestres, le cumul emploi-retraite ou le calcul du taux plein en France.
        Rédigez un rapport de synthèse détaillé contenant l'âge estimé du taux plein, les anomalies, et une liste de stratégies d'optimisation claires.
        
        Rédigez également une section majeure de rapport d'expert complet appelé 'BILAN RETRAITE PREMIUM'. Ce rapport doit adopter le ton d'un consultant senior de cabinet d'audit privé (Novelvy/Lys Retraite) : formel, précis, humain et haut de gamme.
        Ce rapport doit être structuré de la manière suivante en Markdown :
        # BILAN DE RETRAITE PREMIUM - [Nom de l'utilisateur]
        ## 1. Introduction & Analyse Globale de la Carrière
        (Synthèse chaleureuse mais professionnelle des régimes traversés, de la structure de sa carrière et de sa situation générale).
        ## 2. Analyse Chronologique et Anomalies Détectées
        (Pour chaque période ou année problématique, expliquer clairement l'anomalie détectée, son origine probable et son impact sur la future pension).
        ## 3. Options d'Optimisation & Stratégies Réglementaires
        (Détailler les opportunités adaptées : rachat de trimestres de scolarité/années incomplètes, cumul emploi-retraite, retraite progressive, départ anticipé).
        ## 4. Plan d'Action & Démarches Administratives
        (Lister les étapes concrètes à suivre par l'assuré pour faire valoir ses droits ou corriger son relevé de carrière, avec la liste des pièces justificatives à fournir à l'administration).
        
        Ne mentionnez jamais les termes 'Agent' ou 'IA'. Utilisez uniquement 'expert', 'conseiller', 'retraite' ou 'conseil'.
        """
        
        response_analyse = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type="application/pdf"),
                prompt_analyse
            ],
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())], # Recherche en temps réel autorisée ici
            ),
        )
        
        analyse_texte = response_analyse.text
        
        # --- ÉTAPE 2 : Structuration JSON stricte (Sans outils de recherche) ---
        prompt_structuration = f"""
        Prenez le rapport d'analyse de carrière ci-dessous et structurez-le au format JSON strict en respectant le schéma de la classe ConseilPatrimonial.
        Veillez à extraire le rapport 'BILAN RETRAITE PREMIUM' complet au format Markdown et à l'injecter fidèlement dans le champ 'bilan_redige_expert'.
        
        RAPPORT D'ANALYSE :
        {analyse_texte}
        """
        
        response_struct = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt_structuration,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ConseilPatrimonial, # Structuration Pydantic garantie ici
            ),
        )
        
        return json.loads(response_struct.text)
    except Exception as fallback_err:
        raise Exception(f"Le fallback de secours direct a échoué: {str(fallback_err)}")

async def get_supabase_user(token: str) -> dict:
    """Valide le token JWT en interrogeant l'API d'authentification Supabase."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    if not supabase_url:
        raise ValueError("VITE_SUPABASE_URL manquant.")
    url = f"{supabase_url}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return None

async def verifier_est_admin(user_id: str) -> bool:
    """Vérifie si l'utilisateur possède le rôle d'administrateur dans la table des profils."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    url = f"{supabase_url}/rest/v1/profiles"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key
    }
    params = {
        "id": f"eq.{user_id}",
        "select": "role"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers, params=params)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Erreur d'infrastructure Supabase (Profils: {response.status_code})")
        records = response.json()
        if records and records[0].get("role") == "admin":
            return True
        return False

async def verifier_propriete_document(file_path: str, user_id: str) -> bool:
    """Vérifie que l'utilisateur est le propriétaire légitime du document ou est admin."""
    supabase_url = os.environ.get("VITE_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    url = f"{supabase_url}/rest/v1/analyses"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key
    }
    params = {
        "file_path": f"ilike.{file_path}",
        "select": "user_id"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers, params=params)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Erreur d'infrastructure Supabase (Analyses: {response.status_code})")
        records = response.json()
        if records:
            record_user_id = records[0].get("user_id")
            # Si le document est lié à un utilisateur et que ce n'est pas le demandeur
            if record_user_id and record_user_id != user_id:
                # Vérifier si le demandeur est admin
                return await verifier_est_admin(user_id)
            return True
        return False

@app.post("/api/analyse-patrimoniale")
async def api_analyse_patrimoniale(data: dict, authorization: str = Header(None)):
    """Génère un conseil patrimonial personnalisé. Tente l'agent Antigravity, sinon utilise le fallback Gemini."""
    # 0. Sécurisation : Validation du Token JWT & IDOR (SEC-002)
    if not authorization:
        raise HTTPException(status_code=401, detail="Token d'authentification manquant")
        
    token = authorization.replace("Bearer ", "").strip()
    user_info = await get_supabase_user(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")
        
    user_id = user_info.get("id")
    file_path_param = data.get("filePath") or data.get("filename")
    if not file_path_param:
        raise HTTPException(status_code=400, detail="Missing filePath or filename parameter")

    # Vérification IDOR de la propriété
    est_proprietaire = await verifier_propriete_document(file_path_param, user_id)
    if not est_proprietaire:
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce document")

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

        # Garde-fous et politiques de sécurité
        policies = [
            policy.deny_all(),
            policy.allow("recuperer_regles_retraite")
        ]

        config = LocalAgentConfig(
            system_instructions=(
                "Vous êtes le superviseur d'une équipe de conseillers d'élite en gestion de retraite.\n"
                "Votre mission est d'analyser le relevé de carrière (RIS/EIG) fourni en format PDF et de générer un rapport "
                "de conseil de retraite personnalisé de haute qualité.\n\n"
                "PROTOCOLE DE PARSING DYNAMIQUE ET DE DOUBLE-ENTRÉE :\n"
                "1. Recherche dynamique : Ne cherchez pas le nombre de trimestres à un emplacement fixe. Effectuez un balayage sémantique pour trouver les mots-clés du grand total de trimestres ('Trimestres validés', 'Total de vos droits', 'Régime Général', 'Total Régime').\n"
                "2. Validation croisée : Pour chaque document, extrayez le Grand Total Général affiché dans les encadrés de synthèse, puis calculez séparément la Somme Mathématique Cumulée des trimestres ligne par ligne (année par année). Comparez ces deux valeurs. Si elles diffèrent, effectuez une relecture critique des lignes et éliminez les doublons de régimes multiples ou ajoutez les trimestres assimilés pour garantir que la valeur finale de 'trimestres_valides' est 100% cohérente avec les données réelles du relevé.\n"
                "3. La valeur finale de 'trimestres_valides' que vous retournez doit être le miroir exact de la situation réelle détectée et doit correspondre à 100% à la valeur mentionnée dans vos synthèses de textes.\n\n"
                "RÈGLES RÉGLEMENTAIRES ET LÉGISLATIVES APPLICABLES (Taux Plein & Décote) :\n"
                "1. L'âge légal d'annulation automatique de la décote (taux plein d'office) est de 67 ans pour les assurés nées en 1958 et après (Article L351-8 du Code de la sécurité sociale).\n"
                "2. L'âge du taux plein cotisé est l'âge auquel l'assuré atteint le nombre de trimestres requis (ex: 172 trimestres pour Bertrand SAULNEROND né en 1977).\n"
                "3. L'âge retourné sous 'age_taux_plein_estime' doit être l'âge du taux plein cotisé (ex: '73 ans (fin 2050)' pour Bertrand SAULNEROND). Néanmoins, vous devez obligatoirement préciser dans la synthèse que son âge légal d'annulation automatique de la décote est de 67 ans et qu'à cet âge, sa pension sera calculée au taux plein sans aucune décote.\n\n"
                "Pour accomplir cette mission, vous devez déléguer de la manière suivante :\n"
                "1. Déléguez la tâche d'extraction brute des anomalies et de détection des années d'inactivité à un expert spécialisé nommé 'Expert d'Audit RIS'.\n"
                "2. Transmettez ensuite les anomalies de l'auditeur à un conseiller spécialisé nommé 'Conseiller en Stratégie Retraite' pour formuler des stratégies d'optimisation.\n"
                "3. Le conseiller 'Conseiller en Stratégie Retraite' doit interroger l'outil 'recuperer_regles_retraite' pour s'appuyer sur la réglementation légale officielle.\n"
                "4. Déléguez la rédaction du bilan final rédigé d'expert au conseiller 'Conseiller Retraite Senior' qui adopte le ton d'un grand cabinet d'accompagnement retraite pour formuler le rapport complet en Markdown.\n"
                "5. Synthétisez et compilez les réponses de vos experts pour former le rapport de conseil de retraite final.\n\n"
                "Ne mentionnez jamais les termes 'Agent' ou 'IA' dans vos rédactions. Utilisez uniquement les termes 'expert', 'conseiller', 'retraite' ou 'conseil'.\n"
                "Votre réponse doit être strictement structurée selon le schéma response_schema (le champ bilan_redige_expert doit contenir le rapport rédigé complet en Markdown)."
            ),
            tools=[recuperer_regles_retraite],
            capabilities=types.CapabilitiesConfig(
                enable_subagents=True  # Activation de l'orchestration multi-agents
            ),
            policies=policies,
            response_schema=ConseilPatrimonial
        )

        async with Agent(config=config) as agent:
            pdf_document = Document.from_file(temp_file_path)
            prompt = (
                "Veuillez lire ce relevé de carrière PDF, analyser les anomalies potentielles, "
                "et formuler des recommandations stratégiques de conseil de retraite."
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
