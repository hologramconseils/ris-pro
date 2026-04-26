import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '3rem 0', marginTop: 'auto', backgroundColor: 'var(--bg-card)' }}>
      <div className="container flex flex-col items-center gap-6 text-center">
        
        <p className="text-base text-muted font-medium">
          L'outil d'analyse expert pour votre relevé de carrière.
        </p>

        <div className="flex gap-6 flex-wrap justify-center text-sm text-muted font-medium">
          <Link to="/mentions-legales" className="hover:text-main">Mentions Légales</Link>
          <Link to="/cgv" className="hover:text-main">CGV</Link>
          <Link to="/politique-confidentialite" className="hover:text-main">Politique de Confidentialité</Link>
          <Link to="/securite" className="hover:text-main">Sécurité des données</Link>
        </div>
        
        <div className="text-sm text-muted">
          <p>© 2026 Hologram Conseils. Tous droits réservés.</p>
        </div>

      </div>
    </footer>
  )
}
