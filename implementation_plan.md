# Plan d'implémentation - Déploiement de l'Agent IA Patrimonial sur Vercel

Ce plan décrit les étapes nécessaires pour déployer l'agent autonome Python en production sur `https://ris.hologramconseils.com` via Vercel.

## Diagnostic & Contrainte Technique

> [!IMPORTANT]
> Actuellement, le déploiement Vercel est uniquement configuré pour compiler et exécuter du **Node.js** dans `frontend/api/`.
> Pour exécuter l'agent Python sur Vercel, nous devons configurer le builder `@vercel/python` pour notre nouvel endpoint.

---

## Proposed Changes

### [Vercel Configuration]

#### [MODIFY] [vercel.json](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/vercel.json)
* Ajouter le support de la compilation Python pour l'endpoint de l'agent :
  ```json
      {
        "src": "frontend/api/analyse-patrimoniale.py",
        "use": "@vercel/python"
      }
  ```

### [Python Serverless Function]

#### [NEW] [requirements.txt](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/api/requirements.txt)
* Définir les dépendances nécessaires pour la fonction serverless Python sur Vercel :
  ```text
  google-antigravity>=0.1.0
  pydantic>=2.0.0
  fastapi>=0.110.0
  ```

#### [NEW] [analyse-patrimoniale.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/api/analyse-patrimoniale.py)
* Créer la fonction serverless Python exposant l'API via FastAPI pour Vercel.
* Ce fichier importera la logique de `wealth_advisor_agent.py` pour analyser le PDF et renvoyer la réponse structurée.

---

## Verification & Deployment Plan

### Automated Verification
* Tester le déploiement local via Vercel CLI :
  ```bash
  vercel dev
  ```

### Deployment Steps
1. Commiter les modifications sur Git.
2. Synchroniser les fichiers avec le dossier Desktop (`/Users/hologramconseils/Desktop/RIS Pro V2`).
3. Lancer un `git push origin main` pour déclencher le déploiement automatique en production sur Vercel.
