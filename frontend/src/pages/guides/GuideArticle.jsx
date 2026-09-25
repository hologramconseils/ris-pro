import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { LABELS } from '../../config/labels'

export default function GuideArticle({ title, updated, intro, tldr = [], children, faq = [], related = [] }) {
  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', flex: 1, maxWidth: '800px' }}>
      <Link
        to="/guides"
        className="text-sm font-medium text-muted"
        style={{ display: 'flex', width: 'fit-content', alignItems: 'center', gap: '0.35rem', marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={16} /> Tous les guides retraite
      </Link>

      <span
        className="text-sm font-semibold"
        style={{ display: 'block', color: 'var(--primary-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
      >
        Guide retraite
      </span>
      <h1 className="text-4xl font-bold mt-2 mb-4">{title}</h1>
      <p className="text-sm text-muted" style={{ marginBottom: '1.5rem' }}>
        Mis à jour le {updated} · Hologram Conseils — intègre les ajustements de la LFSS 2026
      </p>
      <p className="text-xl text-muted" style={{ marginBottom: '2rem' }}>{intro}</p>

      {tldr.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', background: 'var(--secondary)', border: 'none', boxShadow: 'none' }}>
          <h2 className="text-lg font-semibold" style={{ marginBottom: '1rem' }}>L'essentiel en bref</h2>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {tldr.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-muted">
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '3px', color: 'var(--success)' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card flex flex-col gap-8">
        {children}
      </div>

      {faq.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 className="text-2xl font-bold" style={{ marginBottom: '1.25rem' }}>Questions fréquentes</h2>
          <div className="flex flex-col gap-4">
            {faq.map((item, i) => (
              <div key={i} className="card">
                <h3 className="text-lg font-semibold" style={{ marginBottom: '0.5rem' }}>{item.q}</h3>
                <p className="text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card glass" style={{ marginTop: '3rem', textAlign: 'center', padding: '2.5rem 2rem' }}>
        <h2 className="text-xl font-bold" style={{ marginBottom: '0.75rem' }}>
          Et si votre relevé cachait ce type d'anomalie ?
        </h2>
        <p className="text-muted" style={{ maxWidth: '520px', margin: '0 auto 1.5rem' }}>
          RIS Pro analyse votre relevé de carrière et détecte gratuitement les trimestres manquants, salaires erronés et droits non déclarés en quelques minutes.
        </p>
        <div className="flex gap-4 justify-center" style={{ flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">{LABELS.CTA_START_ANALYSIS}</Link>
          <a
            href="https://calendly.com/hologramconseils/reservez-votre-appel-strategique"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Appel stratégique gratuit
          </a>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 className="text-lg font-semibold" style={{ marginBottom: '1rem' }}>À lire aussi</h2>
          <div className="flex flex-col gap-3">
            {related.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="font-medium"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {r.title} <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function FactTable({ caption, rows }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {caption && (
        <div className="text-sm font-semibold" style={{ padding: '0.75rem 1rem', background: 'var(--secondary)' }}>
          {caption}
        </div>
      )}
      {rows.map(([label, value], i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4"
          style={{
            padding: '0.75rem 1rem',
            borderTop: i === 0 && !caption ? 'none' : '1px solid var(--border)',
          }}
        >
          <span className="text-muted" style={{ fontSize: '0.95rem' }}>{label}</span>
          <span className="font-semibold" style={{ textAlign: 'right' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
