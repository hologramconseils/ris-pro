# Règles de Gestion : Âge de Départ à la Retraite (Réforme 2023)

Conformément à la réforme des retraites entrée en vigueur en septembre 2023 et aux instructions officielles de l'Assurance Retraite, l'âge légal de départ et le nombre de trimestres requis varient en fonction de l'année (et parfois du mois) de naissance.

Ces règles ont été intégrées le 07 Avril 2026 au sein du fichier `backend/services/rules_engine.py` de l'application RIS Pro.

## 1. Âge légal de départ

L’âge légal de départ augmente progressivement de 62 ans à 64 ans, à raison de 3 mois par année de naissance à partir du 1er septembre 1961 :

| Année de naissance | Âge légal de départ |
| :--- | :--- |
| **1960 et avant** | 62 ans |
| **Entre le 01/01 et le 31/08/1961** | 62 ans |
| **Entre le 01/09 et le 31/12/1961** | 62 ans et 3 mois |
| **1962** | 62 ans et 6 mois |
| **1963** | 62 ans et 9 mois |
| **1964** | 63 ans |
| **1965** | 63 ans et 3 mois |
| **1966** | 63 ans et 6 mois |
| **1967** | 63 ans et 9 mois |
| **À partir de 1968** | 64 ans |

## 2. Nombre de trimestres requis (pour le taux plein)

La durée d'assurance requise pour obtenir une retraite au taux plein :

| Année de naissance | Nombre de trimestres requis |
| :--- | :--- |
| **1960** | 167 trimestres |
| **Entre le 01/01 et le 31/08/1961** | 168 trimestres |
| **Entre le 01/09 et le 31/12/1961** | 169 trimestres |
| **1962** | 169 trimestres |
| **1963** | 170 trimestres |
| **1964** | 171 trimestres |
| **À partir de 1965** | 172 trimestres |

## Implémentation technique
La granularité par mois de naissance a été ajoutée à la méthode de projection `RetirementRulesEngine.project_future_career` afin de traiter la césure spécifique de l'année 1961 (septembre). Le reste de l'implémentation exploite l'année brute. Aucun changement disruptif n'a été appliqué aux années de générations adjacentes afin de préserver la fiabilité existante du moteur de règles.
