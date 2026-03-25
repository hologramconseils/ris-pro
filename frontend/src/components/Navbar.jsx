import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import AuthModal from './AuthModal'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const openLogin = () => { setAuthMode('login'); setShowAuth(true); setMobileMenuOpen(false); }
  const openRegister = () => { setAuthMode('register'); setShowAuth(true); setMobileMenuOpen(false); }

  const handleAuthSuccess = () => {
    navigate('/')
  }

  const handleHomeClick = (e) => {
    if (window.location.pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setMobileMenuOpen(false)
  }

  return (
    <>
      <nav className="navbar">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="hamburger-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <Link className="navbar-brand" to="/" onClick={handleHomeClick}>🔍 RIS Pro</Link>
          <Link to="/" className="btn btn-secondary btn-nav btn-nav-home" onClick={handleHomeClick} style={{ textDecoration: 'none' }}>Accueil</Link>
        </div>

        <div id="navbar-portal-root" className="navbar-portal-root" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}></div>

        <div className="navbar-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {user ? (
            <div className="desktop-nav-auth" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="user-badge-desktop" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {user.is_admin && <span style={{ color: 'var(--primary-light)', fontWeight: 'bold' }}>✦ Admin</span>}
                {user.has_paid_access && !user.is_admin && <span style={{ color: 'var(--success)' }}>✦ Accès Pro</span>}
                <span className="user-name-desktop">{user.first_name}</span>
              </span>
              {user.is_admin && <Link to="/admin" className="btn btn-secondary btn-nav" style={{ textDecoration: 'none', borderColor: 'var(--primary)' }}>Admin</Link>}
              <Link to="/dashboard" className="btn btn-secondary btn-nav" style={{ textDecoration: 'none' }}>Tableau</Link>
              <button className="btn btn-secondary btn-nav" onClick={logout}>Déconnexion</button>
            </div>
          ) : (
            <div className="desktop-nav-guest" style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={openLogin}>Connexion</button>
              <button className="btn btn-primary btn-sm" onClick={openRegister}>S'inscrire</button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <span className="navbar-brand">🔍 RIS Pro</span>
              <button className="close-menu" onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>
            
            <div className="mobile-menu-content">
              {user && (
                <div className="mobile-user-info" style={{ marginBottom: 24, padding: '0 8px' }}>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{user.first_name} {user.last_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {user.is_admin ? '🛡️ Administrateur' : user.has_paid_access ? '⭐ Client Privilégié' : '👤 Utilisateur Free'}
                  </div>
                </div>
              )}
              
              <Link to="/" onClick={handleHomeClick} className="mobile-nav-link">🏠 Accueil</Link>
              
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">📊 Tableau de bord</Link>
                  <Link to="/history" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">📂 Historique</Link>
                  {user.is_admin && <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link" style={{ color: 'var(--primary-light)' }}>🛡️ Administration</Link>}
                  <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
                  <button className="btn btn-secondary btn-block" onClick={() => { logout(); setMobileMenuOpen(false); }}>🚪 Déconnexion</button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary btn-block" style={{ marginBottom: 12 }} onClick={openLogin}>Se connecter</button>
                  <button className="btn btn-primary btn-block" onClick={openRegister}>Créer un compte</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  )
}
