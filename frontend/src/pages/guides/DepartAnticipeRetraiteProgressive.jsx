import React from 'react'
import SEO from '../../components/SEO'
import { SEO_ROUTES_BY_PATH } from '../../seoRoutes'
import GuideArticle, { FactTable } from './GuideArticle'

const PATH = '/guides/depart-anticipe-retraite-progressive'
const TITLE = 'Départ anticipé et retraite progressive : les dispositifs pour partir plus tôt'
const DESCRIPTION = "Carrière longue, travailleur handicapé, incapacité permanente, retraite progressive dès 60 ans : les conditions précises de chaque dispositif permettant de partir avant l'âge légal ou de réduire son activité en douceur."

const FAQ = [
  {
    q: 'Puis-je cumuler carrière longue et retraite progressive ?',
    a: "Non, ce sont deux dispositifs distincts et non cumulables : la carrière longue permet un départ complet et anticipé si vous avez commencé à travailler jeune, tandis que la retraite progressive permet de continuer à travailler à temps partiel en touchant une fraction de votre pension, à partir de 60 ans quel que soit l'âge auquel vous avez commencé votre carrière.",
  },
  {
    q: 'Mon employeur peut-il refuser ma demande de retraite progressive ?',
    a: "Il doit donner son accord sur la quotité de temps partiel demandée, mais un refus doit être motivé. En pratique, il est recommandé d'engager la discussion suffisamment tôt et de déposer la demande auprès de votre caisse de retraite environ 5 mois avant la date souhaitée.",
  },
  {
    q: 'La retraite progressive réduit-elle définitivement le montant de ma pension finale ?',
    a: "Non. Pendant la retraite progressive, vous continuez à cotiser sur votre activité à temps partiel et donc à acquérir des trimestres et des droits supplémentaires. Au moment de la liquidation définitive, votre pension est recalculée en tenant compte de l'ensemble de la période, primes de surcote éventuelle incluse si vous avez dépassé le taux plein.",
  },
  {
    q: 'Les fonctionnaires de catégorie active peuvent-ils bénéficier de la retraite progressive ?',
    a: "En général non : les agents de catégorie active (policiers, pompiers, aides-soignants...), qui bénéficient déjà d'un âge de départ anticipé du fait de la pénibilité de leur emploi, restent généralement exclus du dispositif de retraite progressive.",
  },
]

