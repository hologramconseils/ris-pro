import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: 500, width: '100%', textAlign: 'center', margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Oups ! Introuvable</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 16 }}>
          Le document ou la page que vous cherchez n'existe pas ou a été supprimé.
        </p>
        <Link to="/" className="btn btn-primary btn-large" style={{ display: 'inline-flex' }}>
          🏠 Retourner à l'accueil
        </Link>
      </div>
    </div>
  )
}
