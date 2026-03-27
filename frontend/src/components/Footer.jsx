import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer" style={{ 
      marginTop: 'auto', 
      padding: '40px 20px', 
      borderTop: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.02)',
      textAlign: 'center'
    }}>
      <div className="container">
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--primary)' }}>🔍 RIS Pro</span>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            L'outil d'analyse expert pour votre relevé de carrière.
          </p>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '30px', 
          marginBottom: 20,
          flexWrap: 'wrap'
        }}>
          <Link to="/mentions" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 13, opacity: 0.8 }}>Mentions Légales</Link>
          <Link to="/cgv" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 13, opacity: 0.8 }}>CGV</Link>
          <Link to="/privacy" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 13, opacity: 0.8 }}>Politique de Confidentialité</Link>
          <Link to="/security" style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 13, opacity: 0.8 }}>Sécurité des données</Link>
        </div>
        
        <p style={{ color: 'var(--text-subtle)', fontSize: 12 }}>
          © {new Date().getFullYear()} Hologram Conseils. Tous droits réservés.
        </p>
      </div>
    </footer>
  )
}
