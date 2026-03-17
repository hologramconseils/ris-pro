# Cahier des Charges Technique & Fonctionnel : RIS Scan Pro

**Version :** 1.0  
**Date :** 17 Mars 2026  
**Auteur :** Antigravity AI (Expert System Design)  
**Destinataire :** Hologram Conseils  

---

## 1. Introduction & Vision du Projet

### 1.1 Objectif
L'application **RIS Scan Pro** est une plateforme SaaS (Software as a Service) permettant aux particuliers et professionnels d'automatiser l'audit de leurs Relevés Individuels de Situation (RIS) de retraite. Elle identifie les anomalies, les trimestres manquants et les absences de points complémentaires.

### 1.2 Vision
Transformer un document administratif complexe (PDF de 10 à 60 pages) en un diagnostic clair, actionnable et professionnel grâce à une analyse hybride (Parsing déterministe + Expertise Algorithmique Multimodale).

---

## 2. Architecture Technique

### 2.1 Stack logicielle
- **Frontend** : React (Vite), SPA (Single Page Application).
- **Backend** : FastAPI (Python 3.9+), asynchrone pour les appels IA.
- **Base de données** : PostgreSQL (Production), SQLAlchemy ORM.
- **Gestion des fichiers** : Système de fichiers local (uploads temporaires) + traitement mémoire.
- **Authentification** : JWT (JSON Web Tokens) avec hachage BCrypt.

### 2.2 Infrastructure Cloud
- **Hébergement Frontend** : Vercel (déploiement continu depuis GitHub).
- **Hébergement Backend** : Render (Web Service Docker/Standard).
- **Service Email** : Resend API (via SDK Python).
- **Service Paiement** : Stripe (Checkout Sessions + Webhooks).
- **Modèles IA** : Gemini 1.5 Flash (Google Cloud) via API REST.

---

## 3. Analyse Fonctionnelle (Logique Métier)

### 3.1 Flux Utilisateur
1. **Landing Page** : Présentation des bénéfices, exemple de rapport.
2. **Inscription/Connexion** : Création de compte avec email validé.
3. **Upload** : Dépôt d'un PDF (< 10 Mo).
4. **Analyse Gratuite** : Aperçu de l'analyse (Année N-1).
5. **Checkout** : Paiement unique de 19€ via Stripe.
6. **Rapport Détaillé** : Accès complet à l'audit, frise chronologique et export PDF/Docx.

### 3.2 Le Moteur de Parsing (ris_parser.py)
Le moteur fonctionne en trois étapes :
1. **Extraction de texte** : Utilisation de `PyMuPDF` (fitz).
2. **Détection de Type** : Si le texte extrait est < 1000 caractères, le document est marqué `is_scanned`.
3. **Logique Séquentielle** :
   - Recherche de l'année de naissance pour déterminer l'année de début d'activité (N+16).
   - Boucle de `start_year` jusqu'à `current_year`.
   - Utilisation de Regex pour capturer les trimestres (`\d trimestres`) et les points.
   - Si une année est présente mais sans trimestres/points -> Anomalie détectée.

### 3.3 L'Audit IA Expert (ai_service.py)
L'IA intervient pour fiabiliser le parsing humain :
- **Entrées** : Nom du fichier, texte brut extrait, et images des pages (si `is_scanned=True`).
- **Prompt (Consigne)** : L'IA doit obligatoirement produire un JSON structuré incluant `niveau_risque`, `resume_global` et `full_timeline`.
- **Formatting** : Interdiction du Markdown pour les résultats afin de faciliter les exports.

---

## 4. Spécifications des Données

### 4.1 Inputs (Données d'entrée)
- **Fichier PDF** : Un relevé RIS standard (GIP Union Retraite).
- **Metadata** : Nom de l'utilisateur, Date d'upload.

### 4.2 Outputs (Résultats générés)
- **Tableau de bord** : Liste des analyses passées.
- **Diagnostic visuel** : Badge de risque (Faible, Moyen, Élevé).
- **Export PDF** : Rendu noir et blanc, marges 15mm, typo standard, sans éléments UI.
- **Export DOCX** : Fichier natif Microsoft Office Open XML avec texte justifiable.

---

## 5. Mécanismes de Sécurité

### 5.1 Protection des Données (RGPD)
- Les PDF sont sauvegardés temporairement pour le traitement puis peuvent être purgés.
- Les données sensibles (noms, montants) ne sont accessibles qu'à l'utilisateur propriétaire via le `user_id` lié au JWT.
- Suppression de compte possible avec cascade sur les analyses.

### 5.2 Sécurité Infrastructure
- **Rate Limiting** : `slowapi` limite les tentatives sur `/auth` et `/upload` (protection Anti-DDoS).
- **Headers HTTP** :
  - `HSTS` : Force la connexion HTTPS.
  - `CSP` : Restreint l'exécution de scripts tiers.
  - `nosniff` : Empêche l'interprétation de fichiers malveillants.
- **Stripe Webhooks** : Vérification de la signature (`Stripe-Signature`) et secret d'endpoint pour empêcher les faux paiements.

---

## 6. Guide d'Implémentation pour un Développeur

### Phase 1 : Environnement
1. Installer Python 3.9+ et Node.js 18+.
2. Créer une DB PostgreSQL.
3. Configurer les clés API : `STRIPE_SECRET_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `SECRET_KEY` (JWT).

### Phase 2 : Backend
1. Définir les modèles SQLAlchemy (`User`, `ScanResult`, `Transaction`).
2. Implémenter le parser de PDF utilisant des Regex et `PyMuPDF`.
3. Créer l'API FastAPI avec les routes d'authentification et de paiement.
4. Intégrer Gemini Flash via un client `httpx` asynchrone (timeout 120s pour OCR).

### Phase 3 : Frontend
1. Initialiser une App React avec `Vite`.
2. Créer les pages : Landing, Login, Dashboard, Result.
3. Utiliser un `AuthContext` pour stocker le token JWT et l'état `has_paid_access`.
4. Intégrer `html2pdf.js` et `docx` lib pour les fonctions d'export.

### Phase 4 : Déploiement
1. Pousser sur GitHub.
2. Déclarer les variables d'environnement sur Vercel et Render.
3. Configurer le domaine custom avec les enregistrements CNAME/A pour le certificat SSL.

---

## 7. Archivage et Audit
Ce document doit être conservé comme schéma directeur. Toute modification structurelle de l'IA ou du moteur de parsing doit entraîner une mise à jour de la section 3.2 et 3.3.

**FIN DU DOCUMENT**
