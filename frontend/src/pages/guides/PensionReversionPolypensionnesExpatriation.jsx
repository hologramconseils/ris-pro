import React from 'react'
import SEO from '../../components/SEO'
import { SEO_ROUTES_BY_PATH } from '../../seoRoutes'
import GuideArticle, { FactTable } from './GuideArticle'

const PATH = '/guides/pension-reversion-polypensionnes-expatriation'
const TITLE = 'Pension de réversion, polypensionnés, expatriation : les règles à connaître'
const DESCRIPTION = "Trois situations qui compliquent le calcul d'une retraite : le décès d'un conjoint, une carrière partagée entre plusieurs régimes, ou des années travaillées à l'étranger. Ce que dit précisément la réglementation 2026."

const FAQ = [
  {
    q: 'Le PACS ou le concubinage ouvrent-ils droit à la pension de réversion ?',
    a: "Non. Pour le régime général comme pour l'Agirc-Arrco, seul le mariage ouvre droit à la réversion — le PACS et le concubinage n'ouvrent aucun droit. Dans la fonction publique, le PACS et le concubinage notoire suspendent même le droit à réversion s'ils surviennent après le décès.",
  },
  {
    q: 'Si je me remarie, est-ce que je perds ma pension de réversion ?',
    a: "Cela dépend du régime. Au régime général, le remariage ne fait pas perdre le droit, mais les revenus du nouveau conjoint sont intégrés au plafond de ressources. À l'Agirc-Arrco, le remariage entraîne l'annulation définitive de la réversion. Dans la fonction publique, il entraîne sa suspension.",
  },
  {
    q: 'Qu\'est-ce que la LURA et suis-je concerné ?',
    a: "La Liquidation Unique des Régimes Alignés s'applique si vous êtes né après 1953 et avez cotisé à au moins deux régimes « alignés » : le régime général des salariés, la MSA salariés, ou la SSI (ex-RSI). Votre pension de base est alors calculée en une seule fois, comme si vous n'aviez cotisé qu'à un seul régime, sur vos 25 meilleures années tous régimes alignés confondus.",
  },
  {
    q: 'Puis-je additionner mes trimestres travaillés dans plusieurs pays différents ?',
    a: "Au sein de l'Espace économique européen et de la Suisse, oui : les trimestres se totalisent automatiquement entre pays membres. Hors EEE, la France applique des conventions bilatérales avec une quarantaine de pays, mais en règle générale sans possibilité de totaliser trois pays différents entre eux — chaque convention fonctionne de façon indépendante.",
  },
  {
    q: 'Comment racheter mes années travaillées à l\'étranger ?',
    a: "Le rachat de trimestres pour expatriation, contrairement au rachat classique plafonné à 12 trimestres, n'est soumis à aucun plafond. La demande doit être déposée dans un délai maximal de 10 ans suivant la fin de l'activité à l'étranger, et son coût dépend de votre âge, de vos revenus français récents et de l'option choisie.",
  },
]

