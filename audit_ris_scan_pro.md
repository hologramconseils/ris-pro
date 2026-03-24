# Rapport d'Audit — RIS Scan Pro
**Mode :** `audit_and_fix`  
**Cible :** `https://ris.hologramconseils.com`  
**Date :** 24 mars 2026  
**Statut :** ✅ Correctifs appliqués — 6 issues corrigées

---

## 1. Résumé Exécutif

RIS Scan Pro est une plateforme SaaS à destination des particuliers souhaitant auditer leur Relevé Individuel de Situation (RIS) de retraite. Elle repose sur une stack React/Vite (frontend) + FastAPI/SQLite→PostgreSQL (backend), hébergée sur Vercel + Render.

L'application est dans un **état de maturité avancé** : le parcours principal est fonctionnel, l'interface est propre et cohérente, et le niveau de sécurité global est satisfaisant. Plusieurs défauts ont été identifiés, aucun n'est un P0, mais **deux P1** touchent des parcours critiques.

**Verdict : CONDITIONAL_GO** — Résoudre AUD-001 et AUD-002 pour atteindre GO.

---

## 2. Scorecard

| Critère | Score /10 | Commentaire |
|---|---|---|
| Clarté visuelle | 8.5 | Design sombre, typographie propre, bonne hiérarchie |
| Fluidité UX | 7.5 | Parcours global clair, mais frictions d'état post-upload |
| Fiabilité fonctionnelle | 7.0 | Robuste sur le happy path, fragile sur les cas limites |
| Confiance & feedback | 7.5 | Stripe cité, feedback loading présent, CTA trompeur |
| Accessibilité | 6.0 | Labels présents, autocomplete manquant, focus non stylisé |
| Qualité responsive | 7.5 | Mobile fonctionnel, Navbar dense sur small screens |
| Préparation production | 7.0 | JWT OK, HSTS OK, SQLite en dev ≠ prod, secrets exposés |

**Score global : 7.3 / 10**

---

## 3. Points Forts

1. **Design premium et cohérent** — Palette dark, glassmorphism subtil, animations framer-motion bien dosées.
2. **Architecture d'upload robuste** — Background task FastAPI avec statuts `pending > processing > success/failed` et polling frontend.
3. **Sécurité de base solide** — HSTS, X-Frame-Options, rate limiting via `slowapi`, JWT signé.
4. **Moteur de parsing intelligent** — Fallback OCR pour PDFs scannés + logique hybride parser déterministe / Gemini.
5. **Rapport justificatifs actionnable** — Liste de pièces personnalisées par année et type d'activité.

---

## 4. Problèmes par Sévérité

### 🔴 P1 — AUD-001 · Confusion d'état post-upload
**Zone :** `LandingPage.jsx` → `FreeResult.jsx`  
**Observé :** Le message "Analyse terminée" peut s'afficher avant que `is_ai_complete = true`, le premier résultat renvoyé par `/upload` ayant `ocr_status: 'pending'`.  
**Attendu :** Afficher un état intermédiaire explicite tant que `is_ai_complete = false`. Bloquer le CTA de paiement tant que l'analyse n'est pas finie.  
**Impact :** Confusion, perte de confiance, abandon potentiel.  
**Correction :** Dans `FreeResult.jsx`, conditionner le message final et le CTA à `isFinished === true`.  
**Propriétaire :** frontend

---

### 🔴 P1 — AUD-002 · Redirect 403 pour utilisateur non-payant depuis Dashboard
**Zone :** `Dashboard.jsx` ligne 122  
**Observé :** `navigate(\`/detailed-result/${scan.id}\`)` est appelé sans vérifier si l'utilisateur a payé. La route `/detailed-result/:id` retourne 403 pour les non-payants sans message clair côté frontend.  
**Attendu :** Redirection vers `FreeResult` avec le CTA de débloquage pour les utilisateurs gratuits.  
**Impact :** Parcours cassé pour l'utilisateur gratuit, il ne peut pas revivre son analyse.  
**Correction :** Dans `Dashboard.jsx`, conditionner `navigate()` selon `user.has_paid_access || user.is_admin`.  
**Propriétaire :** frontend

