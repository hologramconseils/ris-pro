import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ onClose, onSuccess, mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login, register } = useAuth()

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else if (mode === 'register') {
        await register(form)
      } else if (mode === 'forgot') {
        const { authAPI } = await import('../services/api')
        await authAPI.forgotPassword(form.email)
        alert('Si votre email existe, vous recevrez un lien de réinitialisation d\'ici quelques instants.')
        setMode('login')
      }
      if (mode !== 'forgot') {
        onSuccess?.()
        onClose?.()
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Une erreur est survenue. Vérifiez vos informations.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>
              {mode === 'login' ? 'Connexion' : mode === 'register' ? 'Créer un compte' : 'Réinitialiser le mot de passe'}
            </h2>
            <p className="subtitle">
              {mode === 'login' ? 'Accédez à vos analyses sauvegardées.' : mode === 'register' ? 'Rejoignez RIS Pro gratuitement.' : 'Entrez votre email pour recevoir un lien.'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <label>Prénom *</label>
                <input className="input" name="first_name" placeholder="Jean" value={form.first_name} onChange={handle} required />
              </div>
              <div className="input-group">
                <label>Nom de famille *</label>
                <input className="input" name="last_name" placeholder="Dupont" value={form.last_name} onChange={handle} required />
              </div>
            </>
          )}
          <div className="input-group">
            <label>Email *</label>
            <input className="input" type="email" name="email" placeholder="jean.dupont@example.com" value={form.email} onChange={handle} required />
          </div>
          
          {mode !== 'forgot' && (
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Mot de passe *</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}>
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  className="input" 
                  type={showPassword ? "text" : "password"} 
                  name="password" 
                  placeholder="••••••••" 
                  value={form.password} 
                  onChange={handle} 
                  required 
                  minLength={6} 
                  style={{ paddingRight: 40 }}
                />
                <button 
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.6
                  }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="alert alert-error">⚠️ {error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="modal-footer">
          {mode === 'login' ? (
            <span>Pas encore de compte ? <a onClick={() => { setMode('register'); setError('') }}>S'inscrire gratuitement</a></span>
          ) : (
            <span>Déjà un compte ? <a onClick={() => { setMode('login'); setError('') }}>Se connecter</a></span>
          )}
        </div>
      </div>
    </div>
  )
}
