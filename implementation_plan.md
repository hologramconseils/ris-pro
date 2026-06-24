# Plan d'implémentation - Suppression de la création de compte gratuite & Tunnel d'achat direct (RIS Pro)

Ce plan décrit la suppression de la création de compte gratuite et l'intégration du flux d'achat direct (Pack 4 analyses à 29 €) qui déclenchera automatiquement la création de compte utilisateur et l'attribution des accès après validation du paiement.

## Modifications proposées

### 1. Écran de Diagnostic (`frontend/src/pages/Diagnostic.jsx`)
- **Suppression définitive** du bouton/lien "Créer un compte" dans le panneau d'authentification pour les utilisateurs non connectés.
- Conservation de deux options principales et claires :
  1. **CTA Principal (Achat direct)** : "Accédez à l'analyse détaillée pour 29 €".
     - Au clic, affiche le formulaire de saisie de l'email pour le paiement sécurisé.
     - Une fois l'email validé, redirige l'utilisateur vers Stripe Checkout.
  2. **Option Client Existant (Lien)** : "Se connecter".
     - Ouvre le formulaire d'authentification standard pour les utilisateurs ayant déjà un compte.

### 2. Écran de Connexion (`frontend/src/pages/Login.jsx`)
- **Suppression définitive** de l'option d'inscription gratuite ("S'inscrire" / "Créer un compte") en bas de la page.
- La page `/login` ne servira plus qu'à la connexion et à la récupération de mot de passe.

### 3. Webhook Stripe (`api/webhook.js`)
Enrichissement du webhook Stripe pour gérer de manière transparente la création de compte automatique des nouveaux clients sans impacter le flux actuel des clients existants connectés au moment du paiement :
- **Si `client_reference_id` (userId) est présent** :
  - Comportement inchangé à 100% (mise à jour des crédits du profil existant + email de confirmation).
- **Si `client_reference_id` est absent (nouveau client / achat direct)** :
  - Utilise l'adresse email de facturation Stripe (`customer_details.email` ou `customer_email`).
  - Vérifie si un compte Supabase Auth existe déjà avec cet email :
    - S'il n'existe pas : crée automatiquement le compte utilisateur dans Supabase Auth (avec confirmation d'email automatique et mot de passe temporaire aléatoire).
    - Récupère l'ID du nouvel utilisateur (ou de l'utilisateur existant).
  - Effectue un `upsert` dans la table `profiles` pour cet ID afin de définir `is_paid = true` and `analysis_credits = 4`.
  - Génère un lien de connexion/récupération automatique (magic link / password recovery link) de Supabase pour permettre au client de se connecter directement et de définir son mot de passe en toute simplicité.
  - Envoie un email de bienvenue enrichi via Resend contenant le lien de connexion directe et ses instructions d'accès.

---

## Proposed Changes

### [Frontend Page Pages]

#### [MODIFY] [Diagnostic.jsx](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/pages/Diagnostic.jsx)
- Retrait du bouton "Créer un compte".
- Ajustement du layout d'authentification pour proposer uniquement le CTA Achat et le lien de Connexion.

#### [MODIFY] [Login.jsx](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/frontend/src/pages/Login.jsx)
- Retrait du lien d'inscription en bas de formulaire.
- Blocage du mode "inscription".

### [API Serverless Functions]

#### [MODIFY] [webhook.js](file:///Users/hologramconseils/.gemini/antigravity/scratch/ris-pro-web/api/webhook.js)
- Ajout de la logique de création de compte et d'upsert du profil en cas de paiement invité (`client_reference_id` null).
- Intégration de la génération du lien magique et envoi de l'email d'accès.

---

## Verification Plan

### Automated Tests
- Lancement de la compilation pour s'assurer qu'aucun bug de syntaxe n'est introduit :
  - `npm run build`

### Manual Verification
1. **Flux Client existant** :
   - Démarrer une analyse sans être connecté.
   - Cliquer sur "Se connecter", s'authentifier avec un compte existant.
   - S'assurer que le tableau de bord et le bilan fonctionnent normalement.
2. **Flux Nouveau client (Achat direct)** :
   - Démarrer une analyse sans être connecté.
   - Cliquer sur "Accédez à l'analyse détaillée pour 29 €", saisir un nouvel email.
   - Simuler le paiement Stripe (ou utiliser l'environnement de test Stripe).
   - Valider la création automatique du compte Supabase, l'upsert du profil avec 4 crédits, et la bonne réception de l'email Resend contenant le lien d'accès direct.
