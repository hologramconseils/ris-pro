import asyncio
import os
import sys

# Ajouter le répertoire de travail actuel au path pour les imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from wealth_advisor_agent import analyser_releve_carriere
except ImportError:
    from backend.wealth_advisor_agent import analyser_releve_carriere

async def main():
    filename = "mock_ris.pdf"
    paths_to_try = [
        filename,
        os.path.join("backend", filename),
        os.path.join(os.path.dirname(__file__), filename)
    ]
    file_path = None
    for p in paths_to_try:
        if os.path.exists(p):
            file_path = p
            break
            
    if not file_path:
        print("Erreur: mock_ris.pdf introuvable.")
        sys.exit(1)
        
    print(f"Lancement de l'analyse patrimoniale autonome sur : {file_path}")
    try:
        result = await analyser_releve_carriere(file_path)
        print("\n=== Analyse Patrimoniale Réussie ===")
        import json
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Erreur d'exécution de l'agent : {str(e)}")

if __name__ == "__main__":
    # Charger l'environnement si présent
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
        print("Attention: Les variables d'environnement GEMINI_API_KEY / GOOGLE_API_KEY ne sont pas configurées.")
        
    asyncio.run(main())
