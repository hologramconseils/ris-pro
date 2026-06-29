# Règles de Gestion : Âge de Départ à la Retraite (Réforme 2023 et LFSS 2026)

Conformément à la réforme des retraites entrée en vigueur en septembre 2023 et à la Loi de financement de la sécurité sociale pour 2026 (LFSS 2026) qui a modifié le calendrier de certaines dispositions, l'âge légal de départ et le nombre de trimestres requis varient en fonction de l'année (et parfois du mois) de naissance. Ces nouvelles règles s'appliquent pour les pensions prenant effet à compter du 1er septembre 2026.

Ces règles ont été intégrées le 07 Avril 2026 au sein du fichier `backend/services/rules_engine.py` de l'application RIS Pro.

## 1. Âge légal de départ

L’âge légal de départ augmente progressivement de 62 ans à 64 ans. La LFSS 2026 a introduit un décalage de ce relèvement pour certaines générations pour les pensions prenant effet à compter du 1er septembre 2026.

| Année de naissance | Âge légal de départ |
| :--- | :--- |
| **1960 et avant** | 62 ans |
| **Entre le 01/01 et le 31/08/1961** | 62 ans |
| **Entre le 01/09 et le 31/12/1961** | 62 ans et 3 mois |
| **1962** | 62 ans et 6 mois |
| **1963** | 62 ans et 9 mois |
| **1964** | 62 ans et 9 mois |
| **Entre le 01/01 et le 31/03/1965** | 62 ans et 9 mois |
| **Entre le 01/04 et le 31/12/1965** | 63 ans |
| **1966** | 63 ans et 3 mois |
| **1967** | 63 ans et 6 mois |
| **1968** | 63 ans et 9 mois |
| **À partir de 1969** | 64 ans |

## 2. Nombre de trimestres requis (pour le taux plein)

La durée d'assurance requise pour obtenir une retraite au taux plein a également été ajustée par la LFSS 2026 pour les pensions prenant effet à compter du 1er septembre 2026.

| Année de naissance | Nombre de trimestres requis |
| :--- | :--- |
| **1960** | 167 trimestres |
| **Entre le 01/01 et le 31/08/1961** | 168 trimestres |
| **Entre le 01/09 et le 31/12/1961** | 169 trimestres |
| **1962** | 169 trimestres |
| **1963** | 170 trimestres |
| **1964** | 166 trimestres |
| **Entre le 01/01 et le 30/09/1965** | 166 trimestres |
| **Entre le 01/10 et le 31/12/1965** | 167 trimestres |
| **1966** | 168 trimestres |
| **1967** | 169 trimestres |
| **1968** | 170 trimestres |
| **1969** | 170 trimestres |
| **1970** | 170 trimestres |
| **1971** | 171 trimestres |
| **1972** | 171 trimestres |
| **1973** | 171 trimestres |
| **À partir de 1974** | 172 trimestres |

## Implémentation technique
La granularité par mois de naissance a été ajoutée à la méthode de projection `RetirementRulesEngine.project_future_career` afin de traiter la césure spécifique de l'année 1961 (septembre). Le reste de l'implémentation exploite l'année brute. Aucun changement disruptif n'a été appliqué aux années de générations adjacentes afin de préserver la fiabilité existante du moteur de règles.

### Mises à jour réglementaires
*   **Loi n° 2025-1403 du 30 décembre 2025 de financement de la sécurité sociale pour 2026 (LFSS 2026)** : Cette loi, adoptée fin 2025, a suspendu une partie de la trajectoire d'allongement de l'âge légal de départ et de la durée de cotisation initialement prévue par la réforme de 2023. Ces dispositions s'appliquent aux pensions prenant effet à compter du 1er septembre 2026.
*   **Circulaire Cnav 2026-07 du 5 mars 2026** : Cette circulaire de la Caisse nationale de l'Assurance retraite tire les conséquences réglementaires de la LFSS 2026, détaillant les nouvelles dispositions concernant l'âge légal de départ à la retraite et la durée d'assurance requise pour le taux plein. Elle remplace la Circulaire Cnav 2024-25 du 1er août 2024 pour les retraites prenant effet à compter du 1er septembre 2026.