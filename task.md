# Liste des tâches - Résolution des Problèmes UX (ux-audit)

## 1. Modifications API (Authentification)
- [x] Modifier `frontend/api/webhook.js` pour générer un lien magique pour tous les acheteurs (nouveaux et existants) et l'inclure dans l'email Resend.

## 2. Modifications Frontend (Composants et Pages)
- [x] Mettre à jour `frontend/src/pages/Bilan.jsx` :
  - [x] Ajouter un bouton d'action principal "Exporter le Bilan (PDF)" qui appelle `window.print()`.
  - [x] Ajouter un bouton secondaire "Analyser un autre document" redirigeant vers `/`.
  - [x] Ajouter l'état React pour filtrer les anomalies par sévérité (all, high, medium) et concevoir la barre de filtres.
  - [x] Filtrer la liste des anomalies affichées.

## 3. Styles et Mise en page (CSS)
- [x] Ajouter les styles d'impression `@media print` dans `frontend/src/index.css` pour masquer les boutons d'action, le Header et le Footer, et nettoyer le style de la page pour une impression papier/PDF propre.
- [x] Ajouter les styles CSS pour les filtres d'anomalies dans `frontend/src/index.css`.

## 4. Validation et Déploiement
- [x] Valider la compilation locale avec `npm run build` dans le dossier frontend.
- [x] Synchroniser toutes les modifications avec le dossier Desktop (`/Users/hologramconseils/Desktop/RIS Pro V2` et `/Users/hologramconseils/Desktop/RIS Pro V2/ris-pro-web/`).
- [x] Commiter les changements et pousser vers la branche principale.
