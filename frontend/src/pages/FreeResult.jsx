import { useState } from 'react'
import AuthModal from '../components/AuthModal'
import DetailedResult from './DetailedResult'
import { billingAPI, scanAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'

export default function FreeResult({ result, onReset }) {
  const { user, setUser } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('register')
  const [loading, setLoading] = useState(false)
  const [showDetailed, setShowDetailed] = useState(false)
  const [detailedData, setDetailedData] = useState(null)
  const [error, setError] = useState('')

  const hasAnomalies = result.has_anomalies

  const handleGetDetailed = async () => {
    if (!user) {
      setAuthMode('register')
      setShowAuth(true)
      return
    }
    if (user.has_paid_access || user.is_admin) {
      await loadDetailed()
    } else {
      setLoading(true)
      try {
        const successUrl = `${window.location.origin}/?payment_success=1`
        const cancelUrl = window.location.href
        const res = await billingAPI.createCheckout(successUrl, cancelUrl)
        window.location.href = res.data.url
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Impossible de créer la session de paiement. Vérifiez votre connexion.';
        setError(errorMsg);
        setLoading(false);
      }
    }
  }

  const loadDetailed = async () => {
    setLoading(true)
    try {
      const res = await scanAPI.getResult(result.id)
      setDetailedData(res.data)
      setShowDetailed(true)
    } catch {
      setError('Impossible de charger le rapport. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = async () => {
    setShowAuth(false)
    await handleGetDetailed()
  }

  if (showDetailed && detailedData) {
    return <DetailedResult result={detailedData} onReset={onReset} />
  }

  return (
    <div className="page">
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 680, position: 'relative' }}>

        <div className="card">
          <div className="result-verdict">
            <span className="verdict-icon">{hasAnomalies ? '⚠️' : '✅'}</span>
            <div className="verdict-label">Rapport Standard RIS</div>
            <div className={`verdict-title ${hasAnomalies ? 'danger' : 'success'}`}>
              Anomalies détectées : {hasAnomalies ? 'OUI' : 'NON'}
            </div>
            <p className="verdict-subtitle">
              {hasAnomalies
                ? 'Notre analyse a détecté plusieurs anomalies dans votre relevé de carrière. Obtenez le rapport détaillé pour identifier et corriger ces erreurs.'
                : 'Aucune anomalie majeure n\'a été détectée. Votre carrière semble correctement enregistrée.'}
            </p>
          </div>
          
          {hasAnomalies && result.preview_anomalies && result.preview_anomalies.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h4 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 }}>
                🔍 Aperçu des anomalies et justificatifs requis
              </h4>
              <div className="anomaly-list">
                <motion.div 
                  className="anomaly-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 4 }}>
                    ANOMALIE ANCIENNE
                  </div>
                  <h4>{result.preview_anomalies[0].title}</h4>
                  <p>{result.preview_anomalies[0].description}</p>
                  {result.preview_anomalies[0].justificatif && (
                    <div className="justificatif-badge">
                      📄 À prévoir : <strong>{result.preview_anomalies[0].justificatif}</strong>
                    </div>
                  )}
                </motion.div>
                
                {result.preview_anomalies.length > 1 && (
                  <motion.div 
                    className="anomaly-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-light)', marginBottom: 4 }}>
                      ANOMALIE RÉCENTE (Intermédiaire)
                    </div>
                    <h4>{result.preview_anomalies[1].title}</h4>
                    <p>{result.preview_anomalies[1].description}</p>
                    {result.preview_anomalies[1].justificatif && (
                      <div className="justificatif-badge">
                        📄 À prévoir : <strong>{result.preview_anomalies[1].justificatif}</strong>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
              <motion.p 
                style={{ marginTop: 16, fontSize: 13, textAlign: 'center', color: 'var(--text-subtle)', fontStyle: 'italic' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                + {Math.max(0, (result.total_anomalies || result.preview_anomalies.length) - 2)} autres anomalies et justificatifs dans le rapport complet...
              </motion.p>
            </div>
          )}

          {hasAnomalies && (
            <div className="cta-box">
              <h3>🔎 Obtenez la liste complète des pièces à fournir</h3>
              <p>
                Le rapport détaillé vous donne la liste précise des documents à envoyer à votre caisse pour chaque année en anomalie.
              </p>
              <span className="cta-price">19€</span>
              <div className="cta-price-label">Accès illimité · Support expert</div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

              {user?.has_paid_access || user?.is_admin ? (
                <button className="btn btn-primary btn-large" onClick={loadDetailed} disabled={loading}>
                  {loading ? 'Chargement…' : '📋 Voir mon rapport détaillé'}
                </button>
              ) : (
                <button className="btn btn-primary btn-large" onClick={handleGetDetailed} disabled={loading}>
                  {loading ? 'Redirection…' : '💳 Payer 19€ pour le rapport d\'expertise'}
                </button>
              )}

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
                🔒 Paiement sécurisé via Stripe · Partenaire Hologram Conseils
              </div>
            </div>
          )}

          <div className="divider" />
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={onReset}>
              ← Analyser un autre fichier
            </button>
          </div>
        </div>
      </div>

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  )
}
