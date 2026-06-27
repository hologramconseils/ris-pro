# Liste des tâches - Interface Bilan Premium (React)

## 1. Logique d'appel de l'Agent Patrimonial
- [x] Modifier `Bilan.jsx` pour introduire l'état `agentLoading` et appeler l'API `/api/analyse-patrimoniale` si l'utilisateur est Premium et que les données ne contiennent pas encore les stratégies de conseil.

## 2. Rendu Visuel (HTML & CSS)
- [x] Ajouter la section "Conseil Patrimonial & Optimisation" avec le widget d'Âge estimé et la synthèse globale.
- [x] Ajouter les cartes des stratégies de conseil avec leurs badges d'impact.
- [x] Ajouter le bloc commentaire du conseiller CGP avec style premium.

## 3. Synchronisation & Validation
- [x] Synchroniser toutes les modifications avec les dossiers Desktop.
- [x] Lancer la compilation de build pour vérifier qu'il n'y a pas de régression.
- [x] Faire un commit git et pousser sur la branche distante (`git push`).
