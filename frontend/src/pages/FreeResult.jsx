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
    return <DetailedResult result={detailedData} onReset={onReset} onRefresh={loadDetailed} />
  }

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="bg-dots" />
      <div className="container" style={{ maxWidth: 680, position: 'relative' }}>

        <div className="card shadow-expert">
          <div className="result-verdict">
            <span className="verdict-icon">{hasAnomalies ? '⚠️' : '✅'}</span>
            <div className="verdict-label">Rapport Standard RIS</div>
            <div className={`verdict-title ${hasAnomalies ? 'danger' : 'success'}`}>
              Anomalies détectées : {hasAnomalies ? 'OUI' : 'NON'}
            </div>
            <p className="verdict-subtitle">
              {hasAnomalies
                ? 'Notre moteur d’analyse a identifié des incohérences nécessitant une régularisation pour garantir vos droits à la retraite.'
                : 'Félicitations ! Aucune anomalie majeure n’a été détectée dans votre relevé actuel.'}
            </p>
          </div>
          
          {hasAnomalies && result.preview_anomalies && result.preview_anomalies.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
                borderBottom: '1px solid var(--border)', paddingBottom: 12
              }}>
                <span style={{ fontSize: 20 }}>🔍</span>
                <h4 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                  Aperçu des justificatifs à préparer
                </h4>
              </div>

              <div className="anomaly-list">
                <motion.div 
                  className="anomaly-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 6, letterSpacing: 0.5 }}>
                    ANOMALIE ANCIENNE
                  </div>
                  <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[0].title}</h4>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>{result.preview_anomalies[0].description}</p>
                  
                  {result.preview_anomalies[0].justificatif && (
                    <div className="justificatif-box">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-light)', marginBottom: 4 }}>
                        📄 PIÈCE(S) À FOURNIR :
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                        {result.preview_anomalies[0].justificatif}
                      </div>
                    </div>
                  )}
                </motion.div>
                
                {result.preview_anomalies.length > 1 && (
                  <motion.div 
                    className="anomaly-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-light)', marginBottom: 6, letterSpacing: 0.5 }}>
                      POINT DE VIGILANCE INTERMÉDIAIRE
                    </div>
                    <h4 style={{ fontSize: 15, marginBottom: 8 }}>{result.preview_anomalies[1].title}</h4>
                    <p style={{ fontSize: 13, marginBottom: 12 }}>{result.preview_anomalies[1].description}</p>
                    
                    {result.preview_anomalies[1].justificatif && (
                      <div className="justificatif-box">
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 4 }}>
                          📄 PIÈCE(S) À FOURNIR :
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                          {result.preview_anomalies[1].justificatif}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <motion.div 
                style={{ 
                  marginTop: 20, padding: '12px', borderRadius: 12, 
                  background: 'rgba(255,255,255,0.03)', textAlign: 'center'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  + <strong>{Math.max(0, (result.total_anomalies || result.preview_anomalies.length) - 2)}</strong> autres anomalies identifiées dans le rapport complet
                </div>
              </motion.div>
            </div>
          )}

          {hasAnomalies && (
            <div className="cta-box shadow-glow">
              <div style={{ display: 'inline-block', padding: '12px', borderRadius: '50%', background: 'rgba(79,70,229,0.1)', marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>📑</span>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Votre dossier de régularisation prêt en un clic</h3>
              <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 24 }}>
                Le rapport détaillé vous donne la <strong>liste exhaustive</strong> des pièces à fournir pour chaque année en anomalie selon votre situation (salarié, indépendant, étranger, etc).
              </p>
              
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 32 }}>
                 <span className="cta-price" style={{ fontSize: 56 }}>19€</span>
              </div>
              
              <div className="cta-price-label">Accès illimité à vie · Support expert inclus</div>

              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

              {user?.has_paid_access || user?.is_admin ? (
                <button className="btn btn-primary btn-large btn-glow" onClick={loadDetailed} disabled={loading}>
                  {loading ? 'Chargement en cours…' : '📋 Accéder à mon rapport expert'}
                </button>
              ) : (
                <button className="btn btn-primary btn-large btn-glow" onClick={handleGetDetailed} disabled={loading}>
                  {loading ? 'Redirection sécurisée…' : '💳 Débloquer mon expertise complète'}
                </button>
              )}

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
                  <span>🔒</span> Paiement Stripe
                </div>
                <div style={{ width: 1, height: 12, background: 'var(--border)' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
                  <span>🤝</span> Hologram Conseils
                </div>
              </div>
            </div>
          )}

          <div className="divider" />
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={onReset}>
              ← Retour au scanner
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