export default function DepartAnticipeRetraiteProgressive() {
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
      <SEO {...SEO_ROUTES_BY_PATH[PATH]} type="article" jsonLd={jsonLd} />
      <GuideArticle
        title={TITLE}
        updated="25 septembre 2026"
        intro="L'âge légal de départ progresse vers 64 ans, mais plusieurs dispositifs légaux permettent de partir plus tôt — ou de réduire progressivement son activité tout en touchant une partie de sa pension. Voici les conditions exactes de chacun."
        tldr={[
          'Carrière longue : départ possible dès 58, 60, 60/62 ou 63 ans selon votre âge de début d’activité (avant 16, 18, 20 ou 21 ans).',
          'Travailleur handicapé : départ dès 55 ans avec un taux d’incapacité d’au moins 50 % tout au long de la période d’assurance.',
          'Incapacité permanente (AT/MP) : départ dès 60 ans sans décote si le taux est ≥ 20 %.',
          'Retraite progressive : accessible dès 60 ans pour tous depuis le 1er septembre 2025, avec 150 trimestres validés et une activité entre 40 % et 80 % d’un temps complet.',
        ]}
        faq={FAQ}
        related={[
          { to: '/guides/trimestres-manquants-releve-de-carriere', title: 'Trimestres manquants sur le relevé de carrière' },
          { to: '/guides/pension-reversion-polypensionnes-expatriation', title: 'Réversion, polypensionnés, expatriation' },
        ]}
      >
        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Carrière longue : partir avant l'âge légal parce que vous avez commencé tôt
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Ce dispositif s'adresse aux assurés ayant validé au moins 5 trimestres avant la fin de l'année civile de leur 16e, 18e, 20e ou 21e anniversaire (4 trimestres si vous êtes né au dernier trimestre de l'année concernée). Certaines périodes comptent désormais comme trimestres cotisés pour ce calcul : l'assurance vieillesse des parents au foyer et des aidants (dans la limite de 4 trimestres chacune), ainsi que les périodes d'apprentissage entre 1972 et 2013.
          </p>
          <FactTable
            caption="Âge de départ anticipé selon le début d'activité"
            rows={[
              ['Activité commencée avant 16 ans', 'Dès 58 ans'],
              ['Activité commencée avant 18 ans', 'Dès 60 ans'],
              ['Activité commencée avant 20 ans', 'Entre 60 et 62 ans selon l’année de naissance'],
              ['Activité commencée avant 21 ans', 'Dès 63 ans'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            Une clause de sauvegarde protège les assurés nés entre le 1er septembre 1961 et le 31 décembre 1963 qui remplissaient déjà les conditions de durée cotisée avant le 1er septembre 2023 : ils conservent le bénéfice des règles antérieures à la réforme.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Travailleur handicapé : départ dès 55 ans
          </h2>
          <p className="text-muted">
            Si vous justifiez d'un taux d'incapacité permanente d'au moins 50 % pendant toute la durée d'assurance prise en compte, un départ dès 55 ans est possible. Depuis la réforme de 2023, seule la durée d'assurance <em>cotisée</em> sous handicap est exigée — la condition, plus stricte, de durée d'assurance <em>validée</em> a été supprimée.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Incapacité permanente : accident du travail ou maladie professionnelle
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Si votre incapacité permanente découle d'un accident du travail ou d'une maladie professionnelle reconnue, deux situations existent :
          </p>
          <FactTable
            rows={[
              ['Taux d’incapacité ≥ 20 %', 'Départ dès 60 ans, sans décote, sans condition de durée d’assurance'],
              ['Taux entre 10 % et 19 %', 'Départ possible 2 ans avant l’âge légal, sous 17 ans d’exposition au risque (68 trimestres)'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            La réforme de 2023 a assoupli le second cas en supprimant la condition d'identité de lésions entre l'accident du travail et la maladie professionnelle, et a étendu ce dispositif aux travailleurs indépendants ayant adhéré à l'assurance volontaire pour le risque AT/MP.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Retraite progressive : réduire son activité sans tout arrêter
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Depuis le 1er septembre 2025, l'âge d'accès à la retraite progressive est uniformément fixé à <strong>60 ans</strong>, quelle que soit votre année de naissance — c'est l'une des simplifications les plus notables des dernières années, le dispositif ayant auparavant un calendrier d'âge progressif comme pour le départ classique.
          </p>
          <FactTable
            caption="Conditions au 1er septembre 2025"
            rows={[
              ['Âge minimum', '60 ans, pour tous'],
              ['Durée d’assurance', 'Au moins 150 trimestres, tous régimes de base confondus'],
              ['Quotité de temps partiel (secteur privé)', 'Entre 40 % et 80 % d’un temps complet'],
              ['Quotité de temps partiel (fonction publique)', 'Entre 50 % et 90 % d’un temps complet'],
              ['Accord de l’employeur', 'Requis pour les salariés ; un refus doit être motivé'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            La fraction de pension versée est proportionnelle à la réduction de temps de travail : une activité réduite de 40 % donne droit à 60 % de la pension. Le dispositif est désormais ouvert aux salariés du privé, aux fonctionnaires (hors catégorie active, en général) et, depuis la réforme de 2023, aux professions libérales et aux avocats. La demande doit être déposée auprès de votre caisse de retraite environ 5 mois avant la date souhaitée (jusqu'à 6 mois pour les fonctionnaires d'État, le délai de traitement du SRE étant plus long).
          </p>
        </section>
      </GuideArticle>
    </>
  )
}
