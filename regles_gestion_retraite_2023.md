# Règles de Gestion : Âge de Départ à la Retraite (Réforme 2023 et LFSS 2026)

Conformément à la réforme des retraites entrée en vigueur en septembre 2023 et à la Loi de financement de la sécurité sociale pour 2026 (LFSS 2026) (n° 2025-1403 du 30 décembre 2025) qui a modifié le calendrier de certaines dispositions en instaurant une suspension partielle du relèvement de l'âge légal et de la durée de cotisation pour certaines générations, l'âge légal de départ et le nombre de trimestres requis varient en fonction de l'année (et parfois du mois) de naissance. Ces nouvelles règles s'appliquent pour les pensions prenant effet à compter du 1er septembre 2026.

**À noter : Les règles ci-dessous prennent en compte les ajustements apportés par la Loi de financement de la Sécurité sociale pour 2026 (LFSS 2026) et les circulaires CNAV/Agirc-Arrco publiées ultérieurement, qui modifient la trajectoire de la réforme de 2023 pour les pensions prenant effet à compter du 1er septembre 2026.**

Ces règles ont été intégrées le 07 Avril 2026 au sein du fichier `backend/services/rules_engine.py` de l'application RIS Pro.

## 1. Âge légal de départ

L’âge légal de départ augmente progressivement de 62 ans à 64 ans, avec des ajustements spécifiques pour les générations nées à partir du 1er septembre 1961, pour les retraites prenant effet à partir du 1er septembre 2026. Le relèvement de l'âge légal est ralenti pour les générations nées entre 1964 et 1970, atteignant 64 ans pour celles nées à partir de 1971.

| Année de naissance | Âge légal de départ (pour les pensions prenant effet à partir du 01/09/2026) |
| :--- | :--- |
| **1960 et avant** | 62 ans |
| **Entre le 01/01 et le 31/08/1961** | 62 ans |
| **Entre le 01/09 et le 31/12/1961** | 62 ans et 3 mois |
| **1962** | 62 ans et 6 mois |
| **1963** | 62 ans et 9 mois |
| **1964** | 62 ans et 9 mois |
| **Entre le 01/01 et le 30/09/1965** | 62 ans et 3 mois |
| **Entre le 01/10 et le 31/12/1965** | 62 ans et 6 mois |
| **1966** | 62 ans et 9 mois |
| **1967** | 63 ans |
| **1968** | 63 ans et 3 mois |
| **1969** | 63 ans et 6 mois |
| **1970** | 63 ans et 9 mois |
| **À partir de 1971** | 64 ans |

## 2. Nombre de trimestres requis (pour le taux plein)

La durée d'assurance requise pour obtenir une retraite au taux plein a également été ajustée pour les pensions prenant effet à compter du 1er septembre 2026, avec des modifications spécifiques pour les générations nées à partir de 1964.

| Année de naissance | Nombre de trimestres requis (pour les pensions prenant effet à partir du 01/09/2026) |
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
La granularité par mois de naissance a été ajoutée à la méthode de projection `RetirementRulesEngine.project_future_career` afin de traiter la césure spécifique de l'année 1961 (septembre) et, désormais, la granularité par trimestre de naissance pour l'année 1965. Le reste de l'implémentation exploite l'année brute. Aucun changement disruptif n'a été appliqué aux années de générations adjacentes afin de préserver la fiabilité existante du moteur de règles.

### Mises à jour réglementaires

Les informations de ce document ont été mises à jour le 19 juillet 2026 pour refléter les modifications apportées par la Loi de financement de la Sécurité sociale pour 2026 (LFSS 2026) et ses décrets et circulaires d'application, notamment :

*   **Loi de financement de la sécurité sociale pour 2026 (LFSS 2026)** : Cette loi (n° 2025-1403 du 30 décembre 2025) a introduit une "suspension" partielle de la trajectoire d'allongement de la durée de cotisation et a ralenti le relèvement de l'âge légal pour certaines générations (notamment 1964 à 1970), applicable aux pensions prenant effet à compter du 1er septembre 2026.
*   **Circulaire Cnav 2026-07 du 5 mars 2026** : Précise les nouvelles dispositions concernant l'âge légal et la durée d'assurance requise pour les retraites prenant effet à compter du 1er septembre 2026, annulant et remplaçant les circulaires précédentes pour cette période. Ce document a été révisé pour intégrer précisément les données de cette circulaire pour l'âge légal et le nombre de trimestres requis (notamment pour la génération 1964).
*   **Décret n° 2026-344 du 7 mai 2026 et Décret n° 2026-345 du 7 mai 2026** : Ces décrets portent application de l'article 105 de la LFSS 2026 et précisent les conséquences de la suspension de la réforme des retraites pour les conditions de départ anticipé (carrières longues, assurés handicapés) et l'âge légal à Mayotte, applicables aux pensions prenant effet à compter du 1er septembre 2026.
*   **Circulaire CNAV publiée le 6 mars 2026** : Clarifie l'application concrète de la suspension de la réforme des retraites de 2023, notamment pour l'âge légal et la durée d'assurance requise pour les assurés nés en 1964 et 1965.
*   **Circulaire Cnav 2026/17 du 12 juin 2026** : Précise les modalités d'ouverture du droit à la retraite anticipée pour carrière longue, applicables au 1er septembre 2026.
*   **Circulaire Cnav 2026/18 du 15 juin 2026** : Détailler les règles concernant la retraite anticipée au profit des assurés handicapés (RAAH) à compter du 1er septembre 2026.
*   **Décret n° 2023-436 du 3 juin 2023** : Porte application des articles 10 et 11 de la loi n° 2023-270 du 14 avril 2023 de financement rectificative de la sécurité sociale pour 2023, relatif au relèvement de l'âge d'ouverture des droits à la retraite et aux dispositifs de retraite anticipée.
*   **Décrets n° 2023-690, n° 2023-692, n° 2023-689 et n° 2023-693 parus au Journal officiel le 30 juillet 2023** : Concrétisent la fermeture au 1er septembre 2023 des principaux régimes spéciaux de retraite, et transposent les évolutions paramétriques de la réforme des retraites à ces régimes.