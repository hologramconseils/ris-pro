import os
import sys
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Charger les variables d'environnement
load_dotenv()

# S'assurer d'avoir la clé API
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("[Error] Aucun clé API GEMINI_API_KEY ou GOOGLE_API_KEY trouvée dans l'environnement.")
    sys.exit(1)

client = genai.Client(api_key=api_key)

# Liste des fichiers réglementaires à surveiller à la racine
FILES_TO_WATCH = [
    "regles_depart_anticipe_2023.md",
    "regles_gestion_retraite_2023.md",
    "regles_optimisation_retraite_2023.md",
    "regles_polypensionnes_lura.md",
    "regles_pension_reversion_2023.md",
    "regles_expatriation_internationale.md",
    "regles_independants_fonctionnaires.md",
    "regles_minima_sociaux_aspa.md"
]

def get_file_path(filename):
    """Trouve le chemin correct pour le fichier."""
    paths_to_try = [
        filename,
        os.path.join("..", filename),
        os.path.join("backend", filename),
        os.path.join(os.path.dirname(__file__), "..", filename),
        os.path.join(os.path.dirname(__file__), filename)
    ]
    for p in paths_to_try:
        if os.path.exists(p):
            return p
    return None

async def run_regulatory_watch():
    print("=== Lancement de l'agent de veille réglementaire (Retraite France) ===")
    
    any_updated = False
    
    for filename in FILES_TO_WATCH:
        file_path = get_file_path(filename)
        if not file_path:
            print(f"[Warning] Le fichier {filename} est introuvable. Ignoré.")
            continue
            
        print(f"\n[Info] Analyse du fichier : {filename}...")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                current_content = f.read()
        except Exception as e:
            print(f"[Error] Impossible de lire {filename}: {str(e)}")
            continue
            
        prompt = f"""
        Vous êtes un agent de conformité réglementaire expert en législation de la retraite en France.
        Votre tâche est de vérifier si le document de référence ci-dessous est toujours à jour par rapport à la législation actuelle (Lois, décrets d'application, circulaires CNAV/Agirc-Arrco post-2023 jusqu'à aujourd'hui).
        
        DOCUMENT DE RÉFÉRENCE ACTUEL :
        ---
        {current_content}
        ---
        
        CONSIGNES :
        1. Utilisez l'outil de Recherche Google (Google Search) en temps réel pour vérifier s'il y a eu de nouveaux décrets d'application, réformes de retraite, ou changements réglementaires modifiant les critères, conditions ou âges décrits dans ce document de référence.
        2. Si des modifications législatives ou réglementaires réelles sont entrées en vigueur ou ont été publiées et modifient ces règles :
           - Renvoyez l'intégralité du document Markdown mis à jour avec les nouvelles règles, âges ou montants.
           - Ajoutez une section courte en bas du document appelée '### Mises à jour réglementaires' listant les décrets ou circulaires sources trouvés et la date de mise à jour.
        3. Si les informations du document sont toujours parfaitement exactes et à jour, ou si aucune nouvelle législation ne la contredit, répondez STRICTEMENT par le mot : NO_CHANGE
        
        Votre réponse doit être soit le document Markdown mis à jour complet, soit NO_CHANGE (sans autre blabla ni introduction).
        """
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            
            result_text = response.text.strip()
            
            # Nettoyer les balises de code markdown si le modèle en a ajouté
            if result_text.startswith("```markdown"):
                result_text = result_text[11:]
            elif result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()
            
            if "NO_CHANGE" in result_text and len(result_text) < 50:
                print(f"[Info] Aucun changement réglementaire détecté pour {filename}.")
            else:
                print(f"[Success] Mise à jour réglementaire détectée pour {filename} !")
                # Sauvegarder la nouvelle version
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(result_text)
                print(f"[Info] Fichier {filename} mis à jour avec succès.")
                any_updated = True
                
        except Exception as err:
            print(f"[Error] Échec de la génération pour {filename} : {str(err)}")
            
    if any_updated:
        print("\n=== Veille terminée. Certaines règles ont été mises à jour ! ===")
    else:
        print("\n=== Veille terminée. Aucune mise à jour requise. ===")

async def run_global_discovery_watch(client):
    print("\n=== Lancement de la Veille Globale de Découverte ===")
    
    prompt = f"""
    Vous êtes un agent de veille réglementaire expert en retraite française.
    Voici la liste des sujets que nous couvrons déjà dans nos fichiers :
    {', '.join(FILES_TO_WATCH)}
    
    Votre mission : 
    Recherchez sur le web (lois récentes, JORF, nouveautés retraite) s'il existe une NOUVELLE loi, un nouveau décret ou une réforme récente très importante concernant la retraite en France qui traite d'un sujet TOTALEMENT NOUVEAU, non couvert par les fichiers listés ci-dessus.
    
    Si vous ne trouvez aucun sujet majeur nouveau qui mérite d'être documenté, répondez avec 'has_new_topic': false.
    
    Si vous trouvez un nouveau sujet important (par exemple un nouveau dispositif de retraite, une nouvelle catégorie socio-professionnelle spécifique, etc.), générez le fichier de règles correspondant.
    Répondez STRICTEMENT avec un objet JSON valide suivant ce format :
    {{
      "has_new_topic": true,
      "filename": "regles_nom_du_sujet.md",
      "content": "# Titre du sujet\\n\\nContenu du document Markdown avec les nouvelles règles..."
    }}
    Ne rajoutez pas de texte en dehors du JSON.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                response_mime_type="application/json"
            ),
        )
        
        result_text = response.text.strip()
        data = json.loads(result_text)
        
        if data.get("has_new_topic"):
            filename = data.get("filename")
            content = data.get("content")
            
            if filename and content:
                print(f"[Success] Nouveau sujet découvert ! Création du fichier : {filename}")
                file_path = get_file_path(filename)
                if not file_path:
                    # Enregistrer à la racine du projet
                    if os.path.exists("backend"):
                        file_path = filename
                    else:
                        file_path = os.path.join("..", filename)
                        
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"[Info] Fichier {filename} créé avec succès. N'oubliez pas de l'ajouter manuellement dans wealth_advisor_agent.py et FILES_TO_WATCH si nécessaire.")
                return True
        else:
            print("[Info] Aucun nouveau sujet majeur détecté lors de la veille globale.")
            
    except Exception as err:
        print(f"[Error] Échec lors de la veille globale de découverte : {str(err)}")
        
    return False

if __name__ == "__main__":
    import asyncio
    async def main():
        await run_regulatory_watch()
        await run_global_discovery_watch(client)
        
    asyncio.run(main())