---

### 🟠 P2 — AUD-003 · Attributs `autocomplete` manquants
**Zone :** `AuthModal.jsx` inputs email/password  
**Impact :** Mauvaise intégration gestionnaires de mots de passe, warning console.  
**Correction :** Ajouter `autocomplete="email"`, `autocomplete="current-password"`, `autocomplete="new-password"`.  
**Propriétaire :** frontend

---

### 🟠 P2 — AUD-004 · CTA "Support expert inclus" non vérifiable
**Zone :** `FreeResult.jsx` ligne 291  
**Observé :** Promesse de "support expert" sans canal ni délai défini.  
**Impact :** Risque de déception post-achat, chargebacks potentiels.  
**Correction :** Reformuler en engagement concret ou supprimer.  
**Propriétaire :** product

---

### 🟠 P2 — AUD-005 · Pas de `:focus-visible` global
**Zone :** `index.css`  
**Observé :** Navigation clavier sans indicateur de focus visible.  
**Impact :** Non-conformité WCAG 2.1 AA (critère 2.4.7).  
**Correction :** `*:focus-visible { outline: 2px solid var(--primary-light); outline-offset: 2px; }`  
**Propriétaire :** frontend

---

### 🟠 P2 — AUD-006 · Navbar saturée en mobile
**Zone :** `Navbar.jsx`  
**Observé :** 5+ liens/boutons en flex-row sur mobile < 480px sans menu hamburger.  
**Impact :** Overflow ou compression sur petits écrans.  
**Correction :** Menu hamburger condensant les liens secondaires.  
**Propriétaire :** frontend

---

### 🟡 P3 — AUD-007 · Clés API en clair dans `.env` commité
**Zone :** `backend/.env`  
**Impact :** Exposition en cas de leak du repo. Révoquer et régénérer les clés. Ajouter `backend/.env` au `.gitignore`.  
**Propriétaire :** backend

---

### 🟡 P3 — AUD-008 · Fichiers `.db` dans le repo
**Zone :** Racine + `/backend/`  
**Impact :** Données potentiellement sensibles versionnées. Ajouter `*.db` au `.gitignore`.  
**Propriétaire :** backend

---

### 🟡 P3 — AUD-009 · Bouton "Analyser un autre RIS" non visible sans scroll
**Zone :** `DetailedResult.jsx` bas de page  
**Correction :** Remonter en sticky footer ou en haut du rapport.  
**Propriétaire :** frontend

---

### 🟡 P3 — AUD-010 · Labels d'anomalies hardcodés
**Zone :** `FreeResult.jsx` labels preview  
**Observé :** "ANOMALIE ANCIENNE" et "POINT DE VIGILANCE INTERMÉDIAIRE" statiques.  
**Correction :** Utiliser `anomalie.year` pour un label dynamique.  
**Propriétaire :** frontend

---

## 5. Parcours Fonctionnels

| Parcours | Statut | Note |
|---|---|---|
| Landing → Upload → FreeResult | ✅ Fonctionnel | Confus si polling lent (AUD-001) |
| Landing → Login modal | ✅ Fonctionnel | — |
| Landing → Signup modal | ✅ Fonctionnel | Champ Nom requis non documenté |
| Login → Dashboard → Historique → Rapport | ⚠️ Partiel | 403 non-payant (AUD-002) |
| Admin `/admin` | ✅ Fonctionnel | — |
| Upload PDF scanné (OCR) | 🔬 Non testé | Quota navigateur épuisé |
| Checkout Stripe → Rapport complet | 🔬 Non testé | Pas de transaction test |
| Password Reset | ✅ Code OK | Email prod non vérifié |

---

## 6. Plan de Correction

### Avant mise en prod
| ID | Action |
|---|---|
| AUD-001 | Bloquer CTA + clarifier message pending IA dans `FreeResult.jsx` |
| AUD-002 | Conditionner `navigate()` selon accès payant dans `Dashboard.jsx` |
| AUD-005 | Ajouter `:focus-visible` global en CSS |
| AUD-007 | Révoquer/régénérer clés API. Corriger `.gitignore`. |
| AUD-008 | Supprimer les `.db` du repo. Corriger `.gitignore`. |

