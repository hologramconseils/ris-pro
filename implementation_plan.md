# Plan d'implémentation : Multi-Agents Spécialisés & Garde-fous de Sécurité

Ce plan détaille la refonte de l'agent de conseil patrimonial RIS Pro. Nous divisons son fonctionnement en deux agents spécialisés collaboratifs et mettons en place des politiques de sécurité strictes pour encadrer ses actions.

---

## 1. Nouvelle Architecture Multi-Agents
Nous remplaçons l'agent unique par une structure de supervision avec délégation :

```
             ┌─────────────────────────────┐
             │    SUPERVISEUR PATRIMONIAL  │
             └──────────────┬──────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌────────────────────────┐
│   AGENT AUDITEUR      │       │    AGENT CONSEILLER    │
│  (Détecte anomalies)  │       │ (Stratégies & Conseils)│
└───────────────────────┘       └────────────────────────┘
```

1.  **Agent Auditeur (RIS Audit Agent)** : Spécialiste de la lecture de relevés de carrière (RIS/EIG). Il se concentre uniquement sur le comptage des trimestres et la détection d'erreurs (salaires, employeurs, trimestres manquants).
2.  **Agent Conseiller (Wealth Strategy Agent)** : Spécialiste patrimonial. Il prend les anomalies détectées par l'auditeur, consulte la documentation locale et effectue la recherche en direct pour proposer les meilleures stratégies d'optimisation (VPLR, cumul, etc.).
3.  **Superviseur (Main Advisor Agent)** : Il orchestre les deux sous-agents et assemble le rapport final.

---

## 2. Politiques de Sécurité et Garde-fous
Pour garantir la conformité et éviter toute action malveillante ou imprévue en production, nous mettons en place les garde-fous suivants via `google.antigravity.hooks.policy` :
*   **Fermeture par défaut** : Utilisation de `policy.deny_all()` pour interdire tout outil par défaut (pas d'écriture de fichiers, pas d'exécution système).
*   **Autorisations sélectives** :
    *   Autoriser uniquement la lecture des fichiers réglementaires de référence (`recuperer_regles_retraite`).
    *   Autoriser la recherche Google.
*   **Vérification des arguments (Predicates)** : Empêcher l'agent d'accéder à des données sensibles de l'utilisateur.

---

## 3. Fichiers impactés

### [MODIFY] [wealth_advisor_agent.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/backend/wealth_advisor_agent.py)
*   Refonte du script pour configurer les rôles de l'agent principal et des sous-agents.
*   Ajout de la configuration des politiques de sécurité (`policies`).

### [MODIFY] [analyse-patrimoniale.py](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/api/analyse-patrimoniale.py)
*   Mise à jour des instructions et du fonctionnement de l'agent Antigravity pour refléter la structure multi-agents et la sécurité.

---

## 4. Plan de vérification
*   Valider que le rapport final est correctement structuré et cohérent.
*   S'assurer qu'aucun outil système (comme run_command) n'est accessible par l'agent.
