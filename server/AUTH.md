# Comptes gérés par RIS Pro (remplacement de Clerk)

Objectif : plus aucun service d'authentification hors de l'Union européenne. Les comptes, les sessions et
les e-mails de compte (confirmation, mot de passe oublié) sont gérés par RIS Pro, dans la base PostgreSQL du
serveur, avec Brevo pour l'envoi.

## Conception

- **Identifiants** : les comptes repris de Clerk gardent leur identifiant (`user_…`), donc les profils et les
  analyses existants ne changent pas. Les nouveaux comptes reçoivent `usr_` + 24 caractères hexadécimaux.
- **Mots de passe** : scrypt (N=2^15, r=8, p=3), sel aléatoire, comparaison à durée constante, longueur de 12 à
  128 caractères. L'empreinte est recalculée à la connexion si les paramètres changent.
- **Sessions** : jeton aléatoire de 256 bits dans un cookie `__Host-ris_session` (HttpOnly, Secure, SameSite=Lax).
  Seule l'empreinte SHA-256 est en base. Durée maximale de 7 jours ; refusée après 12 h sans requête ; fermeture
  immédiate à la déconnexion ou au changement de mot de passe. La déconnexion automatique après 10 minutes
  d'inactivité reste gérée par le site.
- **Jetons à usage unique** (confirmation d'adresse 24 h, mot de passe oublié 1 h, connexion après paiement 7 jours) :
  empreinte en base, consommation atomique, un nouveau lien invalide le précédent.
- **Inscription par l'adresse seule** : le formulaire ne demande que l'e-mail ; le mot de passe est choisi sur la page
  ouverte par le lien reçu. Seul le propriétaire de la boîte peut donc définir le mot de passe d'un compte (pas de
  « pré-détournement » : quelqu'un qui s'inscrirait avec l'adresse d'autrui ne peut rien en tirer). Un compte non
  activé ne peut pas se connecter.
- **Protection** : limitation du nombre d'essais par adresse et par adresse IP (refus si la base est indisponible),
  réponses identiques que le compte existe ou non (inscription, mot de passe oublié, connexion), e-mails envoyés en
  tâche de fond, calcul d'une empreinte factice quand l'adresse est inconnue, contrôle de l'en-tête Origin sur toute
  requête qui modifie quelque chose, liens construits uniquement à partir de `NEXT_PUBLIC_SITE_URL`, réponses jamais
  mises en cache. Un mot de passe refusé (trop court…) ne consomme pas le lien.

## Points d'accès (`/api/auth?action=…`)

| action | méthode | rôle |
|---|---|---|
| `me` | GET | utilisateur de la session en cours, ou `null` (toujours 200) |
| `register` | POST `{email}` | crée le compte sans mot de passe, envoie le lien d'activation (ou un rappel « compte déjà existant ») |
| `activate` | POST `{token, password}` | choisit le mot de passe depuis le lien d'activation, vérifie l'adresse |
| `login` | POST `{email, password}` | ouvre la session (cookie) |
| `logout` | POST | ferme la session |
| `forgot` | POST `{email}` | envoie le lien de réinitialisation |
| `reset` | POST `{token, password}` | nouveau mot de passe, ferme toutes les sessions |
| `magic` | POST `{token}` | connexion par le lien reçu après un paiement |

Pages du site associées : `/activation`, `/reinitialisation`, `/connexion-lien` (étape 3). Le serveur ne route que
`/api/<nom>` à un seul segment, d'où l'action passée en paramètre.

## Étapes (chacune dans sa propre pull request, sans effet en production avant la dernière)

1. **Fondations** : tables, mots de passe, jetons, sessions, cookie (`lib/passwords.js`, `lib/authTokens.js`,
   `lib/authCookie.js`, `lib/authStore.js`).
2. **Points d'accès** `/api/auth` : inscription, activation, connexion, déconnexion, utilisateur courant,
   mot de passe oublié et réinitialisation, connexion par lien, avec les e-mails Brevo (`lib/authApi.js`,
   `lib/authEmails.js`, `lib/authRequest.js`, `api/auth.js`).
3. **Site** : écrans de connexion et d'inscription, menu du compte, déconnexion automatique ; vérification de session
   dans les 5 fonctions d'API à la place du jeton Clerk.
4. **Paiement et bascule** : création du compte et lien de connexion après un paiement, reprise des comptes Clerk,
   retrait de Clerk (dépendances, variables, texte légal).

## Hors périmètre

La connexion par un compte Google n'est pas reprise.
