# Règles d'Optimisation du Montant de la Retraite (2023, mis à jour en 2026)

Conformément à la législation en vigueur, les algorithmes de RIS Pro évaluent proactivement les dispositifs légaux d'amélioration du montant de la pension pour les suggérer aux assurés lorsque leur carrière le justifie.

## 1. Le Rachat de Trimestres (Versement pour la Retraite)
Ce dispositif permet d'acheter des trimestres manquants pour combler une carrière incomplète, réduisant ou annulant ainsi la décote (minoration).

- **Plafond légal :** Au maximum **12 trimestres** peuvent être rachetés tout au long de la carrière.
- **Motifs d'éligibilité :**
  - Années d'études supérieures validées par un diplôme (ou assimilées).
  - Années civiles incomplètes (au cours desquelles l'assuré n'a pas réuni ses 4 trimestres validés, souvent au début de carrière ou pendant un temps partiel).
- **Conditions spécifiques post-réforme 2023 :**
  - Il est possible d'effectuer un rachat de trimestres pour études supérieures à coût réduit jusqu'au 31 décembre de l'année des 40 ans de l'assuré (au lieu du 31 décembre de la 10e année suivant la fin des études).
  - La demande de versement de cotisations au titre d'un stage en entreprise peut être déposée jusqu'au 31 décembre de l'année des 30 ans de l'assuré (au lieu de la 2e année suivant la fin du stage).
- **Coût du rachat :** Le barème du rachat de trimestres est revalorisé annuellement et son coût augmente avec l'âge et les revenus de l'assuré. Il est à noter que les seuils de revenus des tranches sont actualisés en fonction du PASS (Plafond Annuel de la Sécurité Sociale fixé à 48 060 € pour 2026).
- **Indication Algorithmique (RIS Pro) :** Suggéré automatiquement si `trimestres_requis > trimestres_projetes`.

## 2. La Surcote (Travailler plus pour gagner plus)
La surcote est un bonus qui majore le montant de la retraite de base pour les personnes qui poursuivent leur activité alors qu'elles sont déjà éligibles à une retraite à taux plein.

- **Conditions :**
  - Avoir atteint l'âge légal de départ à la retraite. L'âge légal, qui devait passer progressivement de 62 à 64 ans, est temporairement suspendu pour les pensions prenant effet à compter du 1er septembre 2026, suite à la Loi de financement de la Sécurité sociale pour 2026. L'âge légal est ainsi figé à 62 ans et 9 mois jusqu'en janvier 2028. Pour les générations nées entre 1964 et 1968, des ajustements spécifiques s'appliquent. Par exemple, pour une personne née en 1964, l'âge légal est de 62 ans et 9 mois (au lieu de 63 ans) et la durée d'assurance requise est de 170 trimestres (au lieu de 171) pour une retraite à taux plein.
  - Justifier du nombre requis de trimestres pour son année de naissance afin d'obtenir une retraite à taux plein (par exemple : 172 trimestres pour les générations nées en 1966 et après).
  - Continuer à travailler au-delà de ces deux seuils.
