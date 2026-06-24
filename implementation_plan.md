# Plan d'implémentation - Double point d'entrée et Achat avec Création de Compte (RIS Pro)

Ce plan détaille les ajustements apportés à l'écran de Diagnostic pour les utilisateurs non connectés afin de proposer le double point d'entrée (connexion et achat via création de compte) directement sur la page, tout en garantissant zéro régression technique avec Supabase et Stripe.

## Changements Proposés

### 1. Simplification du Flux d'Authentification et d'Achat ([Diagnostic.jsx](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/pages/Diagnostic.jsx))
* **Affichage Direct** : Si l'utilisateur n'est pas connecté (`!user`), la double entrée d'authentification et d'achat s'affiche directement en bas de l'analyse, sans étape intermédiaire.
* **Bouton B (CTA Principal - Achat & Inscription)** : 
  - Bouton bleu plein "Accédez à l'analyse détaillée pour 29 €".
  - Au clic, il affiche le formulaire d'inscription complet (Prénom, Nom, Email, Mot de passe).
* **Bouton A (Connexion existante)** :
  - Lien texte gras "Se connecter" redirigeant vers la page de connexion.
* **Bouton d'Inscription secondaire** :
  - Bouton bleu plein "Créer un compte" qui affiche également le formulaire d'inscription.
* **Formulaire d'Inscription** :
  - Ajout d'un bouton "← Retour" sous le formulaire pour permettre de revenir à l'écran de choix initial si besoin.
  - Soumettre le formulaire crée le compte de l'utilisateur dans Supabase et le redirige immédiatement vers la session de paiement Stripe personnalisée avec son identifiant (`userId`) et email.
* **Nettoyage du parcours invité (sans compte)** :
  - Suppression de la saisie d'email invité temporaire et de la redirection Stripe sans `userId`, car cela provoquait des régressions fonctionnelles avec le webhook Stripe (qui nécessite `client_reference_id` / `userId` pour créditer le compte).

### 2. Ajustements des Styles CSS ([index.css](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/index.css))
* Nettoyage des styles liés au guest checkout.
* Optimisation de l'affichage du formulaire et des boutons secondaires.

---

## Plan de Vérification

### Compilation du projet
* S'assurer que le projet compile parfaitement sans erreurs :
  ```bash
  npm run build
  ```

### Vérification Fonctionnelle
* S'assurer que le flux d'inscription + paiement Stripe transmet correctement le `userId` et l'email à Stripe.
* Vérifier le comportement visuel sur mobile et tablette.
