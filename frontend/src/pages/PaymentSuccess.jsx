import { useEffect, useState } from 'react'
import { billingAPI, authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function PaymentSuccess({ onGoToResults }) {
  const { user, setUser } = useAuth()
  const [status, setStatus] = useState('processing') // processing | done | error

  useEffect(() => {
    // If user is logged in, confirm the payment on our side
    if (user) {
      billingAPI.mockSuccess()
        .then(() => authAPI.me())
        .then(res => { setUser(res.data); setStatus('done') })
        .catch(() => setStatus('done')) // Still show success even if sync fails
    } else {
      setStatus('done')
    }
  }, [])

  return (
    <div className="success-page">
      <div className="bg-dots" />
      <div style={{ position: 'relative', maxWidth: 520 }}>
        {status === 'processing' ? (
          <>
            <div className="spinner" style={{ margin: '0 auto 24px' }} />
            <h2>Finalisation du paiement…</h2>
          </>
        ) : (
          <>
            <div className="success-icon">🎉</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, letterSpacing: -1 }}>
              Paiement confirmé !
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
              Merci pour votre confiance. Votre accès à vie au rapport détaillé a bien été activé.
              Vous pouvez maintenant analyser votre RIS autant de fois que vous le souhaitez.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-large" onClick={() => window.location.href = '/'}>
                📋 Analyser mon RIS
              </button>
            </div>
            <div style={{ marginTop: 24, color: 'var(--text-subtle)', fontSize: 13 }}>
              🔄 Accès permanent · Analyses illimitées · Aucun frais supplémentaire
            </div>
          </>
        )}
      </div>
    </div>
  )
}
