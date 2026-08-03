# Règles d'Optimisation du Montant de la Retraite (2023, mis à jour en 2026)

Conformément à la législation en vigueur, les algorithmes de RIS Pro évaluent proactivement les dispositifs légaux d'amélioration du montant de la pension pour les suggérer aux assurés lorsque leur carrière le justifie.

## 1. Le Rachat de Trimestres (Versement pour la Retraite)
Ce dispositif permet d'acheter des trimestres manquants pour combler une carrière incomplète, réduisant ou annulant ainsi la décote (minoration).

- **Plafond légal :** Au maximum **12 trimestres** peuvent être rachetés tout au long de la carrière.
- **Motifs d'éligibilité :**
  - Années d'études supérieures validées par un diplôme (ou assimilées).
  - Années civiles incomplètes (au cours desquelles l'assuré n'a pas réuni ses 4 trimestres validés, souvent au début de carrière ou pendant un temps partiel).
- **Conditions spécifiques post-réforme 2023 :**
  - Il est possible d'effectuer un rachat de trimestres pour études supérieures à coût réduit jusqu'au 31 décembre de l'année des 40 ans de l'assuré.
  - La demande de versement de cotisations au titre d'un stage en entreprise peut être déposée jusqu'au 31 décembre de l'année des 30 ans de l'assuré. Le coût est de 481 € par trimestre en 2026, dans la limite de 2 trimestres rachetables.
- **Coût du rachat :** Le barème du rachat de trimestres est revalorisé annuellement et son coût augmente avec l'âge et les revenus de l'assuré. Les seuils de revenus des tranches sont actualisés en fonction du PASS.
- **Indication Algorithmique (RIS Pro) :** Suggéré automatiquement si `trimestres_requis > trimestres_projetes`.

## 2. La Surcote (Travailler plus pour gagner plus)
La surcote est un bonus qui majore le montant de la retraite de base pour les personnes qui poursuivent leur activité alors qu'elles sont déjà éligibles à une retraite à taux plein.

- **Conditions :**
  - Avoir atteint l'âge légal de départ à la retraite. La Loi de financement de la Sécurité sociale pour 2026 (LFSS 2026) et ses décrets d'application ont modifié le calendrier de relèvement de l'âge légal pour les pensions prenant effet à compter du 1er septembre 2026.
    - Pour les assurés nés du 1er janvier 1963 au 31 mars 1965, l'âge légal est fixé à 62 ans et 9 mois.
    - Pour les assurés nés entre le 1er avril 1965 et le 31 décembre 1968, l'âge légal est abaissé d'un trimestre par rapport au calendrier initial de la réforme de 2023.
    - Le relèvement progressif de l'âge légal à 64 ans reste l'objectif pour les générations nées en 1971 et après, mais le calendrier intermédiaire est ajusté ou suspendu pour les générations 1964 à 1968 jusqu'en janvier 2028.
  - Justifier du nombre requis de trimestres pour son année de naissance afin d'obtenir une retraite à taux plein. Suite à la LFSS 2026, ce nombre a été ajusté pour certaines générations prenant leur retraite à partir du 1er septembre 2026 :
    - 166 trimestres pour la génération 1964.
    - 166 trimestres pour les générations nées du 1er janvier au 31 mars 1965.
    - 171 trimestres pour les générations nées du 1er avril au 31 décembre 1965.
    - 168 trimestres pour la génération 1966.
    - 169 trimestres pour la génération 1967.
    - 170 trimestres pour la génération 1968.
    - 172 trimestres pour les générations nées en 1974 et après.
  - Continuer à travailler au-delà de ces deux seuils.
