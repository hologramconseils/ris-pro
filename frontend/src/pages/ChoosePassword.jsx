import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { authApi } from '../authClient'
import { useNoIndex } from '../hooks/useNoIndex'

const TEXTS = {
  activation: { title: 'Activez votre compte', intro: 'Choisissez le mot de passe de votre compte RIS Pro.', call: authApi.activate, done: 'Votre compte est activé : vous pouvez vous connecter.' },
  reset: { title: 'Nouveau mot de passe', intro: 'Choisissez un nouveau mot de passe pour votre compte RIS Pro.', call: authApi.reset, done: 'Votre mot de passe est modifié : vous pouvez vous connecter.' },
}

// Page ouverte depuis le lien d'un e-mail (activation du compte ou mot de passe oublié).
export default function ChoosePassword({ kind }) {
  useNoIndex()
  const text = TEXTS[kind]
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Le jeton est retiré de la barre d'adresse (historique, copier-coller, en-tête Referer).
  useEffect(() => {
    if (searchParams.get('token')) window.history.replaceState(null, '', window.location.pathname)
  }, [searchParams])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    setBusy(true)
    const result = await text.call(token, password)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    navigate('/login', { replace: true, state: { notice: text.done } })
  }

  if (!token) {
    return (
      <div className="container flex items-center justify-center" style={{ flex: 1, padding: '4rem 1.5rem' }}>
        <div className="card glass text-center" style={{ maxWidth: '440px', padding: '2rem' }}>
          <p>Ce lien est incomplet ou n'est plus valable.</p>
          <Link to="/login?forgot=true" className="btn btn-primary" style={{ marginTop: '1rem' }}>Demander un nouveau lien</Link>
        </div>
      </div>
    )
  }

  const inputStyle = { width: '100%', minHeight: '44px', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)' }
  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{ flex: 1, padding: '4rem 1.5rem' }}>
      <form onSubmit={submit} className="card glass w-full max-w-md" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
        <h1 className="text-2xl font-bold" style={{ margin: 0 }}>{text.title}</h1>
        <p className="text-muted text-sm" style={{ margin: 0 }}>{text.intro} Au moins 12 caractères : une phrase de passe facile à retenir convient très bien.</p>
        <label className="text-sm font-medium" htmlFor="new-password">Mot de passe</label>
        <input id="new-password" type="password" className="input" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
        <label className="text-sm font-medium" htmlFor="confirm-password">Confirmez le mot de passe</label>
        <input id="confirm-password" type="password" className="input" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />
        {error && (
          <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg" role="alert">
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy} style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </div>
  )
}
