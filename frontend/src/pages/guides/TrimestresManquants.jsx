import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { SEO_ROUTES_BY_PATH } from '../../seoRoutes'
import GuideArticle, { FactTable } from './GuideArticle'

const PATH = '/guides/trimestres-manquants-releve-de-carriere'
const TITLE = 'Trimestres manquants sur le relevé de carrière : comment les détecter et les corriger'
const DESCRIPTION = "Pourquoi un relevé de carrière contient souvent des trimestres manquants ou des salaires erronés, comment les repérer vous-même, et les démarches pour les faire corriger avant qu'il ne soit trop tard."

const FAQ = [
  {
    q: 'Où trouver mon relevé de carrière ?',
    a: "Gratuitement sur info-retraite.fr, rubrique « Mon relevé de carrière », via votre connexion FranceConnect ou Ameli. Vous pouvez télécharger votre RIS (Relevé Individuel de Situation) ou votre EIG (Estimation Individuelle Globale) au format PDF, disponible 24h/24.",
  },
  {
    q: 'Le relevé fourni par ma caisse de retraite est-il fiable à 100 % ?',
    a: "Non. Le relevé agrège les déclarations transmises par vos employeurs successifs et par les organismes sociaux (Pôle emploi, CPAM...). Une déclaration manquante, tardive ou erronée d'un seul de ces émetteurs suffit à créer un trou dans votre relevé, sans qu'aucune alerte ne vous soit envoyée.",
  },
  {
    q: "Quel est le délai pour faire corriger une anomalie ?",
    a: "Il n'existe pas de délai de prescription général pour faire corriger une erreur manifeste sur votre carrière, mais certaines démarches ont des échéances propres : par exemple, le rachat de trimestres d'études supérieures à tarif préférentiel n'est possible que jusqu'au 31 décembre de l'année de vos 40 ans. Plus une anomalie est ancienne, plus les justificatifs (bulletins de paie, attestations) sont difficiles à retrouver — d'où l'intérêt de vérifier tôt.",
  },
  {
    q: 'Un trimestre non validé peut-il disparaître définitivement ?',
    a: "S'il s'agit d'une omission de déclaration par un employeur, non : vous pouvez la faire corriger à tout moment sur présentation de justificatifs. En revanche, si le trimestre correspond à une période réellement non travaillée et non rachetable, il reste manquant — d'où l'intérêt des dispositifs de rachat ou de la surcote pour compenser.",
  },
  {
    q: 'RIS Pro remplace-t-il une vérification par ma caisse de retraite ?',
    a: "Non. RIS Pro est un outil d'analyse et d'orientation : il identifie les anomalies probables et vous indique précisément quels justificatifs rassembler et quelle démarche engager. La correction elle-même reste effectuée par votre caisse de retraite (Carsat, SSI, SRE, CNRACL...), sur la base du dossier que vous lui présentez.",
  },
]