- **Majoration accordée :** **+1,25 % par trimestre supplémentaire cotisé** (soit +5 % par an d'effort) après avoir atteint l'âge légal et la durée d'assurance requise pour le taux plein.
- **Surcote parentale (post-réforme 2023) :** Une surcote spécifique a été mise en place pour les parents. Ce dispositif s'applique lorsque la durée d'assurance dépasse le nombre de trimestres nécessaires pour le taux plein et sous réserve d'avoir acquis au moins un trimestre de majoration au titre de la maternité, de l'éducation, de l'adoption, d'un enfant handicapé ou d'un congé parental. Pour les pensions prenant effet à compter du 1er septembre 2026, la surcote parentale est réservée aux personnes nées à partir du 1er avril 1965.
- **Indication Algorithmique :** Suggéré automatiquement si l'assuré atteint le taux plein à l'âge légal mais souhaite prolonger.

## 3. Le Cumul Emploi-Retraite
Ce mécanisme autorise à cumuler ses pensions de retraite liquidées avec les revenus d'une nouvelle activité professionnelle post-liquidation.

- **Avant la réforme 2023 :** Le cumul était possible, mais ne générait aucun nouveau droit à retraite.
- **Règles actuelles (jusqu'au 31 décembre 2026) :**
  - **Nouveaux droits (Réforme de 2023) :** Les retraités en cumul emploi-retraite intégral se constituent de **nouveaux droits** qui viendront s'ajouter lors du second départ. Ces nouveaux droits concernent les activités exercées depuis le 1er janvier 2023. Le montant de cette seconde pension est plafonné à 5% du plafond annuel de la Sécurité sociale (PASS), soit 2 403 € bruts par an pour 2026.
  - **Conditions du cumul intégral :** L'assuré doit avoir liquidé toutes ses pensions de retraite (de base et complémentaires, françaises et étrangères) et remplir les conditions pour une retraite à taux plein (soit en ayant l'âge du taux plein automatique à 67 ans pour les générations nées en 1955 ou après, soit en ayant à la fois l'âge légal et la durée d'assurance requise).
  - **Délai de carence :** Si la première retraite prend effet à partir du 1er novembre 2023 et que l'activité salariée est reprise chez le *dernier employeur*, un délai de 6 mois est requis pour acquérir de nouveaux droits. Ce délai ne s'applique pas si l'activité est reprise chez un *nouvel employeur*.
  - **Cumul plafonné :** Si les conditions du cumul intégral ne sont pas remplies (par exemple, retraite avec décote), le cumul est plafonné. Le total des pensions de retraite et des revenus d'activité ne doit pas dépasser le montant le plus élevé entre 160 % du SMIC (soit **2 987,23 € bruts mensuels** à partir du 1er juin 2026) ou la moyenne mensuelle des trois derniers salaires bruts perçus avant la liquidation de la retraite. En cas de dépassement, la pension est réduite.
- **Nouvelles règles à compter du 1er janvier 2027 (Loi de financement de la Sécurité sociale pour 2026) :**
  - La distinction entre cumul intégral et plafonné sera supprimée et les règles dépendront de l'âge de l'assuré.
  - **Avant l'âge minimum légal de départ à la retraite :** Les montants du revenu d'activité professionnelle seront déduits en totalité de la pension de retraite.
  - **Entre l'âge minimum légal et l'âge du taux plein automatique (67 ans) :** Le cumul des pensions de retraite et des revenus d'activité sera autorisé dans la limite de 7 000 euros par an.
  - **À partir de l'âge du taux plein automatique (67 ans) :** Le cumul sera intégral sans plafond et permettra d'acquérir de nouveaux droits à une seconde pension.
  - Le délai de carence chez le dernier employeur sera supprimé.

## 4. Les Majorations Familiales (Pour Informations)
La législation française favorise les parents.

- **Majoration Enfant :** Octroi classique de 8 trimestres par enfant (4 trimestres au titre de la maternité ou de l'adoption, et 4 trimestres au titre de l'éducation).
  - **Attribution des trimestres d'éducation (post-réforme 2023) :** Désormais, 2 des 4 trimestres "éducation" acquis pour chaque enfant sont automatiquement attribués à la mère. Les 2 autres peuvent être attribués à la mère ou au père.
- **Majoration Famille Nombreuse :** Majoration forfaitaire de **10 %** du montant de la pension pour l'assuré (homme ou femme) justifiant avoir élevé au moins **3 enfants**. Ceci s'applique en fin de calcul, sur la retraite de base comme sur les complémentaires Agirc-Arrco.
  - **Conditions d'éducation :** Les enfants doivent avoir été élevés pendant au moins neuf ans avant leur 16e anniversaire, ou avant l'âge auquel ils ont cessé de donner droit aux prestations familiales.

### Mises à jour réglementaires
- **Loi n° 2023-270 du 14 avril 2023** de financement rectificative de la sécurité sociale pour 2023 (Réforme des retraites).
- **Décret n° 2023-436 du 3 juin 2023** portant application des articles 10 et 11 de la loi n° 2023-270 du 14 avril 2023, notamment concernant l'âge légal et la durée d'assurance.
- **Décret n° 2023-751 et n° 2023-753 du 10 août 2023** relatifs au cumul emploi retraite et à la retraite progressive, portant application de l'article 26 de la loi n° 2023-270.
- **Circulaire Agirc-Arrco 2023-8-DRJ du 15 septembre 2023** concernant les coefficients applicables à la retraite progressive suite à la réforme.
- **Loi de financement de la Sécurité sociale pour 2026 (L. n° 2025-1719 du 30 décembre 2025).** Cette loi, promulguée le 30 décembre 2025 et publiée au Journal officiel le 31 décembre 2025, suspend le calendrier d'augmentation de l'âge légal de départ à la retraite pour certaines générations jusqu'à janvier 2028 et réforme les règles du cumul emploi-retraite à compter du 1er janvier 2027.
- **Arrêté du 22 décembre 2025** portant fixation du plafond de la Sécurité sociale pour 2026 (PASS à 48 060 €).
- **Décret n° 2026-344 du 7 mai 2026** portant application de l'article 105 de la loi n° 2025-1403 du 30 décembre 2025 de financement de la sécurité sociale pour 2026, concernant les assurés relevant de la CNRACL.
- **Décret n° 2026-345 du 7 mai 2026** portant application de l'article 105 de la loi n° 2025-1403 du 30 décembre 2025 de financement de la sécurité sociale pour 2026, visant à adapter l'âge de départ à la retraite anticipée pour carrière longue et la durée d'assurance cotisée pour tenir compte de la suspension de la réforme des retraites de 2023.
- **Arrêté du 22 mai 2026** relatif au relèvement du salaire minimum de croissance (SMIC), portant le SMIC horaire brut à 12,31 euros et le SMIC mensuel brut (35 heures) à 1 867,02 euros à compter du 1er juin 2026.
- **Circulaire CNAV 2026-07 du 1er juillet 2026** apportant des modifications concernant l'âge légal de départ à la retraite en métropole, la durée d'assurance pour le taux plein et l'âge du taux plein, suite à la LFSS 2026.

Date de mise à jour : 3 août 2026.