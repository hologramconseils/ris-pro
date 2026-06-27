import os
import sys
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from google.antigravity import Agent, LocalAgentConfig, types
from google.antigravity.hooks import policy
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
    trimestres_valides: int = Field(description="Nombre total exact de trimestres validés extrait du relevé de carrière (ex: 72). Doit être 100% cohérent avec les données du document.")
    trimestres_requis: int = Field(description="Nombre de trimestres requis pour obtenir le taux plein pour cette génération (ex: 172).")
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
    return f"Aucune règle trouvée pour '{type_regle}'."

# 3. Fonction principale d'orchestration de l'agent Superviseur Multi-Agents
async def analyser_releve_carriere(file_path: str) -> dict:
    """Instancie l'agent principal Superviseur de conseil patrimonial, lui fournit le PDF du relevé de carrière,
    et orchestre la collaboration entre sous-agents spécialisés dans un cadre sécurisé.
    
    Args:
        file_path: Le chemin d'accès absolu ou relatif vers le document PDF du relevé de carrière.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Le fichier {file_path} est introuvable.")

    # Garde-fous et politiques de sécurité
    # Interdiction par défaut de tout outil système sensible, autorisation stricte de l'outil réglementaire
    policies = [
        policy.deny_all(),
        policy.allow("recuperer_regles_retraite")
    ]

    config = LocalAgentConfig(
        system_instructions=(
            "Vous êtes le superviseur d'une équipe de conseillers d'élite en gestion de retraite.\n"
            "Votre mission est d'analyser le relevé de carrière (RIS/EIG) fourni en format PDF et de générer un rapport "
            "de conseil personnalisé de haute qualité.\n\n"
            "RÈGLES LÉGISLATIVES ET RÉGLEMENTAIRES MAJEURES (Taux Plein & Décote) :\n"
            "1. L'âge légal d'annulation automatique de la décote (obtention du taux plein d'office) est de 67 ans (Article L351-8 du Code de la sécurité sociale) pour toutes les personnes nées en 1958 ou après.\n"
            "2. L'âge du taux plein cotisé correspond à l'âge auquel l'assuré atteint le nombre de trimestres requis pour sa génération (ex: 172 trimestres pour une personne née en 1977 comme M. Bertrand SAULNEROND).\n"
            "3. L'âge retourné sous 'age_taux_plein_estime' doit être l'âge du taux plein cotisé (ex: '73 ans (fin 2050)' s'il lui manque des trimestres). Toutefois, vous devez obligatoirement préciser dans la synthèse que son âge légal d'annulation automatique de la décote est fixé à 67 ans et qu'à cet âge, sa pension sera calculée au taux plein sans aucune décote.\n\n"
            "Pour accomplir cette mission, vous devez déléguer de la manière suivante :\n"
            "1. Déléguez la tâche d'extraction brute des anomalies et de détection des années d'inactivité à un expert spécialisé nommé 'Expert d'Audit RIS'.\n"
            "2. Transmettez ensuite les anomalies de l'auditeur à un conseiller spécialisé nommé 'Conseiller en Stratégie Retraite' pour formuler des stratégies d'optimisation.\n"
            "3. Le conseiller 'Conseiller en Stratégie Retraite' doit interroger l'outil 'recuperer_regles_retraite' pour s'appuyer sur la réglementation légale officielle.\n"
            "4. Synthétisez et compilez les réponses de vos experts pour former le rapport de conseil de retraite final.\n\n"
            "Ne mentionnez jamais les termes 'Agent' ou 'IA' dans vos rédactions. Utilisez uniquement les termes 'expert', 'conseiller', 'retraite' ou 'conseil'.\n"
            "Votre réponse doit être strictement structurée selon le schéma response_schema."
        ),
        tools=[recuperer_regles_retraite],
        capabilities=types.CapabilitiesConfig(
            enable_subagents=True  # Activation de l'orchestration multi-agents
        ),
        policies=policies,
        response_schema=ConseilPatrimonial
    )

    async with Agent(config=config) as supervisor:
        # Charger le PDF
        pdf_document = Document.from_file(file_path)
        
        prompt = (
            "Veuillez démarrer l'audit de ce relevé de carrière PDF. Utilisez vos conseillers spécialisés "
            "pour identifier les anomalies puis concevoir des stratégies d'optimisation conformes."
        )
        
        # Interagir avec le superviseur
        response = await supervisor.chat([prompt, pdf_document])
        
        # Récupérer la sortie structurée (JSON validé sous forme de dictionnaire)
        data = await response.structured_output()
        return data
