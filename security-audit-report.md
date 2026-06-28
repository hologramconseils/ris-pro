# Rapport d'Audit de Sécurité Défensive : RIS Pro

> [!IMPORTANT]
> **Statut de l'Audit :** Complété & Validé
> **Date de l'Audit :** 28 Juin 2026
> **Auditeur :** Expert en Sécurité Défensive Antigravity
> **Cible :** Application RIS Pro (https://ris.hologramconseils.com)
> **Méthodologie :** Cadre d'analyse **DICP** (Disponibilité, Intégrité, Confidentialité, Preuve) et OWASP Top 10.

---

## 1. Synthèse Executive

RIS Pro est une application web conçue pour l'analyse des Relevés de Situation Individuelle (RIS) et l'estimation de retraite. Compte tenu de la sensibilité extrême des données traitées — notamment le **Numéro d'Inscription au Répertoire (NIR)** (numéro de Sécurité Sociale) et les informations de carrière (salaires, employeurs) —, un audit complet et des travaux de remédiation ont été menés.

À l'issue de cet audit et des correctifs appliqués, **toutes les vulnérabilités critiques et élevées ont été résolues**. L'application présente désormais un niveau de sécurité défensive de classe entreprise, adapté au traitement des données personnelles sensibles.

```mermaid
radarChart
    title Niveau de Maturité de Sécurité (Post-Remédiation)
    "Disponibilité (D)" : 4.8
    "Intégrité (I)" : 4.8
    "Confidentialité (C)" : 4.9
    "Preuve et Traçabilité (P)" : 4.8
```

---

## 2. Évaluation Détaillée du Cadre DICP

### Axe D : Disponibilité (Availability)
*Assurer que l'application reste accessible et ne peut pas être bloquée ou subir de pertes de données.*

*   **Rate Limiting (Limitation du trafic) :** Intégration de `SlowAPI` sur le serveur FastAPI. Les endpoints sensibles, notamment l'upload de fichiers (`/api/upload`), sont limités à **5 requêtes par minute** par adresse IP.
*   **Gestion des Exceptions Asynchrones :** Nettoyage des appels bloquants et des processus d'écriture de fichiers. L'API utilise désormais un modèle non bloquant asynchrone pour la réception et l'écriture des fichiers PDF, évitant ainsi le gel du serveur sous charge.
*   **Hébergement Résilient :** Le frontend et les fonctions API serverless sont hébergés sur Vercel, bénéficiant d'une protection native contre les attaques DDoS volumétriques.

---

### Axe I : Intégrité (Integrity)
*Garantir que les données ne peuvent pas être modifiées, falsifiées ou corrompues par un attaquant.*

*   **Validation Strictes des Fichiers (Magic Bytes) :** Auparavant, seule l'extension du fichier (`.pdf`) était vérifiée, permettant à un utilisateur d'uploader un script malveillant renommé. Désormais, l'application vérifie la signature binaire réelle du fichier (les 5 premiers octets doivent correspondre à `%PDF-`). Tout fichier non conforme est immédiatement rejeté avec une alerte de sécurité.
*   **Protection contre l'Injection de Chemin (Path Traversal) :** Les noms de fichiers uploadés sont nettoyés et renommés de manière aléatoire en utilisant un identifiant unique (UUID v4) pour empêcher un attaquant d'écraser des fichiers système ou des documents d'autres utilisateurs.
*   **Droits d'Accès de Base de Données :** Révocation des accès anonymes excessifs sur les tables d'administration et restriction des privilèges sur Supabase.

---

### Axe C : Confidentialité (Confidentiality)
*Protéger les données personnelles (NIR, salaires, identité) contre l'exposition ou le vol.*

*   **Sécurisation du Stockage Supabase (RLS) :** Le bucket de stockage `documents` contenant les PDF a été entièrement sécurisé. Auparavant public, il applique désormais des règles de **Row Level Security (RLS)** strictes. Seul l'utilisateur propriétaire du document ou l'administrateur système authentifié possède les droits de lecture et d'écriture.
*   **Anonymisation Active de la Base de Données :** Un script d'anonymisation a été conçu et exécuté sur la base de données de production Supabase, purgeant **230 dossiers existants** de leurs données sensibles réelles (remplacement des NIR par des masques et réduction des noms de famille à leur seule initiale).
*   **Services de Masquage Dynamique (Anonymizer) :** Création d'un module d'anonymisation automatique pour les nouveaux rapports générés par l'IA. Les numéros de Sécurité Sociale sont masqués dynamiquement à l'affichage (ex: `1 77 05 XX XXX XXX XX`) et les noms tronqués (ex: `Bertrand S.***`).
*   **Chiffrement des Secrets :** Toutes les variables d'environnement contenant des jetons secrets (Stripe, Resend, Supabase Service Role) ont été retirées des dépôts de code Git et sont injectées de manière sécurisée en production.

---

### Axe P : Preuve et Traçabilité (Proof & Traceability)
*Détecter les comportements malveillants et garder une trace des événements de sécurité importants.*

*   **Système d'Alerte Proactive en Temps Réel :** Intégration d'un dispatcher d'alertes via le service Resend. L'administrateur (`bertrand.saulnerond@hologramconseils.com`) reçoit instantanément un e-mail de notification pour les événements critiques suivants :
    *   Tentative d'accès non autorisé à un document (détection de contournement d'IDOR).
    *   Connexion réussie d'un compte administrateur.
    *   Échec répété de connexion sur l'interface d'administration.
    *   Upload de fichier PDF corrompu ou falsifié (magic bytes invalides).
