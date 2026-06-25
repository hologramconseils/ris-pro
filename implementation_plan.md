# Plan d'implémentation - Résolution des Problèmes UX (ux-audit)

Ce plan décrit les modifications à apporter à l'application **RIS Pro** afin de résoudre les problèmes d'utilisabilité identifiés lors de l'audit UX (Rapport `ux_audit.md`).

## Objectifs
1. **UX-001 (Export PDF)** : Remplacer l'alerte fictive par une vraie fonctionnalité d'export PDF via `window.print()` et une feuille de style d'impression (`@media print`) soignée.
2. **UX-002 (Authentification post-achat)** : Générer un lien de connexion magique à usage unique pour tous les acheteurs (nouveaux et existants) pour supprimer la friction de connexion après paiement.
3. **UX-003 (Navigation circulaire)** : Ajouter un bouton "Analyser un autre document" dans le bilan premium pour fluidifier le retour à l'accueil.
4. **UX-004 (Filtres d'anomalies)** : Ajouter un système de filtre par sévérité (Toutes, Critiques, Moyennes) pour réduire la charge cognitive sur les bilans volumineux.

---

## Proposed Changes

### [CSS Stylesheets]

#### [MODIFY] [index.css](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/index.css)
* Ajouter les règles CSS d'impression (`@media print`) :
  - Masquer l'entête global, le pied de page global, et tous les boutons d'action (boutons de retour, impression, calendrier).
  - Ajuster les marges et supprimer les ombres/effets glassmorphismes sur les cartes pour un rendu propre en noir et blanc ou couleurs d'encre standard.
  - S'assurer que le contenu s'étale sur 100% de la largeur disponible et forcer les sauts de page propres si nécessaire.
* Ajouter des styles pour la barre de filtres des anomalies dans le thème clair et sombre.

### [Frontend Components]

#### [MODIFY] [Bilan.jsx](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/pages/Bilan.jsx)
* Ajouter des boutons d'actions en haut de page (sous le titre) :
  - Un bouton principal "Exporter le Bilan (PDF)" avec l'icône `Download` qui déclenche `window.print()`.
  - Un bouton secondaire "Analyser un autre document" qui redirige vers `/`.
* Ajouter un état React `filter` (`'all' | 'high' | 'medium'`) et la barre de boutons de filtres au-dessus de la liste des anomalies.
* Mettre à jour le filtrage de la liste d'anomalies affichée pour prendre en compte le filtre actif.

### [API Handlers]

#### [MODIFY] [webhook.js](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/api/webhook.js)
* Supprimer la condition restrictive `if (isNewUser)` pour la génération du lien magique de connexion via l'API d'administration de Supabase.
* Mettre à jour l'email envoyé par Resend :
  - Si un lien magique est généré, l'intégrer sous forme de bouton "Consulter mon Bilan Premium" pour TOUS les utilisateurs.
  - Personnaliser les explications textuelles selon que l'utilisateur est nouveau ou existant.

---

## Verification Plan

### Automated Tests
* Vérifier le bon formatage et la compilation locale :
  ```bash
  npm run build
  ```

### Manual Verification
* Tester le processus d'impression dans le navigateur (Ctrl+P / Cmd+P ou clic sur "Exporter le Bilan (PDF)") pour valider le rendu du PDF sans les éléments superflus de l'UI.
* Vérifier la réactivité du filtrage par sévérité dans le bilan.
* Simuler la réception d'un événement webhook Stripe et vérifier la bonne génération du lien magique de connexion.
