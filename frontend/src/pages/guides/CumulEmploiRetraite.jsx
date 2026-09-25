import React from 'react'
import SEO from '../../components/SEO'
import GuideArticle, { FactTable } from './GuideArticle'

const PATH = '/guides/cumul-emploi-retraite'
const TITLE = 'Cumul emploi-retraite 2026 : règles, plafonds et nouveaux droits à pension'
const DESCRIPTION = "Cumul intégral, cumul plafonné, seconde pension : le fonctionnement actuel du cumul emploi-retraite et la réforme qui entrera en vigueur au 1er janvier 2027 pour les salariés, indépendants et fonctionnaires."

const FAQ = [
  {
    q: 'Je veux reprendre une activité chez mon ancien employeur : est-ce pénalisé ?',
    a: "Oui, un délai de carence de 6 mois s'applique avant que cette reprise chez le dernier employeur ne génère de nouveaux droits, si votre première retraite a pris effet à partir du 1er novembre 2023. Ce délai ne s'applique pas si vous reprenez une activité chez un nouvel employeur.",
  },
  {
    q: 'Dois-je liquider toutes mes retraites pour bénéficier du cumul intégral ?',
    a: "Oui. Le cumul intégral exige d'avoir liquidé l'ensemble de vos pensions — régimes de base et complémentaires, français et étrangers — et de remplir les conditions du taux plein (âge légal et durée d'assurance requise, ou 67 ans, âge d'annulation automatique de la décote).",
  },
  {
    q: 'Le cumul emploi-retraite restera-t-il intéressant après le 1er janvier 2027 ?',
    a: "Cela dépendra surtout de votre âge à la reprise d'activité. Avant l'âge légal, les revenus seront intégralement déduits de la pension. Entre l'âge légal et 67 ans, un plafond annuel s'appliquera (autour de 7 000 € bruts, décret à paraître). À partir de 67 ans, le cumul restera intégral et sans plafond — c'est la situation la plus favorable.",
  },
  {
    q: "Les indépendants et fonctionnaires sont-ils soumis aux mêmes règles ?",
    a: "Le cadre général (cumul intégral sous conditions de taux plein, réforme 2027 basée sur l'âge) s'applique aussi aux indépendants (SSI, professions libérales) et aux fonctionnaires, avec les mêmes seuils. Les régimes complémentaires par points (RCI pour les indépendants, RAFP pour les fonctionnaires) suivent des règles de calcul spécifiques à chaque caisse.",
  },
]

