# Règles d'Optimisation du Montant de la Retraite (2023)

Conformément à la législation en vigueur, les algorithmes de RIS Pro évaluent proactivement les dispositifs légaux d'amélioration du montant de la pension pour les suggérer aux assurés lorsque leur carrière le justifie.

## 1. Le Rachat de Trimestres (Versement pour la Retraite)
Ce dispositif permet d'acheter des semestres manquants pour combler une carrière incomplète, réduisant ou annulant ainsi la décote (minoration). 

- **Plafond légal :** Au maximum **12 trimestres** peuvent être rachetés tout au long de la carrière.
- **Motifs d'éligibilité :** 
  - Années d'études supérieures validées par un diplôme (ou assimilées).
  - Années civiles incomplètes (au cours desquelles l'assuré n'a pas réuni ses 4 trimestres validés, souvent au début de carrière ou pendant un temps partiel).
- **Indication Algorithmique (RIS Pro) :** Suggeré automatiquement si `trimestres_requis > trimestres_projetes`.

## 2. La Surcote (Travailler plus pour gagner plus)
La surcote est un bonus qui majore le montant de la retraite de base pour les personnes qui poursuivent leur activité alors qu'elles sont déjà éligibles à une retraite à taux plein.

- **Conditions :** 
  - Avoir atteint l'âge légal (progressif de 62 à 64 ans).
  - Justifier du nombre requis de trimestres pour son année de naissance (ex: 172 trimestres pour la génération 1965+).
- **Majoration accordée :** **+1,25 % par trimestre supplémentaire cotisé** (soit +5 % par an d'effort).
- **Indication Algorithmique :** Suggeré automatiquement si l'assuré atteint le taux plein à l'âge légal mais souhaite prolonger.

## 3. Le Cumul Emploi-Retraite
Ce mécanisme autorise à cumuler ses pensions de retraite liquidées avec les revenus d'une nouvelle activité professionnelle post-liquidation.

- **Avant la réforme 2023 :** Le cumul était possible, mais ne générait aucun nouveau droit à retraite.
- **Réforme de 2023 (Nouveaux droits) :** Les retraités en cumul intégral se constituent de **nouveaux droits** qui viendront s'ajouter lors du second départ. Le montant de cette seconde pension est toutefois plafonné par la loi (Max 5% du plafond annuel de la SS).

## 4. Les Majorations Familiales (Pour Informations)
La législation française favorise les parents.
- **Majoration Enfant :** Octroi classique de 8 trimestres par enfant (maternité/éducation partagée).
- **Majoration Famille Nombreuse :** Majoration forfaitaire de **10 %** du montant de la pension pour l'assuré (homme ou femme) justifiant avoir élevé au moins **3 enfants**. Ceci s'applique en fin de calcul, sur la retraite de base comme sur les complémentaires Agirc-Arrco.
