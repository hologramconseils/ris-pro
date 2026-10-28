# Politique de Confidentialité et Protection des Données (RGPD) - RIS Pro

*Dernière mise à jour : 28 juin 2026*

La présente Politique de Confidentialité définit la manière dont **Hologram Conseils** collecte, utilise, protège et conserve les données à caractère personnel dans le cadre de l'utilisation de l'application **RIS Pro** (ci-après "l'Application"), accessible à l'adresse `https://ris.hologramconseils.com`.

Hologram Conseils s'engage à ce que la collecte et le traitement de vos données soient conformes au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.

---

## 1. Responsable du Traitement
Le responsable du traitement des données personnelles est :
**Hologram Conseils**
Représenté par Bertrand Saulnerond
Email : `bertrand.saulnerond@hologramconseils.com`

---

## 2. Données Personnelles Collectées
Nous collectons et traitons les données suivantes :
*   **Données de compte** : Prénom, nom, adresse e-mail, mot de passe chiffré.
*   **Données professionnelles et de carrière** : Relevé d'Information Individuel (RIS) ou Estimation Indicative Globale (EIG) téléversé au format PDF, historique des salaires, trimestres validés, noms des employeurs et années d'activité.
*   **Données d'identité hautement sensibles (NIR)** : Numéro de Sécurité Sociale (NIR) figurant sur votre document RIS.
*   **Données de transaction** : Informations de facturation et statut du paiement gérés de manière sécurisée par notre prestataire Stripe (les coordonnées bancaires ne transitent jamais sur nos serveurs).
*   **Données de connexion et de navigation** : Adresse IP, logs de connexion et requêtes système à des fins de sécurité.

---

## 3. Finalités et Bases Légales du Traitement

| Type de traitement | Finalité du traitement | Base légale |
| :--- | :--- | :--- |
| **Gestion du compte** | Permettre l'accès à l'espace membre et l'historique des bilans. | Exécution d'un contrat (CGV) |
| **Audit de carrière** | Analyser le relevé de carrière et identifier les anomalies réglementaires. | Consentement explicite de l'utilisateur lors du téléversement du document |
| **Paiement Premium** | Traiter les transactions pour l'achat du Bilan Premium. | Exécution d'un contrat (CGV) |
| **Sécurisation de l'App** | Prévenir la fraude, le piratage et les attaques par force brute (Rate Limiting). | Intérêt légitime du responsable de traitement |

---

## 4. Mesures Strictes de Sécurité et de Confidentialité
Conformément aux exigences du RGPD et suite aux optimisations de sécurité de l'Application, nous mettons en œuvre les mesures techniques suivantes :
*   **Masquage du Numéro de Sécurité Sociale (NIR)** : Le NIR extrait du document PDF n'est jamais stocké en clair dans nos bases de données. Il est immédiatement haché de manière irréversible à des fins de vérification d'unicité, puis masqué sous la forme `1 77 05 XX XXX XXX XX` (seuls le genre, l'année et le mois de naissance indispensables au calcul de la retraite restent visibles).
*   **Anonymisation des bilans pour l'administration** : Les noms de famille et les données textuelles brutes sont anonymisés à l'affichage pour les administrateurs du site afin d'empêcher toute fuite interne.
*   **Sécurisation du Stockage** : Les fichiers PDF importés sont stockés dans un espace privé OVHcloud (Gravelines, France). Chaque accès est vérifié côté serveur : seul le propriétaire connecté à son compte peut consulter ses propres analyses. La base de données est hébergée sur notre serveur (Helsinki, Finlande) et n'est jamais accessible directement depuis Internet.
*   **Chiffrement** : Les données transitent via le protocole sécurisé HTTPS (SSL/TLS). Les fichiers PDF sont chiffrés au repos par le service de stockage, et les sauvegardes de la base de données sont chiffrées (AES-256) avant d'être copiées hors du serveur.
*   **Transferts hors de l'Union européenne** : Les documents et résultats d'analyse sont hébergés exclusivement dans l'Union européenne (Finlande, France). Les comptes (adresse e-mail, mot de passe chiffré de façon irréversible, sessions) sont gérés par RIS Pro sur son propre serveur. Seul Stripe (paiement) peut traiter des données hors de l'Union européenne, avec les garanties prévues par le RGPD ; aucun document de carrière ne lui est transmis.

---

## 5. Destinataires et Sous-traitants des Données
Vos données personnelles ne sont jamais vendues ou cédées à des tiers. Elles sont uniquement partagées avec nos sous-traitants techniques dans la limite nécessaire au bon fonctionnement de l'Application :
*   **Hetzner Online GmbH** (Allemagne, serveurs à Helsinki, Finlande) : Hébergement du site web, de l'API et de la base de données.
*   **OVHcloud** (France, Gravelines) : Stockage privé des fichiers PDF et des sauvegardes chiffrées de la base de données.
*   **Stripe** (Stripe Payments Europe, Irlande) : Traitement sécurisé des transactions de paiement.
*   **Brevo** (société française, serveurs dans l’Union européenne) : Envoi des e-mails transactionnels (confirmation de compte, réinitialisation de mot de passe, alertes).
*   **Mistral AI (France)** : Lecture du relevé et rédaction de l'analyse, traitement temporaire du contenu du RIS pour l'analyse des anomalies (les données envoyées ne sont pas utilisées pour entraîner les modèles d'IA).

---

## 6. Durée de Conservation des Données
*   **Fichiers PDF importés** : Conservés de manière sécurisée pendant 6 mois après leur dépôt, puis supprimés automatiquement et définitivement. Les résultats de l'analyse restent consultables dans votre espace. Vous pouvez demander leur suppression anticipée à tout moment en écrivant à bertrand.saulnerond@hologramconseils.com.
*   **Données de compte** : Conservées pendant toute la durée de vie du compte, puis supprimées après 3 ans d'inactivité.
*   **Données de paiement** : Conservées pendant 10 ans conformément aux obligations comptables et fiscales françaises.

---

## 7. Vos Droits (RGPD)
Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :
*   **Droit d'accès** : Obtenir la confirmation que vos données sont traitées et en obtenir une copie.
*   **Droit de rectification** : Demander la correction de données inexactes ou incomplètes.
*   **Droit à l'effacement ("Droit à l'oubli")** : Demander la suppression de vos données personnelles et de vos fichiers.
*   **Droit d'opposition et de limitation** : Vous opposer ou restreindre certains traitements de vos données.
*   **Droit à la portabilité** : Récupérer vos données dans un format structuré et lisible.

Pour exercer l'un de ces droits, vous pouvez nous contacter par e-mail à : **`bertrand.saulnerond@hologramconseils.com`**

Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez adresser une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) sur leur site internet `https://www.cnil.fr`.