export default function CumulEmploiRetraite() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: TITLE,
        description: DESCRIPTION,
        author: { '@type': 'Organization', name: 'Hologram Conseils' },
        publisher: { '@type': 'Organization', name: 'Hologram Conseils' },
        mainEntityOfPage: `https://ris.hologramconseils.com${PATH}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <SEO title={`${TITLE} | RIS Pro`} description={DESCRIPTION} path={PATH} type="article" jsonLd={jsonLd} />
      <GuideArticle
        title={TITLE}
        updated="25 septembre 2026"
        intro="Cumuler une pension et un revenu d'activité est autorisé depuis longtemps — mais depuis la réforme de 2023, cela peut aussi vous ouvrir de nouveaux droits à retraite. Et une réforme plus large, issue de la LFSS 2026, redéfinira entièrement les règles à partir du 1er janvier 2027."
        tldr={[
          "Le cumul intégral exige d'avoir liquidé toutes vos pensions et d'être au taux plein ; sinon, le cumul est plafonné.",
          "Depuis 2023, travailler en cumul emploi-retraite intégral peut créer une seconde pension, plafonnée à environ 2 403 €/an côté régime de base, non plafonnée côté Agirc-Arrco.",
          "À partir du 1er janvier 2027, les règles changeront selon votre âge : déduction totale avant l'âge légal, plafond annuel entre l'âge légal et 67 ans, cumul intégral illimité après 67 ans.",
          'Un délai de carence de 6 mois peut s’appliquer si vous reprenez une activité chez votre dernier employeur.',
        ]}
        faq={FAQ}
        related={[
          { to: '/guides/depart-anticipe-retraite-progressive', title: 'Départ anticipé et retraite progressive' },
          { to: '/guides/trimestres-manquants-releve-de-carriere', title: 'Trimestres manquants sur le relevé de carrière' },
        ]}
      >
        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Cumul intégral ou cumul plafonné : la distinction qui change tout
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Pour cumuler <strong>intégralement</strong> votre pension et un revenu d'activité, trois conditions doivent être réunies : avoir liquidé l'ensemble de vos pensions de retraite (de base et complémentaires, françaises et étrangères), et remplir les conditions du taux plein — soit l'âge légal et la durée d'assurance requise pour votre génération, soit l'âge d'annulation de la décote, fixé à 67 ans.
          </p>
          <p className="text-muted">
            Si l'une de ces conditions n'est pas remplie (par exemple, une retraite liquidée avec décote), le cumul est <strong>plafonné</strong> : le total des pensions et des revenus d'activité ne doit pas dépasser le montant le plus élevé entre 160 % du SMIC — soit <strong>2 987,23 € bruts mensuels</strong> depuis le 1er juin 2026 — ou la moyenne des trois derniers salaires bruts perçus avant la liquidation. Au-delà, la pension est réduite à due concurrence.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Depuis 2023 : le cumul peut créer une seconde pension
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Avant la réforme de 2023, reprendre une activité en cumul emploi-retraite ne générait aucun nouveau droit : vous cotisiez « à fonds perdu ». Ce n'est plus le cas pour les activités exercées depuis le 1er janvier 2023.
          </p>
          <FactTable
            caption="Ce que génère le cumul emploi-retraite intégral depuis 2023"
            rows={[
              ['Régime de base', 'Seconde pension au taux plein (50 %), plafonnée à ~2 403 €/an (5 % du PASS 2026)'],
              ['Agirc-Arrco (complémentaire)', 'Points sur la tranche 1 des rémunérations, sans plafond, liquidables depuis le 01/01/2024'],
              ['Délai de carence', '6 mois si reprise chez le dernier employeur (sauf si retraite liquidée avant le 15/10/2023)'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            Point important : aucune majoration ou accessoire (par exemple pour enfants) ne s'applique à cette seconde pension, que ce soit côté base ou complémentaire. Et une fois cette seconde pension liquidée, aucune activité ultérieure ne peut plus générer de nouveaux droits.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Le changement au 1er janvier 2027
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            La Loi de financement de la Sécurité sociale pour 2026 (LFSS 2026) réforme en profondeur le cumul emploi-retraite pour les pensions prenant effet à compter du <strong>1er janvier 2027</strong>. La distinction cumul intégral / cumul plafonné disparaît, remplacée par trois paliers selon votre âge :
          </p>
          <FactTable
            rows={[
              ["Avant l'âge légal de départ", "Revenus d'activité déduits en totalité de la pension, dès le premier euro. Aucun nouveau droit."],
              ["Entre l'âge légal et 67 ans", "Cumul plafonné à un seuil annuel estimé à 7 000 € bruts (décret à paraître). Au-delà, la pension diminue de 50 % du dépassement. Aucun nouveau droit."],
              ['À partir de 67 ans', "Cumul intégral et illimité. Les cotisations versées continuent à générer de nouveaux droits à retraite."],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            Autrement dit : plus vous prolongez votre activité au-delà de 67 ans, plus le cumul reste avantageux dans le nouveau système. C'est aussi à partir de cet âge que la LFSS 2026 introduit la possibilité d'une seconde retraite pour les périodes travaillées après 67 ans, avec des décrets d'application encore attendus.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Indépendants, professions libérales, fonctionnaires
          </h2>
          <p className="text-muted">
            Le cadre général s'applique aussi hors salariat du privé. Les travailleurs indépendants (SSI) et les professions libérales (CNAVPL) peuvent bénéficier du cumul intégral créateur de droits dans les mêmes conditions de taux plein, avec une retraite complémentaire calculée par points (RCI pour les indépendants). Les fonctionnaires (SRE, CNRACL) suivent également ce cadre, leur retraite additionnelle (RAFP) fonctionnant elle aussi par points. Dans tous les cas, la réforme applicable au 1er janvier 2027 s'appliquera de la même manière, selon l'âge de l'assuré au moment de la reprise d'activité.
          </p>
        </section>
      </GuideArticle>
    </>
  )
}
