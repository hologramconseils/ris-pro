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
- **Protection** : limitation du nombre d'essais par adresse et par adresse IP, réponses identiques que le compte
  existe ou non, calcul d'une empreinte factice quand l'adresse est inconnue.

## Étapes (chacune dans sa propre pull request, sans effet en production avant la dernière)

1. **Fondations** : tables, mots de passe, jetons, sessions, cookie (`lib/passwords.js`, `lib/authTokens.js`,
   `lib/authCookie.js`, `lib/authStore.js`).
2. **Points d'accès** `/api/auth/*` : inscription, connexion, déconnexion, utilisateur courant, confirmation d'adresse,
   mot de passe oublié et réinitialisation, avec les e-mails Brevo.
3. **Site** : écrans de connexion et d'inscription, menu du compte, déconnexion automatique ; vérification de session
   dans les 5 fonctions d'API à la place du jeton Clerk.
4. **Paiement et bascule** : création du compte et lien de connexion après un paiement, reprise des comptes Clerk,
   retrait de Clerk (dépendances, variables, texte légal).

## Hors périmètre

La connexion par un compte Google n'est pas reprise.