export default function TrimestresManquants() {
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
        intro="Votre pension à taux plein dépend d'un nombre précis de trimestres validés. Un employeur qui n'a pas déclaré une période, une année de temps partiel jamais complétée, un stage oublié : chacune de ces situations, une fois multipliée sur 40 ans de carrière, peut coûter plusieurs milliers d'euros de pension. Voici comment les repérer."
        tldr={[
          "Un trimestre est validé dès lors qu'un revenu brut au moins égal à 150 heures de SMIC a été déclaré sur l'année — soit 1 846,50 € par trimestre en 2026.",
          "Le relevé de carrière agrège des déclarations d'employeurs et d'organismes tiers : une erreur ou un oubli de leur part crée un trou invisible tant que vous ne comparez pas vous-même.",
          "Jusqu'à 12 trimestres manquants peuvent être rachetés (études supérieures, années incomplètes), sous conditions de coût et de délai.",
          "Plus vous vérifiez tôt, plus les justificatifs (bulletins de paie, attestations employeur) sont faciles à retrouver.",
        ]}
        faq={FAQ}
        related={[
          { to: '/guides/cumul-emploi-retraite', title: 'Cumul emploi-retraite : les règles 2026' },
          { to: '/guides/depart-anticipe-retraite-progressive', title: 'Départ anticipé et retraite progressive' },
        ]}
      >
        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Qu'est-ce qu'un « trimestre manquant » exactement ?
          </h2>
          <p className="text-muted">
            Un trimestre de retraite n'est pas une période calendaire : c'est une unité validée en fonction du revenu que vous avez perçu et déclaré sur l'année, quel que soit le nombre de jours réellement travaillés. En 2026, il faut avoir perçu un revenu brut au moins égal à <strong>150 heures de SMIC</strong> pour valider un trimestre, soit <strong>1 846,50 €</strong> (le SMIC horaire brut étant de 12,31 € depuis le 1er juin 2026). Pour valider les 4 trimestres d'une année complète, il faut donc un revenu brut annuel d'au moins <strong>7 386 €</strong>.
          </p>
          <p className="text-muted" style={{ marginTop: '0.75rem' }}>
            Conséquence directe : une année de temps très partiel, un contrat court mal rémunéré, ou une activité non salariée en dessous de ce seuil peut ne valider qu'un, deux ou trois trimestres au lieu de quatre — sans que rien, sur votre bulletin de paie, ne vous le signale.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Les causes les plus fréquentes d'un relevé incomplet
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Dans l'immense majorité des cas, l'anomalie ne vient pas d'une erreur de votre part, mais d'un tiers :
          </p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
            <li>Un employeur qui a mal déclaré, déclaré en retard, ou jamais déclaré une période salariée — y compris en cas de liquidation ou de faillite de l'entreprise.</li>
            <li>Des périodes de chômage, maladie, maternité ou invalidité qui ouvrent pourtant droit à des trimestres assimilés, mais que Pôle emploi ou la CPAM n'a pas correctement transmises à votre caisse de retraite.</li>
            <li>Des stages ou périodes d'apprentissage, notamment entre 1972 et 2013, dont la prise en compte obéit à des règles particulières et est souvent omise.</li>
            <li>Des années à cheval sur plusieurs régimes (salarié puis indépendant, ou secteur privé puis fonction publique) où chaque caisse ne voit que « sa » part de la carrière.</li>
            <li>Des périodes travaillées à l'étranger, qui ne remontent pas automatiquement dans le relevé français.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Comment vérifier votre relevé vous-même
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Trois réflexes suffisent à repérer la plupart des anomalies :
          </p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
            <li><strong>Comparer année par année</strong> le nombre de trimestres validés affiché avec votre situation réelle (temps plein, temps partiel, inactivité).</li>
            <li><strong>Repérer les salaires à zéro ou anormalement bas</strong> sur une année où vous avez pourtant travaillé.</li>
            <li><strong>Vérifier les noms d'employeurs</strong> : un employeur absent ou une raison sociale incohérente avec vos bulletins de paie est un signal fort.</li>
          </ul>
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            C'est précisément ce croisement — relevé contre réglementation et cohérence interne — que RIS Pro automatise : l'outil compare chaque année de votre RIS/EIG aux règles en vigueur et signale les écarts avec leur niveau de gravité.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Ce qu'un trimestre manquant coûte réellement
          </h2>
          <p className="text-muted">
            Chaque trimestre qui manque à l'appel, au regard de la durée d'assurance requise pour votre génération, applique une <strong>décote</strong> sur le montant de votre pension de base — sauf si vous atteignez 67 ans, âge d'annulation automatique de la décote quelle que soit votre durée d'assurance. Pour les générations nées à partir de 1974, 172 trimestres sont nécessaires pour le taux plein. Un déficit de seulement 4 trimestres (un an), non compensé, se traduit par une décote qui reste appliquée à vie sur votre pension.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Comment faire corriger une anomalie
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Une fois l'anomalie identifiée, la démarche se fait directement auprès de votre caisse de retraite (Carsat/CNAV pour le régime général, SSI pour les indépendants, SRE ou CNRACL pour la fonction publique), avec les pièces justificatives correspondantes :
          </p>
          <FactTable
            rows={[
              ['Période salariée non déclarée', 'Bulletins de paie, contrat de travail, attestation employeur'],
              ['Chômage non comptabilisé', 'Attestations Pôle emploi / France Travail'],
              ['Maladie, maternité, invalidité', 'Décomptes CPAM'],
              ['Stage ou apprentissage', 'Convention de stage, contrat d’apprentissage'],
            ]}
          />
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Racheter des trimestres pour combler un vrai manque
          </h2>
          <p className="text-muted">
            Lorsque le manque correspond à une période réellement incomplète (études, année à temps partiel) et non à une erreur de déclaration, le <strong>rachat de trimestres</strong> (versement pour la retraite) permet d'acheter jusqu'à <strong>12 trimestres</strong> sur l'ensemble de la carrière, pour des années d'études supérieures validées par un diplôme ou des années civiles incomplètes. Le rachat à tarif réduit pour études supérieures reste possible jusqu'au 31 décembre de l'année de vos 40 ans, et celui lié à un stage en entreprise jusqu'au 31 décembre de l'année de vos 30 ans. Le coût du rachat augmente avec l'âge et les revenus de l'assuré.
          </p>
        </section>
      </GuideArticle>
    </>
  )
}
