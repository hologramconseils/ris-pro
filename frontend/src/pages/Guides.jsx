import React from 'react'
import { Link } from 'react-router-dom'
import { FileSearch, Briefcase, Clock, Globe, ArrowRight } from 'lucide-react'
import SEO from '../components/SEO'
import { SEO_ROUTES_BY_PATH } from '../seoRoutes'

const GUIDES = [
  {
    to: '/guides/trimestres-manquants-releve-de-carriere',
    icon: FileSearch,
    title: 'Trimestres manquants sur le relevé de carrière',
    teaser: "Comment repérer une année incomplète, un employeur qui n'a pas déclaré vos cotisations, et les corriger avant qu'il ne soit trop tard.",
  },
  {
    to: '/guides/cumul-emploi-retraite',
    icon: Briefcase,
    title: 'Cumul emploi-retraite : les règles 2026',
    teaser: 'Cumul intégral, cumul plafonné, seconde pension : ce qui change pour les salariés, indépendants et fonctionnaires qui retravaillent après la liquidation.',
  },
  {
    to: '/guides/depart-anticipe-retraite-progressive',
    icon: Clock,
    title: 'Départ anticipé et retraite progressive',
    teaser: 'Carrière longue, travailleur handicapé, retraite progressive dès 60 ans : les dispositifs pour partir plus tôt ou en douceur, et leurs conditions exactes.',
  },
  {
    to: '/guides/pension-reversion-polypensionnes-expatriation',
    icon: Globe,
    title: 'Réversion, polypensionnés, expatriation',
    teaser: "Pension de réversion après un décès, carrière partagée entre plusieurs régimes, années travaillées à l'étranger : comment ces situations sont traitées.",
  },
]

export default function Guides() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guides retraite RIS Pro',
    description: "Guides pratiques sur les trimestres manquants, le cumul emploi-retraite, le départ anticipé et la retraite progressive, la réversion, les polypensionnés et l'expatriation.",
    url: 'https://ris.hologramconseils.com/guides',
    hasPart: GUIDES.map((g) => ({
      '@type': 'Article',
      headline: g.title,
      url: `https://ris.hologramconseils.com${g.to}`,
    })),
  }

  return (
    <>
      <SEO {...SEO_ROUTES_BY_PATH['/guides']} jsonLd={jsonLd} />
      <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1 }}>
        <div className="flex flex-col" style={{ maxWidth: '700px', gap: '1rem', marginBottom: '3rem' }}>
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--primary-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            Guides retraite
          </span>
          <h1 className="text-4xl font-bold">Comprendre vos droits à la retraite, sans jargon</h1>
          <p className="text-xl text-muted">
            Quatre guides écrits par Hologram Conseils pour décrypter les règles qui affectent le plus souvent le montant final d'une pension — mis à jour avec les ajustements de la Loi de financement de la Sécurité sociale pour 2026 (LFSS 2026).
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {GUIDES.map((guide) => {
            const Icon = guide.icon
            return (
              <Link key={guide.to} to={guide.to} className="card glass-hover flex flex-col" style={{ gap: '1rem', color: 'var(--text-main)' }}>
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-text)',
                  }}
                >
                  <Icon size={22} />
                </div>
                <h2 className="text-lg font-semibold">{guide.title}</h2>
                <p className="text-muted text-sm" style={{ flex: 1 }}>{guide.teaser}</p>
                <span className="font-semibold text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-text)' }}>
                  Lire le guide <ArrowRight size={14} />
                </span>
              </Link>
            )
          })}
        </div>

        <div className="card glass" style={{ marginTop: '3rem', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <h2 className="text-xl font-bold" style={{ marginBottom: '0.75rem' }}>
            Plutôt que de lire, faites vérifier votre relevé directement
          </h2>
          <p className="text-muted" style={{ maxWidth: '520px', margin: '0 auto 1.5rem' }}>
            RIS Pro croise votre relevé de carrière avec la réglementation en vigueur et détecte gratuitement les anomalies qui vous concernent.
          </p>
          <Link to="/" className="btn btn-primary">Déposer mon relevé de carrière</Link>
        </div>
      </div>
    </>
  )
}
