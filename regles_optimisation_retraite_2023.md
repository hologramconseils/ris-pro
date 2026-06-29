# Règles d'Optimisation du Montant de la Retraite (2023)

Conformément à la législation en vigueur, les algorithmes de RIS Pro évaluent proactivement les dispositifs légaux d'amélioration du montant de la pension pour les suggérer aux assurés lorsque leur carrière le justifie.

## 1. Le Rachat de Trimestres (Versement pour la Retraite)
Ce dispositif permet d'acheter des trimestres manquants pour combler une carrière incomplète, réduisant ou annulant ainsi la décote (minoration). 

- **Plafond légal :** Au maximum **12 trimestres** peuvent être rachetés tout au long de la carrière.
- **Motifs d'éligibilité :** 
  - Années d'études supérieures validées par un diplôme (ou assimilées). Les diplômes français ou équivalents obtenus dans l'Espace Économique Européen, en Suisse, ou dans un pays lié à la France par une convention internationale de sécurité sociale sont acceptés. L'admission dans les grandes écoles et classes préparatoires est également assimilée à l'obtention d'un diplôme.
  - Années civiles incomplètes (au cours desquelles l'assuré n'a pas réuni ses 4 trimestres validés, souvent au début de carrière ou pendant un temps partiel).
- **Précision importante :** Les trimestres rachetés sont pris en compte uniquement pour atténuer la décote à l'âge légal et ne comptent pas dans la durée d'assurance pour le calcul de la pension, ni pour le minimum contributif majoré, ni pour la retraite anticipée carrières longues.
- **Indication Algorithmique (RIS Pro) :** Suggeré automatiquement si `trimestres_requis > trimestres_projetes`.

## 2. La Surcote (Travailler plus pour gagner plus)
La surcote est un bonus qui majore le montant de la retraite de base pour les personnes qui poursuivent leur activité alors qu'elles sont déjà éligibles à une retraite à taux plein.

- **Conditions :** 
  - Avoir atteint l'âge légal (progressif de 62 à 64 ans selon l'année de naissance).
  - Justifier du nombre requis de trimestres pour son année de naissance (ex: 171 trimestres pour la génération 1965, 172 trimestres pour la génération 1966 et suivantes).
- **Majoration accordée :** **+1,25 % par trimestre supplémentaire cotisé** (soit +5 % par an d'effort).
- **Surcote parentale (Fonction publique) :** Une surcote spécifique est accordée aux fonctionnaires nés à partir du 1er avril 1965 qui, à 63 ans, justifient d'au moins un trimestre de majoration maternité, éducation, adoption, enfant en situation de handicap ou congé parental, et qui ont validé le nombre de trimestres exigés pour une retraite à taux plein avant leur âge légal. Cette surcote augmente la retraite de 1,25% par trimestre supplémentaire cotisé après 63 ans, dans la limite de 5% (soit 4 trimestres).
- **Indication Algorithmique :** Suggeré automatiquement si l'assuré atteint le taux plein à l'âge légal mais souhaite prolonger.

## 3. Le Cumul Emploi-Retraite
Ce mécanisme autorise à cumuler ses pensions de retraite liquidées avec les revenus d'une nouvelle activité professionnelle post-liquidation.

- **Avant la réforme 2023 :** Le cumul était possible, mais ne générait aucun nouveau droit à retraite.
- **Réforme de 2023 (Nouveaux droits) :** Depuis le 1er septembre 2023, les retraités en cumul intégral se constituent de **nouveaux droits** qui viendront s'ajouter lors du second départ. Le montant de cette seconde pension est toutefois plafonné par la loi (Max 5% du plafond annuel de la Sécurité Sociale - PASS, soit 2 403 € par an en 2026 pour la retraite de base).

## 4. Les Majorations Familiales (Pour Informations)
La législation française favorise les parents.
- **Majoration Enfant :** Octroi classique de 8 trimestres par enfant (4 trimestres au titre de la maternité ou de l'adoption et 4 trimestres au titre de l'éducation, dont 2 obligatoirement à la mère et 2 pouvant être attribués à la mère, au père ou au co-parent).
- **Majoration Famille Nombreuse :** Majoration forfaitaire de **10 %** du montant de la pension pour l'assuré (homme ou femme) justifiant avoir élevé au moins **3 enfants**. Ceci s'applique en fin de calcul, sur la retraite de base comme sur les complémentaires Agirc-Arrco. La condition est d'avoir élevé les enfants pendant au moins 9 ans avant leur 16ème anniversaire.
  - **Précision Agirc-Arrco :** Pour les régimes complémentaires Agirc-Arrco, cette majoration pour enfants nés ou élevés est désormais **plafonnée à 2 367,48 € par an** à partir du 1er novembre 2024.

### Mises à jour réglementaires
*   **Loi n° 2023-270 du 14 avril 2023** de financement rectificative de la sécurité sociale pour 2023, entrée en vigueur le 1er septembre 2023.
*   **Décrets d'application de la réforme des retraites**, notamment le décret n° 2023-753 du 10 août 2023 relatif au cumul emploi-retraite et à la retraite progressive, et d'autres décrets publiés durant l'été 2023.
*   **Circulaire Agirc-Arrco 2024-12-DT du 17 octobre 2024** précisant le plafond des majorations pour enfants nés ou élevés.
*   **Circulaire CNAV 2024-25 du 1er août 2024** et **Circulaire CNAV 2024-26 du 2 août 2024** sur l'âge légal et la durée d'assurance requise depuis le 1er septembre 2023.
*   **Circulaire Cnav n° 2026-01 du 05/01/2026** fixant les valeurs du Plafond de la Sécurité Sociale et ses incidences.
*   **Plafond annuel de la Sécurité Sociale (PASS)** : 2 355 € bruts en 2025, 2 403 € par an en 2026.

**Date de mise à jour :** 29 juin 2026.