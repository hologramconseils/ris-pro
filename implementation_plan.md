# Plan d'implémentation - Rapport de Conseil Patrimonial CGP (React Frontend)

Ce plan décrit les modifications à apporter au frontend React afin d'appeler l'API de l'agent patrimonial Python, d'enrichir les données et d'afficher le rapport de conseil CGP premium sur la page Bilan.

## Description des Changements
Nous allons intégrer la logique d'appel de l'agent Python et enrichir visuellement le tableau de bord du Bilan Premium.

---

## Proposed Changes

### [Frontend React]

#### [MODIFY] [Bilan.jsx](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/pages/Bilan.jsx)
* **Logique de chargement de l'agent** :
  * Si l'utilisateur est Premium et que les données récupérées de Supabase ne contiennent pas le conseil patrimonial (`strategies` absent), appeler l'API `/api/analyse-patrimoniale` pour enrichir les résultats.
  * Gérer l'état de chargement spécifique `agentLoading` avec un message d'attente animé : *"Génération de votre audit patrimonial par l'agent IA..."*.
* **Interface Visuelle (Aesthetics & UX)** :
  * Ajouter une section **"Conseil Patrimonial & Optimisation"** en haut de la page.
  * Créer des widgets pour l'**Âge estimé du taux plein** et la **Synthèse de carrière**.
  * Afficher la liste des **Stratégies recommandées** (sous forme de grille responsive de cartes élégantes avec des badges d'impact financier).
  * Mettre en forme le **Commentaire du conseiller (CGP)** dans un encadré de type citation premium avec une bordure dorée.
* **Support Impression (Print CSS)** :
  * Adapter la feuille de style d'impression pour inclure proprement ce rapport patrimonial dans l'export PDF.

---

## Verification Plan

### Automated Verification
* Compiler l'application localement pour valider l'absence d'erreurs de syntaxe ou de build React :
  ```bash
  npm run build
  ```

### Manual Verification
* Tester localement en simulant un accès Premium (par exemple en ajoutant un paramètre `?success=true&file=uploads/12y4bnlnt2vi_1782380455529.pdf` dans l'URL).
* Vérifier le bon enchaînement du chargement de l'agent et la réactivité du design (desktop & mobile).