- **Majoration accordée :** **+1,25 % par trimestre supplémentaire cotisé** (soit +5 % par an d'effort) après avoir atteint l'âge légal et la durée d'assurance requise pour le taux plein.
- **Surcote parentale (post-réforme 2023 et LFSS 2026) :** Une surcote spécifique a été mise en place pour les parents nés à partir du 1er avril 1965, sous réserve d'avoir acquis au moins un trimestre de majoration au titre de la maternité, de l'éducation, de l'adoption, d'un enfant handicapé ou d'un congé parental. Ce dispositif s'applique lorsque la durée d'assurance dépasse le nombre de trimestres nécessaires pour le taux plein. Toutefois, en raison de la suspension de l'augmentation de l'âge légal de départ à la retraite par la LFSS 2026, certaines générations (comme celles nées en 1964 et début 1965) dont l'âge légal sera inférieur à 63 ans à compter du 1er septembre 2026, pourraient ne plus remplir la condition d'âge légal supérieur ou égal à 63 ans et ne pourront pas bénéficier de la surcote parentale.
  La LFSS 2026 a également introduit un nouveau "congé de naissance" qui sera pris en compte pour le calcul de la retraite pour les enfants nés ou adoptés à partir du 1er janvier 2026. Pour les femmes fonctionnaires ou militaires ayant accouché après leur recrutement et après le 1er janvier 2004, la loi prévoit 1 trimestre de bonification par enfant et 2 trimestres de majoration de durée d'assurance. Un calcul amélioré des pensions pour les mères est aussi prévu, avec une possible réduction du nombre d'années retenues pour le revenu annuel moyen.
  Cependant, deux décrets importants détaillant ces mesures pour les mères, notamment l'intégration de deux trimestres liés aux enfants dans la durée cotisée des carrières longues et le recalcul de la pension sur 23 ou 24 meilleures années, sont toujours attendus au Journal Officiel en date du 8 juillet 2026, entraînant des blocages pour des milliers de futures retraitées.
- **Indication Algorithmique :** Suggéré automatiquement si l'assuré atteint le taux plein à l'âge légal mais souhaite prolonger.

## 3. Le Cumul Emploi-Retraite
Ce mécanisme autorise à cumuler ses pensions de retraite liquidées avec les revenus d'une nouvelle activité professionnelle post-liquidation.

- **Avant la réforme 2023 :** Le cumul était possible, mais ne générait aucun nouveau droit à retraite.
- **Réforme de 2023 (Nouveaux droits) :** Les retraités en cumul emploi-retraite intégral se constituent de **nouveaux droits** qui viendront s'ajouter lors du second départ. Ces nouveaux droits concernent les activités exercées depuis le 1er janvier 2023.
  - La Loi de financement de la Sécurité sociale pour 2026 prévoit une refonte des règles du cumul emploi-retraite à compter du 1er janvier 2027. À partir de cette date, la distinction entre cumul intégral et plafonné prendra fin, et les conditions dépendront uniquement de l'âge de l'assuré.
  - Pour les pensions liquidées à partir du 1er janvier 2027, l'acquisition de nouveaux droits à la retraite sera supprimée.
  - **Nouvelles règles à compter du 1er janvier 2027 :**
    - **Avant l'âge légal de départ :** Les revenus d'activité professionnelle seront déduits en totalité de la pension de retraite.
    - **Entre l'âge légal et l'âge du taux plein automatique (67 ans) :** Le cumul sera partiel, avec un abattement de 50 % au-delà de 7 000 euros de revenus annuels.
    - **À partir de l'âge du taux plein automatique (67 ans) :** Le cumul des pensions de retraite et des revenus d'activité sera intégral et sans plafond, avec la possibilité de constituer une seconde pension.
  - **Conditions du cumul intégral (jusqu'au 31 décembre 2026) :** L'assuré doit avoir liquidé toutes ses pensions de retraite (de base et complémentaires, françaises et étrangères) et remplir les conditions pour une retraite à taux plein (soit en ayant l'âge du taux plein automatique à 67 ans pour les générations nées en 1955 ou après, soit en ayant à la fois l'âge légal et la durée d'assurance requise).
  - **Délai de carence :** Si la première retraite prend effet à partir du 1er novembre 2023 et que l'activité salariée est reprise chez le *dernier employeur*, un délai de 6 mois est requis pour acquérir de nouveaux droits. Ce délai ne s'applique pas si l'activité est reprise chez un *nouvel employeur*. Ce délai de carence sera de facto supprimé au 1er janvier 2027 en raison de la nouvelle réforme globale du cumul emploi-retraite introduite par la LFSS 2026.
- **Cumul plafonné (jusqu'au 31 décembre 2026) :** Si les conditions du cumul intégral ne sont pas remplies (par exemple, retraite avec décote), le cumul est plafonné. Le total des pensions de retraite et des revenus d'activité ne doit pas dépasser le montant le plus élevé entre 160 % du SMIC (soit **2 987,23 € bruts mensuels**, 160% de 1 867,02 € bruts mensuels, à partir du 1er juin 2026) ou la moyenne mensuelle des trois derniers salaires bruts perçus avant la liquidation de la retraite. En cas de dépassement, la pension est réduite.

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
- **Circulaires CNAV post-septembre 2023** clarifiant l'âge légal, la durée d'assurance requise et le rachat de cotisations.
- **Loi de financement de la Sécurité sociale pour 2026 (L. n° 2025-1719 du 30 décembre 2025).** Cette loi, promulguée le 30 décembre 2025 et publiée au Journal officiel le 31 décembre 2025, suspend le calendrier d'augmentation de l'âge légal de départ à la retraite pour certaines générations jusqu'à janvier 2028 et réforme les règles du cumul emploi-retraite à compter du 1er janvier 2027.
- **Arrêté du 22 décembre 2025** portant fixation du plafond de la Sécurité sociale pour 2026 (PASS à 48 060 €).
- **Arrêté du 22 mai 2026** relatif au relèvement du salaire minimum de croissance (SMIC), portant le SMIC horaire brut à 12,31 euros et le SMIC mensuel brut (35 heures) à 1 867,02 euros à compter du 1er juin 2026.
- **Circulaire Cnav 2026-07 du 1er juillet 2026** précisant les nouvelles dispositions de la LFSS 2026 concernant l'âge légal et la durée d'assurance pour les retraites prenant effet à compter du 1er septembre 2026.
- **Décrets attendus :** En date du 8 juillet 2026, les décrets d'application relatifs aux mesures de la LFSS 2026 concernant la retraite des mères (intégration de trimestres liés aux enfants pour les carrières longues, recalcul des pensions) ne sont pas encore publiés, ce qui bloque de nombreux dossiers.

Date de mise à jour : 8 juillet 2026.