export default function PensionReversionPolypensionnesExpatriation() {
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
        intro="Trois situations reviennent souvent parmi les dossiers les plus mal compris : le versement d'une pension après le décès d'un conjoint, une carrière partagée entre plusieurs caisses de retraite, et des années travaillées hors de France. Chacune obéit à des règles précises, encore méconnues du grand public."
        tldr={[
          'Réversion régime général : 54 % de la pension du défunt, sous conditions de mariage, d’âge (55 ans) et de ressources (plafond 2026 : 25 001,60 € seul, 40 002,56 € en couple).',
          'Réversion Agirc-Arrco : 60 % des points du défunt, sans condition de ressources, mais annulée définitivement en cas de remariage.',
          'LURA : les carrières menées dans plusieurs régimes alignés (salarié, MSA, indépendant) sont fusionnées en un seul calcul de pension.',
          'Expatriation : totalisation automatique des trimestres au sein de l’EEE et de la Suisse ; rachat de trimestres sans plafond pour les années travaillées hors de ce périmètre.',
        ]}
        faq={FAQ}
        related={[
          { to: '/guides/cumul-emploi-retraite', title: 'Cumul emploi-retraite : les règles 2026' },
          { to: '/guides/trimestres-manquants-releve-de-carriere', title: 'Trimestres manquants sur le relevé de carrière' },
        ]}
      >
        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Pension de réversion : ce que touche le conjoint survivant
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Au régime général, la pension de réversion correspond à <strong>54 %</strong> de la retraite que percevait — ou aurait perçue — le conjoint décédé, avec un minimum garanti de <strong>334,92 €/mois</strong> en 2026 (si le défunt a cotisé au moins 60 trimestres) et un maximum de <strong>1 081,35 €/mois</strong>.
          </p>
          <FactTable
            caption="Conditions par régime"
            rows={[
              ['Régime général (CNAV/SSI)', '54 % · mariage requis · 55 ans minimum · sous plafond de ressources'],
              ['Agirc-Arrco (complémentaire)', '60 % des points · 55 ans (ou sans condition si 2 enfants à charge/invalide) · sans condition de ressources'],
              ['Fonction publique (SRE/CNRACL)', '50 % · 4 ans de mariage ou enfant issu de l’union · sans condition d’âge ni de ressources'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            Le PACS et le concubinage n'ouvrent aucun droit à la réversion, quel que soit le régime. Si le défunt a été marié plusieurs fois, la pension est partagée entre le conjoint survivant et le ou les ex-conjoints divorcés, <strong>proportionnellement à la durée de chaque mariage</strong> ; si l'un des bénéficiaires décède, sa part est reportée sur les autres.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Polypensionnés : quand votre carrière relève de plusieurs régimes
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Si vous avez cotisé à au moins deux <strong>régimes alignés</strong> (régime général des salariés, MSA salariés, SSI pour les artisans-commerçants) et que vous êtes né après 1953, la <strong>LURA</strong> (Liquidation Unique des Régimes Alignés) s'applique automatiquement : un seul calcul est effectué, comme si toute votre carrière avait été menée dans un seul régime, sur la base de vos 25 meilleures années tous régimes alignés confondus — dans la limite du plafond annuel de la Sécurité sociale, et sans jamais dépasser 4 trimestres validés par an même en cas de double cotisation la même année.
          </p>
          <p className="text-muted">
            En revanche, si une partie de votre carrière relève d'un régime <strong>non aligné</strong> (fonction publique, professions libérales CNAVPL, régimes spéciaux), la LURA ne s'applique pas à cette partie : chaque régime liquide alors sa propre pension séparément, sur son propre salaire ou traitement de référence. Le droit au taux plein s'apprécie néanmoins en cumulant la totalité des trimestres validés, tous régimes confondus — un trimestre cotisé en libéral compte pour apprécier le taux plein au régime général, et inversement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Carrière à l'étranger : ce qui est compté, ce qui ne l'est pas
          </h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Le traitement d'une période travaillée hors de France dépend entièrement du pays concerné :
          </p>
          <FactTable
            rows={[
              ['Union européenne, EEE, Suisse', 'Totalisation automatique des trimestres ; la France verse le montant le plus favorable entre pension nationale et pension proratisée'],
              ['~40 pays sous convention bilatérale (États-Unis, Canada, Japon, Maroc...)', 'Même principe, mais limité au cadre de chaque convention prise isolément'],
              ['Pays sans convention (ex. Chine, Émirats arabes unis)', 'Périodes non comptabilisées en France ; pension française calculée sur la seule carrière française'],
            ]}
          />
          <p className="text-muted" style={{ marginTop: '1rem' }}>
            Deux dispositifs permettent de limiter la perte de droits pour un expatrié : le <strong>rachat de trimestres pour expatriation</strong>, sans plafond de trimestres (contrairement au rachat classique limité à 12 trimestres), à demander dans les 10 ans suivant la fin de l'activité à l'étranger ; et l'adhésion volontaire à la <strong>CFE</strong> (Caisse des Français de l'Étranger), qui permet de valider des trimestres de retraite de base directement, comme si l'activité avait eu lieu en France — mais sans générer de points Agirc-Arrco, sauf adhésion complémentaire spécifique sous conditions.
          </p>
        </section>
      </GuideArticle>
    </>
  )
}
