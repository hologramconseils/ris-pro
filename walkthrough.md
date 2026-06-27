# Walkthrough - Intégration de l'Agent Autonome Google Antigravity SDK

Ce document résume les actions menées pour intégrer un agent IA autonome de conseil patrimonial et d'audit de relevé de carrière dans le backend Python de RIS Pro.

---

## 1. Dépendances et Environnement Virtuel
*   **Ajout des dépendances** : `google-antigravity>=0.1.0` et `pydantic>=2.0.0` ont été ajoutés dans [requirements.txt](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/backend/requirements.txt).
*   **Mise à niveau de l'environnement virtuel** : Le package `google-antigravity` nécessitant une version de Python supérieure ou égale à 3.10, le dossier `venv/` du backend a été recréé en ciblant la version globale **Python 3.14.3** installée sur le système.
*   **Mise à jour des variables locales** : Copie du fichier `.env.local` de Vercel vers `backend/.env` pour gérer la configuration de l'API.

---

## 2. Implémentation du Module Agent
Création du module [wealth_advisor_agent.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/backend/wealth_advisor_agent.py) qui orchestre l'agent autonome :
*   **Schémas Pydantic** : Définition de `ConseilPatrimonial` et `StrategieOptimisation` pour structurer la réponse finale.
*   **Outils Métiers** : Ajout de la fonction `recuperer_regles_retraite(type_regle: str)` permettant à l'agent de charger à la volée les fichiers markdown de réglementation (`regles_depart_anticipe_2023.md`, etc.).
*   **Configuration de l'agent** : Configuration des instructions système (persona de conseiller patrimonial CGP expert) et association de la validation du schéma de sortie.

---

## 3. Exposition de l'API FastAPI
Modification de [main.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/backend/main.py) pour y ajouter la route POST `/api/analyse-patrimoniale` :
*   Reçoit un nom de fichier relevé PDF.
*   Instancie et exécute l'agent autonome asynchrone.
*   Renvoie la réponse structurée JSON au format attendu.

---

## 4. Outil de Test & Validation
Création du script [test_agent.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/backend/test_agent.py) permettant de simuler localement l'exécution de l'agent sur le fichier test `mock_ris.pdf`.

> [!NOTE]
> Pour exécuter le script localement avec succès, copiez votre clé d'API dans `backend/.env` :
> ```text
> GEMINI_API_KEY="VOTRE_CLE_API"
> ```
> Puis lancez la commande :
> ```bash
> cd backend
> ./venv/bin/python test_agent.py
> ```

---

## 5. Synchronisation
Tous les fichiers modifiés et nouveaux ont été synchronisés dans les dossiers de sauvegarde Desktop :
*   `/Users/hologramconseils/Desktop/RIS Pro V2`
*   `/Users/hologramconseils/Desktop/RIS Pro V2/ris-pro-web`
