import React from 'react'
import { Link } from 'react-router-dom'
import { LABELS } from '../config/labels'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '3rem 0', marginTop: 'auto', backgroundColor: 'var(--bg-card)' }}>
      <div className="container flex flex-col items-center gap-6 text-center">
        
        <p className="text-base text-muted font-medium">
          {LABELS.TAGLINE}
        </p>

        <div className="flex gap-6 flex-wrap justify-center text-sm text-muted font-medium">
          <Link to="/mentions-legales" className="hover:text-main">{LABELS.LEGAL_MENTIONS}</Link>
          <Link to="/cgv" className="hover:text-main">{LABELS.CGV}</Link>
          <Link to="/politique-confidentialite" className="hover:text-main">{LABELS.PRIVACY_POLICY}</Link>
          <Link to="/securite" className="hover:text-main">{LABELS.DATA_SECURITY}</Link>
        </div>
        
        <div className="text-sm text-muted">
          <p>{LABELS.COPYRIGHT}</p>
        </div>

      </div>
    </footer>
  )
}
