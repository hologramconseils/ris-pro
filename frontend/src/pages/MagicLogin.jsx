import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { safeRedirect } from '../authClient'
import { useNoIndex } from '../hooks/useNoIndex'

// Page ouverte depuis le lien reçu après un paiement. La connexion n'a lieu qu'au clic sur le bouton :
// les outils qui ouvrent automatiquement les liens des e-mails (antivirus, aperçus) ne consomment pas le lien.
export default function MagicLogin() {
  useNoIndex()
  const navigate = useNavigate()
  const { loginWithLink } = useAuth()
  const [searchParams] = useSearchParams()
  const [token] = useState(searchParams.get('token') || '')
  const [target] = useState(safeRedirect(searchParams.get('redirect')))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searchParams.get('token')) window.history.replaceState(null, '', window.location.pathname)
  }, [searchParams])

  const go = async () => {
    setBusy(true)
    setError('')
    const result = await loginWithLink(token)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    navigate(target, { replace: true })
  }

  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{ flex: 1, padding: '4rem 1.5rem' }}>
      <div className="card glass text-center" style={{ maxWidth: '440px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <h1 className="text-2xl font-bold" style={{ margin: 0 }}>Accéder à mon compte</h1>
        {token ? (
          <>
            <p className="text-muted text-sm" style={{ margin: 0 }}>Merci pour votre achat. Cliquez ci-dessous pour ouvrir votre espace et retrouver vos analyses.</p>
            {error && (
              <div className="flex items-center gap-2 text-error text-sm p-3 bg-error-bg rounded-lg" role="alert">
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}
            <button className="btn btn-primary w-full" onClick={go} disabled={busy} style={{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : 'Accéder à mon espace'}
            </button>
          </>
        ) : (
          <p>Ce lien est incomplet ou n'est plus valable.</p>
        )}
        <Link to="/login?forgot=true" className="text-sm text-muted">Recevoir un nouveau lien par e-mail</Link>
      </div>
    </div>
  )
}
