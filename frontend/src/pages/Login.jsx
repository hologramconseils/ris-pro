import React, { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert, CheckCircle2, Mail } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { authApi, safeRedirect } from '../authClient'
import { useNoIndex } from '../hooks/useNoIndex'

// Connexion, inscription (adresse e-mail seule : le mot de passe se choisit via le lien reçu) et mot de passe oublié.
export default function Login() {
  useNoIndex()
  const [searchParams, setSearchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const mode = searchParams.get('signup') === 'true' ? 'register' : searchParams.get('forgot') === 'true' ? 'forgot' : 'login'
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const [notice, setNotice] = useState(location.state?.notice || '')

  const switchMode = (next) => {
    const params = new URLSearchParams()
    if (searchParams.get('redirect')) params.set('redirect', searchParams.get('redirect'))
    if (next === 'register') params.set('signup', 'true')
    if (next === 'forgot') params.set('forgot', 'true')
    setError('')
    setNotice('')
    setSearchParams(params)
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    let result
    if (mode === 'login') result = await login(email, password)
    else if (mode === 'register') result = await authApi.register(email)
    else result = await authApi.forgot(email)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    if (mode === 'login') return navigate(redirect, { replace: true })
    setNotice(result.data.message)
  }

  const title = mode === 'login' ? 'Connexion' : mode === 'register' ? 'Créer un compte' : 'Mot de passe oublié'

  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{ flex: 1, padding: '4rem 1.5rem' }}>
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="card glass" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
          <h1 className="text-2xl font-bold" style={{ margin: 0 }}>{title}</h1>
          {mode === 'register' && (
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              Indiquez votre adresse e-mail : vous recevrez un lien pour activer votre compte et choisir votre mot de passe.
            </p>
          )}
          {mode === 'forgot' && (
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.
            </p>
          )}

          {notice ? (
            <>
              <div className="flex items-start gap-2 text-sm p-3" role="status" style={{ borderRadius: '10px', background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} className="text-success" />
                <span>{notice}</span>
              </div>
              {mode === 'register' && (
                <p className="flex items-start gap-2 text-xs text-muted" style={{ margin: 0 }}>
                  <Mail size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>Vous ne le voyez pas d'ici quelques minutes ? Pensez à regarder dans vos courriers indésirables (spams).</span>
                </p>
              )}
            </>
          ) : (
            <>
              <label className="text-sm font-medium" htmlFor="auth-email">Adresse e-mail</label>
              <input
                id="auth-email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', minHeight: '44px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)' }}
              />
              {mode === 'login' && (
                <>
                  <label className="text-sm font-medium" htmlFor="auth-password">Mot de passe</label>
                  <input
                    id="auth-password"
                    type="password"
                    className="input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', minHeight: '44px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)' }}
                  />
                </>
              )}
              {error && (
                <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg" role="alert">
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full" disabled={busy} style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Recevoir le lien d\'activation' : 'Recevoir le lien'}
              </button>
            </>
          )}

          <div className="flex flex-col gap-2 text-sm" style={{ alignItems: 'center' }}>
            {mode === 'login' && (
              <>
                <button type="button" className="btn btn-ghost text-sm" onClick={() => switchMode('forgot')}>Mot de passe oublié ?</button>
                <span className="text-muted">Pas encore de compte ? <button type="button" className="btn btn-ghost text-sm" onClick={() => switchMode('register')}>Créer un compte</button></span>
              </>
            )}
            {mode !== 'login' && (
              <button type="button" className="btn btn-ghost text-sm" onClick={() => switchMode('login')}>← Retour à la connexion</button>
            )}
            <Link to="/" className="text-muted text-xs">Retour à l'accueil</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
