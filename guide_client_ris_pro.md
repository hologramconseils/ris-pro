# 📄 LIVRET D'EXPLICATION & GUIDE CLIENT — RIS PRO
### Le Hub Stratégique & Décisionnel d'Audit de Carrière et d'Optimisation Retraite
**Plateforme Officielle :** [https://ris.hologramconseils.com](https://ris.hologramconseils.com)

---

## SECTION 1 : Qu'est-ce que RIS Pro & À Quels Besoins Répond-il ?

### 1.1 Définition & Raison d'Être
**RIS Pro** (disponible sur [https://ris.hologramconseils.com](https://ris.hologramconseils.com)) est la plateforme décisionnelle d'audit et d'optimisation de retraite conçue par **Hologram Conseils**. Elle transforme la complexité réglementaire française en un plan d'action clair, automatisé et visuellement percutant. 

Plutôt que de laisser les épargnants et dirigeants face à des documents opaques de plusieurs dizaines de pages (Relevé de Situation Individuelle - RIS, Entretien d'Information Retraite - EIG), RIS Pro croise instantanément l'historique réel de carrière avec l'ensemble des textes légaux majeurs (Lois Retraite 2023, règles Agirc-Arrco, dispositifs Carrières Longues, majorations enfants, etc.).

---

### 1.2 Les Problématiques Majeures Résolues

| Problématique Client | Solution Apportée par RIS Pro |
|---|---|
| **Opacité & Complexité Législative** | Élimination de la friction de décryptage des réformes. Les règles complexes (Carrières Longues, régimes alignés, points Agirc-Arrco) sont interprétées automatiquement. |
| **Erreurs & Trimestres Manquants** | Détection automatisée des trous de carrière, des anomalies de salaires et des trimestres non validés qui coûtent des milliers d'euros de pension finale. |
| **Incertitude sur la Date & le Montant** | Modélisation prédictive instantanée permettant de comparer l'âge légal, l'âge à taux plein automatisé et l'impact financier de chaque année de prolongation. |
| **Absence de Vision Stratégique** | Restitution d'un bilan clair avec plan d'action priorisé et démarches auprès des caisses de retraite (CNAV, Agirc-Arrco, etc.). |

---

## SECTION 2 : Fonctionnement & Modèle Prédictif

### 2.1 L'Interface Décisionnelle
L'architecture de RIS Pro repose sur un tableau de bord à double vue, conçu pour offrir une clarté d'analyse sans équivalent :

- **Vue de Configuration (Entrées) :** Permet au conseiller ou au client d'ajuster dynamiquement les paramètres clés (*Objectif de pension cible*, *Revenus futurs projetés*, *Date d'arrêt souhaitée*).
- **Vue Analytique (Résultats) :** Maintient une synchronisation en temps réel avec la vue de configuration. Chaque modification ajuste immédiatement la trajectoire financière, le taux de remplacement et la stratégie d'optimisation proposée.

```
+------------------------------------+------------------------------------+
|  Ajustement des Paramètres         |  Restitution Visuelle              |
|  - Objectif de pension             |  - Âge du Taux Plein automatique   |
|  - Revenus futurs                  |  - Graphique de surcote / décote   |
|  - Rachat de trimestres            |  - Liste priorisée des anomalies   |
+------------------------------------+------------------------------------+
```

---

### 2.2 Rigueur Actuarielle & IA Réglementaire

RIS Pro combine deux moteurs de traitement complémentaires pour garantir une précision absolue sans approximation mathématique :

1. **Le Moteur d'IA Réglementaire (Google Gemini) :**
   - Analyse et numérise la structure exacte des relevés PDF uploadés.
   - Identifie les périodes d'activité, les régimes concernés et les anomalies de cotisations.
   - Veille juridique continue pour intégrer les dernières évolutions législatives.

2. **Le Moteur d'Analyse Actuarielle & Prédictive (`statsmodels`) :**
   - Calcule avec une précision exacte les montants de pension de base et complémentaire.
   - Détermine le taux de remplacement brut/net.
   - Simule le rendement financier exact des stratégies d'optimisation (ex. : rachat de trimestres Madelin/Fillon vs. versement PER).

---

## SECTION 3 : Sécurité, Confidentialité & RGPD (Le Bouclier de Confiance)

Pour des données aussi personnelles et financières qu'un relevé de carrière, RIS Pro applique les standards de sécurité les plus stricts du secteur bancaire et assurantiel.

```
     [ Chiffrement SSL/TLS ] 
               │
               ▼
   [ Isolation des Données (Données salées) ]
               │
               ▼
 [ Hébergement Souverain Européen (Vercel / Supabase) ]
               │
               ▼
   [ Conformité Totale RGPD & Stripe SEC-006 ]
```

---

### 3.3 Matrice FAQ Sécurité & Confidentialité

#### ❓ 1. Où mes données personnelles sont-elles stockées ?
> **Réponse :** Toutes les données applicatives et les fichiers de relevés sont hébergés exclusivement sur des infrastructures sécurisées situées en Europe (Data Centers certifiés ISO 27001 et SOC 2). Aucune donnée ne quitte le territoire européen.

#### ❓ 2. RIS Pro est-il conforme au RGPD ?
> **Réponse :** Oui, à 100 %. RIS Pro respecte scrupuleusement le Règlement Général sur la Protection des Données (RGPD). Le principe de **minimisation des données** est appliqué : vos données de carrière sont utilisées uniquement pour exécuter l'audit et établir votre bilan. Vous disposez d'un droit d'accès, de rectification et de suppression totale sur simple demande.

#### ❓ 3. Qui a accès à mon historique de carrière ?
> **Réponse :** Vous et votre conseiller agréé êtes les seuls habilités à consulter votre dossier. Vos données font l'objet d'un chiffrement renforcé en transit (HTTPS / TLS 1.3) et au repos (AES-256). **Aucune donnée personnelle n'est revendue ni transmise à des tiers.** Le Numéro d'Inscription au Répertoire (NIR / Sécurité Sociale) est systématiquement pseudonymisé à l'aide d'un algorithme de hachage salé (`NIR_SALT`).

#### ❓ 4. Comment les paiements sont-ils sécurisés ?
> **Réponse :** Les transactions bancaires sur [https://ris.hologramconseils.com](https://ris.hologramconseils.com) sont intégralement gérées par **Stripe**, le leader mondial du paiement en ligne sécurisé (certifié PCI-DSS Niveau 1). Vos coordonnées bancaires ne touchent jamais et ne sont jamais conservées sur les serveurs de RIS Pro.

---

### 📌 Récapitulatif des Engagements Qualité RIS Pro

- ✅ **Transparence Totale :** Calculs certifiés conformes à la réglementation en vigueur.
- ✅ **Sécurité Maximale :** Protocole de chiffrement bancaire et conformité RGPD stricte.
- ✅ **Zéro Risque Commercial :** Transaction Stripe 100 % sécurisée avec accès immédiat au rapport sur [https://ris.hologramconseils.com](https://ris.hologramconseils.com).
