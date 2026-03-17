import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import AuthModal from './AuthModal'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const navigate = useNavigate()

  const openLogin = () => { setAuthMode('login'); setShowAuth(true) }
  const openRegister = () => { setAuthMode('register'); setShowAuth(true) }

  const handleAuthSuccess = () => {
    navigate('/')
  }

  return (
    <>
      <nav className="navbar">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <a className="navbar-brand" href="/">🔍 RIS Pro</a>
        </div>

        <div id="navbar-portal-root" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}></div>

        <div className="navbar-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {user.is_admin && <span style={{ color: 'var(--primary-light)', fontWeight: 'bold' }}>✦ Admin</span>}
                {user.has_paid_access && !user.is_admin && <span style={{ color: 'var(--success)' }}>✦ Accès Pro</span>}
                <span>{user.first_name}</span>
              </span>
              <Link to="/history" className="btn btn-secondary btn-nav" style={{ textDecoration: 'none' }}>Historique</Link>
              <button className="btn btn-secondary btn-nav" onClick={logout}>Déconnexion</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={openLogin}>Connexion</button>
              <button className="btn btn-primary btn-sm" onClick={openRegister}>S'inscrire</button>
            </>
          )}
        </div>
      </nav>
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
