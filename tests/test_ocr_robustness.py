import asyncio
import os
import sys

# Ajouter le chemin du projet au PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from backend.wealth_advisor_agent import analyser_releve_carriere
except ImportError:
    from wealth_advisor_agent import analyser_releve_carriere

async def run_test():
    # Utiliser un PDF existant dans les uploads
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        print(f"Dossier {upload_dir} introuvable.")
        return

    files = [f for f in os.listdir(upload_dir) if f.endswith(".pdf")]
    if not files:
        print("Aucun fichier PDF trouvé pour le test.")
        return

    test_file = os.path.join(upload_dir, files[0])
    print(f"Test d'extraction sur : {test_file}...")

    try:
        results = await analyser_releve_carriere(test_file)
        
        print("\n--- RÉSULTATS DE L'AUDIT ---")
        print(f"Trimestres validés (KPI) : {results.get('trimestres_valides')}")
        print(f"Trimestres requis : {results.get('trimestres_requis')}")
        print(f"Âge Taux Plein Estimé : {results.get('age_taux_plein_estime')}")
        print(f"Synthèse de Situation : {results.get('synthese_situation')[:200]}...")
        
        # Validation logique
        valides = results.get('trimestres_valides')
        synthese = results.get('synthese_situation', '')
        
        assert valides is not None, "Le nombre de trimestres validés est manquant"
        assert isinstance(valides, int), "Le nombre de trimestres validés doit être un entier"
        
        print("\n✅ Test réussi : Extraction et typage validés.")
        
    except Exception as e:
        print(f"\n❌ Le test a échoué : {str(e)}")

if __name__ == "__main__":
    asyncio.run(run_test())