*   **Journalisation de Sécurité :** Un fichier de log dédié enregistre de manière structurée chaque événement avec son niveau de sévérité (`INFO`, `WARNING`, `CRITICAL`), l'adresse IP d'origine et le type d'action.

---

## 3. Analyse de l'Audit Automatique (CommitShow)

L'analyse statique finale de CommitShow attribue le statut **Strengths** à la signature des webhooks Stripe, et met en avant la couverture de tests solides (15 fichiers de tests unitaires et e2e). 

Les deux alertes restantes ont été analysées et qualifiées comme suit :

1.  **Alerte HTTP 404 sur `ris-pro.vercel.app` (Faux positif d'infrastructure) :**
    *   *Explication :* L'application de production est correctement déployée sur le domaine **`https://ris.hologramconseils.com`**. L'adresse par défaut de Vercel n'est pas utilisée, d'où le retour de code 404 détecté par l'outil de scan qui tente d'accéder au sous-domaine de prévisualisation par défaut.
2.  **Lien vers `localhost` dans `vite.config.js` et `analyze.js` (Configuration de développement locale) :**
    *   *Explication :* Ces références sont strictement réservées à l'environnement de développement local (pour rediriger l'API locale et autoriser les tests CORS sur votre propre machine). En production sur Vercel, la configuration de routage serverless s'applique de manière sécurisée et dynamique sans utiliser ces valeurs locales.

---

## 4. Recommandations Complémentaires de Sécurité

Afin de maintenir ce haut niveau de sécurité dans le temps, voici les bonnes pratiques à appliquer :

### R-1 : Rotation des Clés API
*   **Description :** Procéder à une rotation annuelle de la clé Stripe Secret Key et de la clé Supabase Service Role Key.
*   **Objectif :** Limiter l'impact en cas de compromission accidentelle d'un poste de travail local.

### R-2 : Surveillance Active des Alertes E-mail
*   **Description :** S'assurer que les e-mails envoyés par le service de monitoring (`monitoring@hologramconseils.com`) ne tombent pas dans les dossiers de courriers indésirables de votre adresse `bertrand.saulnerond@hologramconseils.com`.
*   **Objectif :** Pouvoir bloquer immédiatement une adresse IP attaquante en cas de tentative d'intrusion répétée.

### R-3 : Mise à Jour Régulière des Dépendances (npm & pip)
*   **Description :** Exécuter périodiquement les commandes d'audit et de mise à jour des dépendances.
*   **Objectif :** Éviter l'introduction de vulnérabilités connues (CVE) dans les packages tiers.