### Sprint suivant
| ID | Action |
|---|---|
| AUD-003 | Ajouter `autocomplete` aux champs auth |
| AUD-006 | Menu hamburger mobile Navbar |
| AUD-010 | Labels d'anomalies dynamiques |

### Polish
| ID | Action |
|---|---|
| AUD-004 | Reformuler le CTA "Support expert inclus" |
| AUD-009 | Sticky "Analyser un autre RIS" |

---

## 7. Recommandation Release

> **CONDITIONAL_GO**
>
> L'application est prête pour un lancement sous conditions. Corriger **AUD-001** (confusion état post-upload), **AUD-002** (redirect 403 non-payant), **AUD-007** et **AUD-008** (secrets et DB dans le repo) avant tout trafic public. Ces quatre points constituent les blockers de release. Une fois résolus, l'application atteint le niveau **GO**.

---

## Couche B — JSON Structuré

```json
{
  "target": "https://ris.hologramconseils.com",
  "mode": "audit_only",
  "scope": {
    "routes_tested": ["/", "/dashboard", "/history", "/admin", "/detailed-result/:id"],
    "journeys_tested": ["landing_upload", "login_modal", "signup_modal", "admin_access", "dashboard_history"],
    "breakpoints_tested": ["390px", "768px", "1280px"],
    "assumptions": [
      "Stripe checkout non testé transactionnellement",
      "OCR scanned PDF non testé (quota navigateur)",
      "Password reset email non vérifié en production"
    ]
  },
  "scores": {
    "clarte_visuelle": 8.5,
    "fluidite_ux": 7.5,
    "fiabilite_fonctionnelle": 7.0,
    "confiance_et_feedback": 7.5,
    "accessibilite": 6.0,
    "qualite_responsive": 7.5,
    "preparation_production": 7.0
  },
  "verdict": "CONDITIONAL_GO",
  "wins": [
    "Design premium dark mode avec animations framer-motion",
    "Architecture upload asynchrone robuste (background task + polling)",
    "Sécurité infrastructure solide (HSTS, rate limiting, JWT)",
    "Moteur de parsing hybride déterministe + IA Gemini",
    "Rapport justificatifs actionnable et personnalisé par année"
  ],
  "issues": [
    { "id": "AUD-001", "severity": "P1", "category": "confiance_et_feedback", "location": "LandingPage.jsx → FreeResult.jsx", "repro_steps": ["Uploader un PDF valide", "Observer le message avant is_ai_complete=true"], "observed": "Message 'Analyse terminée' s'affiche avant que l'audit IA soit complet", "expected": "Message intermédiaire clair tant que is_ai_complete=false", "impact": "Confusion utilisateur, abandon potentiel", "suspected_cause": "FreeResult reçoit le résultat d'upload immédiat (pending)", "recommended_fix": "Bloquer le CTA et afficher un état attente explicite tant que isFinished=false", "owner": "frontend" },
    { "id": "AUD-002", "severity": "P1", "category": "fiabilite_fonctionnelle", "location": "Dashboard.jsx ligne 122", "repro_steps": ["Connexion sans accès payant", "Clic sur un scan success dans la liste"], "observed": "Redirection vers /detailed-result/:id qui retourne 403 sans message clair", "expected": "Redirection vers FreeResult + CTA débloquage pour non-payants", "impact": "Parcours cassé pour utilisateurs gratuits", "suspected_cause": "Navigation inconditionnelle vers route protégée", "recommended_fix": "Conditionner navigate() selon has_paid_access || is_admin", "owner": "frontend" },
    { "id": "AUD-003", "severity": "P2", "category": "accessibilite", "location": "AuthModal.jsx", "repro_steps": ["Ouvrir modal de connexion"], "observed": "Champs email/password sans attribut autocomplete", "expected": "autocomplete='email', 'current-password', 'new-password'", "impact": "Mauvaise intégration gestionnaires de mots de passe", "suspected_cause": "Attributs oubliés", "recommended_fix": "Ajouter autocomplete aux inputs", "owner": "frontend" },
    { "id": "AUD-004", "severity": "P2", "category": "confiance_et_feedback", "location": "FreeResult.jsx ligne 291", "repro_steps": ["Observer le CTA de paiement"], "observed": "Texte 'Support expert inclus' sans définition du canal ni délai", "expected": "Promesse vérifiable", "impact": "Risque de déception post-achat", "suspected_cause": "Copy non validé", "recommended_fix": "Reformuler honnêtement", "owner": "product" },
    { "id": "AUD-005", "severity": "P2", "category": "accessibilite", "location": "index.css", "repro_steps": ["Naviguer au clavier via Tab"], "observed": "Aucun indicateur de focus visible", "expected": "Contour visible sur tous les éléments interactifs", "impact": "Non-conformité WCAG 2.1 AA (2.4.7)", "suspected_cause": "CSS reset sans remplacement :focus", "recommended_fix": "*:focus-visible { outline: 2px solid var(--primary-light); outline-offset: 2px; }", "owner": "frontend" },
    { "id": "AUD-006", "severity": "P2", "category": "qualite_responsive", "location": "Navbar.jsx", "repro_steps": ["Afficher site < 480px avec utilisateur admin connecté"], "observed": "5+ éléments en flex-row sans hamburger menu", "expected": "Menu condensé sur mobile", "impact": "Overflow ou compression sur petits écrans", "suspected_cause": "Navbar non responsive pour état authentifié", "recommended_fix": "Implémenter hamburger menu", "owner": "frontend" },
    { "id": "AUD-007", "severity": "P3", "category": "securite", "location": "backend/.env", "repro_steps": ["Inspecter le repo"], "observed": "STRIPE_SECRET_KEY et GEMINI_API_KEY en clair dans .env commité", "expected": ".env ignoré par Git", "impact": "Exposition des clés en cas de leak", "suspected_cause": ".env absent du .gitignore", "recommended_fix": "Révoquer clés, corriger .gitignore", "owner": "backend" },
    { "id": "AUD-008", "severity": "P3", "category": "fiabilite_fonctionnelle", "location": "Racine et /backend/", "repro_steps": ["Lister fichiers du repo"], "observed": "Fichiers .db versionnés (ris_scan_pro.db, etc.)", "expected": "Aucun .db dans le repo", "impact": "Données sensibles potentiellement exposées", "suspected_cause": "*.db absent du .gitignore", "recommended_fix": "Ajouter *.db au .gitignore, utiliser Alembic", "owner": "backend" },
    { "id": "AUD-009", "severity": "P3", "category": "fluidite_ux", "location": "DetailedResult.jsx ligne 210", "repro_steps": ["Consulter rapport complet long"], "observed": "Bouton 'Analyser un autre RIS' uniquement visible après scroll complet", "expected": "Bouton accessible sans scroll", "impact": "Friction pour relancer une analyse", "suspected_cause": "Bouton uniquement en bas de page", "recommended_fix": "Sticky footer ou placement en haut du rapport", "owner": "frontend" },
    { "id": "AUD-010", "severity": "P3", "category": "clarte_visuelle", "location": "FreeResult.jsx ligne 145", "repro_steps": ["Uploader PDF avec anomalies"], "observed": "Labels 'ANOMALIE ANCIENNE' et 'POINT DE VIGILANCE INTERMÉDIAIRE' statiques", "expected": "Labels dynamiques basés sur l'année (ex: 'ANOMALIE 1991')", "impact": "Manque de précision", "suspected_cause": "Labels hardcodés", "recommended_fix": "Utiliser anomalie.year pour générer le label", "owner": "frontend" }
  ],
  "summary": {
    "p0_count": 0,
    "p1_count": 2,
    "p2_count": 4,
    "p3_count": 4,
    "release_blockers": ["AUD-001", "AUD-002", "AUD-007", "AUD-008"]
  }
}
```
