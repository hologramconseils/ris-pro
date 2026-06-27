import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import Document

# Charger les variables d'environnement
load_dotenv()

# Mapper GOOGLE_API_KEY de Vercel vers GEMINI_API_KEY requis par l'agent
if "GOOGLE_API_KEY" in os.environ and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

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
        os.path.join(os.path.dirname(__file__), "..", filename)
    ]
    for path in paths_to_try:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                return f"Erreur de lecture du fichier {path}: {str(e)}"
    return f"Aucune règle trouvée pour '{type_regle}'. Fichiers disponibles: regles_depart_anticipe_2023.md, regles_gestion_retraite_2023.md, regles_optimisation_retraite_2023.md"

# 3. Fonction principale d'orchestration de l'agent
async def analyser_releve_carriere(file_path: str) -> dict:
    """Instancie l'agent de conseil patrimonial, lui fournit le PDF du relevé de carrière et génère l'analyse structurée.
    
    Args:
        file_path: Le chemin d'accès absolu ou relatif vers le document PDF du relevé de carrière.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Le fichier {file_path} est introuvable.")

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
        # Charger le PDF
        pdf_document = Document.from_file(file_path)
        
        prompt = (
            "Veuillez lire ce relevé de carrière PDF, analyser les anomalies potentielles, "
            "et formuler des recommandations stratégiques de conseil patrimonial."
        )
        
        # Interagir avec l'agent
        response = await agent.chat([prompt, pdf_document])
        
        # Récupérer la sortie structurée (JSON validé sous forme de dictionnaire)
        data = await response.structured_output()
        return data
